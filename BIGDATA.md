# Big Data Layer — STB Security

This document describes the Big Data / analytics dimension added on top of the
existing STB Security operational app (Angular + Express + PostgreSQL). The
operational app is **unchanged** — this layer sits on top of it as a classic
**collecte → stockage → traitement → visualisation** pipeline.

---

## 1. Why a Big Data layer

The base app is an OLTP system: it manages security agents, sites, assignments,
attendance (pointage), reports and requests for the *Société Tunisienne de
Banque*. Across ~35 STB branches, with one attendance record per agent per day,
the volume grows fast:

| Entity      | Local prototype | At STB scale (real) |
|-------------|-----------------|---------------------|
| Branches    | ~35             | ~130 agencies       |
| Agents      | ~550            | thousands           |
| Presences   | **~400 000**    | tens of millions / year |
| Reports     | ~3 500          | hundreds of thousands |

The **presences** table is the high-volume *fact table*. Aggregating it on every
dashboard request would be slow, so we pre-compute analytics in an OLAP layer.

---

## 2. Architecture

```
  ┌─────────────────────────────────────────────────────────────────┐
  │ OPERATIONAL APP (unchanged)                                       │
  │  Angular 21  ──►  Express 5 API  ──►  PostgreSQL (OLTP tables)    │
  └─────────────────────────────────────────────────────────────────┘
                                 │
            collecte / ingestion │  (operational writes)
                                 ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ STORAGE  —  PostgreSQL fact tables                                │
  │   presences (fact)  rapports  affectations  agents  sites         │
  └─────────────────────────────────────────────────────────────────┘
            │                                        │
   batch ETL│ (SQL materialized views)      batch ETL│ (PySpark, distributed)
            ▼                                        ▼
  ┌──────────────────────────┐         ┌──────────────────────────────┐
  │ OLAP — materialized views│         │ Spark job (bigdata/spark_etl) │
  │  mv_attendance_daily     │         │  reads via JDBC, computes the │
  │  mv_absenteeism_monthly  │         │  same aggregates as Spark     │
  │  mv_incidents_monthly    │         │  DataFrames → Parquet output  │
  │  mv_agent_workload       │         └──────────────────────────────┘
  │  mv_site_coverage        │
  └──────────────────────────┘
            │
   /api/analytics/*  (admin-only REST)
            ▼
  ┌──────────────────────────────────────────────────┐
  │ VISUALISATION — admin-analytics dashboard          │
  │  "Big Data Insights" section (KPIs, trend chart,   │
  │   per-branch absenteeism, agent workload, coverage)│
  └──────────────────────────────────────────────────┘
```

---

## 3. Components

### 3.1 Data generation — `backend/src/scripts/generateBigData.js`
Generates large, realistic historical data so the analytics layer has volume to
work with. Idempotent (safe to re-run; uses `ON CONFLICT DO NOTHING`).

```bash
cd backend
npm run seed:bigdata            # defaults: 500 agents, 2 years (~400k presences)
BD_AGENTS=1000 BD_YEARS=3 npm run seed:bigdata   # scale up
```

It reuses the 35 real STB agencies from `seedSites.js`, creates agents + logins,
assigns them to branches over time, and fills daily attendance with a realistic
status distribution (≈85% present, 7% late, 5% absent, 3% leave), plus reports
and requests.

### 3.2 OLAP layer — `backend/src/scripts/analytics_schema.sql` + `runEtl.js`
PostgreSQL **materialized views** pre-aggregate the fact table:

| View                      | Grain                       | Key metrics |
|---------------------------|-----------------------------|-------------|
| `mv_attendance_daily`     | site × day                  | present / late / absent / attendance_rate |
| `mv_absenteeism_monthly`  | site × month                | absence_rate, tardiness_rate |
| `mv_incidents_monthly`    | site × type × month         | incident counts by status |
| `mv_agent_workload`       | agent                       | presence stats, attendance_rate, reports |
| `mv_site_coverage`        | site                        | agents, assignments, incidents |

```bash
cd backend
npm run etl     # creates the views (first run) then REFRESH MATERIALIZED VIEW
```

The ETL refreshes views `CONCURRENTLY` (no read lock), so it can run on a
schedule (cron) without disrupting the dashboard.

### 3.3 Distributed processing — `bigdata/spark_etl.py`
A **PySpark** batch job that is the distributed-processing prototype. It reads
the same tables via the PostgreSQL JDBC connector, computes the same aggregates
using Spark DataFrames, and writes **Parquet** (columnar Big Data format).

```bash
pip install -r bigdata/requirements.txt
DB_PASSWORD=postgres python bigdata/spark_etl.py     # writes bigdata/output/*.parquet
```

The DataFrame logic is identical to what would run on a real Spark cluster —
only the source (JDBC vs HDFS/Hive) and the master (`local[*]` vs YARN/K8s)
change. This is the "traitement distribué" piece a Big Data jury looks for.

### 3.4 Analytics API — `backend/src/routes/analytics.js`
Admin-only REST endpoints served from the materialized views (fast, pre-computed):

| Endpoint                              | Source view |
|---------------------------------------|-------------|
| `GET /api/analytics/summary`          | counts + avg attendance |
| `GET /api/analytics/attendance-trend` | mv_attendance_daily (rolled up monthly) |
| `GET /api/analytics/absenteeism-by-branch` | mv_absenteeism_monthly |
| `GET /api/analytics/incidents-monthly`| mv_incidents_monthly |
| `GET /api/analytics/agent-workload`   | mv_agent_workload |
| `GET /api/analytics/coverage`         | mv_site_coverage |

### 3.5 Visualisation — admin-analytics dashboard
The existing **admin-analytics** page gains a **"Big Data Insights"** section:
summary KPI cards, a monthly attendance-trend bar chart, per-branch absenteeism,
lowest-attendance agents, and site coverage — all from `/api/analytics/*`.
No existing functionality was removed.

---

## 4. Scaling to production (Big Data cluster)

The local stack maps cleanly onto a production Big Data architecture:

| Concern        | This prototype                | Production at scale |
|----------------|-------------------------------|---------------------|
| Ingestion      | Direct DB writes              | **Kafka** topics (pointage events streamed) |
| Storage        | PostgreSQL                    | **HDFS / Hive** data lake, or cloud object store |
| Batch compute  | SQL materialized views        | **Spark** batch jobs on YARN/Kubernetes |
| Stream compute | —                             | **Spark Structured Streaming** for real-time KPIs |
| Serving        | Materialized views + REST     | Pre-aggregated tables / OLAP store (Druid, ClickHouse) |
| Format         | Parquet (from the Spark job)  | Parquet/ORC partitioned by date & branch |
| Visualisation  | Angular dashboard             | Same dashboard, or Superset/Grafana |

The migration path: point the **same** PySpark job at HDFS/Hive instead of JDBC,
add a Kafka producer for pointage events, and schedule the batch ETL on the
cluster. The application code and dashboard stay the same.

---

## 5. Quick start

```bash
# 1. generate volume
cd backend && npm run seed:bigdata

# 2. build + refresh the OLAP layer
npm run etl

# 3. (optional) run the distributed Spark prototype
cd .. && pip install -r bigdata/requirements.txt
DB_PASSWORD=postgres python bigdata/spark_etl.py

# 4. start the app and open the admin analytics page
cd backend && npm start          # API on :3000
cd ../frontend && npm start      # UI on :4200  → login as admin → Analytics
```
