-- Analytics OLAP layer — materialized views for Big Data KPIs.
-- These aggregate the operational tables (presences, rapports, affectations)
-- into pre-computed metrics that the /api/analytics endpoints serve.
--
-- Refresh with:  npm run etl   (or: node src/scripts/runEtl.js)

-----------------------------------------------------------------------
-- 1. Daily attendance per site
-----------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_attendance_daily AS
SELECT
  p.site_id,
  s.nom   AS site_nom,
  s.ville AS site_ville,
  p.date,
  COUNT(*)                                          AS total,
  COUNT(*) FILTER (WHERE p.statut = 'present')      AS present,
  COUNT(*) FILTER (WHERE p.statut = 'retard')       AS late,
  COUNT(*) FILTER (WHERE p.statut = 'absent')       AS absent,
  COUNT(*) FILTER (WHERE p.statut = 'conge')        AS on_leave,
  ROUND(
    COUNT(*) FILTER (WHERE p.statut = 'present')::numeric / NULLIF(COUNT(*), 0) * 100, 1
  ) AS attendance_rate
FROM presences p
JOIN sites s ON s.id = p.site_id
GROUP BY p.site_id, s.nom, s.ville, p.date
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_att_daily_pk
  ON mv_attendance_daily (site_id, date);

-----------------------------------------------------------------------
-- 2. Monthly absenteeism per site
-----------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_absenteeism_monthly AS
SELECT
  p.site_id,
  s.nom   AS site_nom,
  s.ville AS site_ville,
  DATE_TRUNC('month', p.date)::date AS month,
  COUNT(*)                                      AS total_records,
  COUNT(*) FILTER (WHERE p.statut = 'absent')   AS absences,
  COUNT(*) FILTER (WHERE p.statut = 'retard')   AS tardiness,
  ROUND(
    COUNT(*) FILTER (WHERE p.statut = 'absent')::numeric / NULLIF(COUNT(*), 0) * 100, 1
  ) AS absence_rate,
  ROUND(
    COUNT(*) FILTER (WHERE p.statut = 'retard')::numeric / NULLIF(COUNT(*), 0) * 100, 1
  ) AS tardiness_rate
FROM presences p
JOIN sites s ON s.id = p.site_id
GROUP BY p.site_id, s.nom, s.ville, DATE_TRUNC('month', p.date)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_abs_monthly_pk
  ON mv_absenteeism_monthly (site_id, month);

-----------------------------------------------------------------------
-- 3. Monthly incidents per site / type
-----------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_incidents_monthly AS
SELECT
  r.site_id,
  s.nom  AS site_nom,
  r.type AS incident_type,
  DATE_TRUNC('month', r.date)::date AS month,
  COUNT(*)                                     AS total,
  COUNT(*) FILTER (WHERE r.statut = 'pending')  AS pending,
  COUNT(*) FILTER (WHERE r.statut = 'approved') AS approved,
  COUNT(*) FILTER (WHERE r.statut = 'rejected') AS rejected
FROM rapports r
JOIN sites s ON s.id = r.site_id
GROUP BY r.site_id, s.nom, r.type, DATE_TRUNC('month', r.date)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_inc_monthly_pk
  ON mv_incidents_monthly (site_id, incident_type, month);

-----------------------------------------------------------------------
-- 4. Agent workload (assignments + presence stats)
-----------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_agent_workload AS
SELECT
  a.id         AS agent_id,
  a.nom        AS agent_nom,
  a.prenom     AS agent_prenom,
  a.matricule,
  a.statut     AS agent_status,
  COUNT(DISTINCT af.id)                                    AS total_assignments,
  COUNT(DISTINCT af.id) FILTER (WHERE af.statut = 'en cours') AS active_assignments,
  (SELECT COUNT(*) FROM presences pr WHERE pr.agent_id = a.id)                        AS total_presence_days,
  (SELECT COUNT(*) FROM presences pr WHERE pr.agent_id = a.id AND pr.statut = 'present') AS present_days,
  (SELECT COUNT(*) FROM presences pr WHERE pr.agent_id = a.id AND pr.statut = 'absent')  AS absent_days,
  (SELECT COUNT(*) FROM presences pr WHERE pr.agent_id = a.id AND pr.statut = 'retard')  AS late_days,
  ROUND(
    (SELECT COUNT(*) FROM presences pr WHERE pr.agent_id = a.id AND pr.statut = 'present')::numeric
    / NULLIF((SELECT COUNT(*) FROM presences pr WHERE pr.agent_id = a.id), 0) * 100, 1
  ) AS attendance_rate,
  (SELECT COUNT(*) FROM rapports rp WHERE rp.agent_id = a.id) AS total_reports
FROM agents a
LEFT JOIN affectations af ON af.agent_id = a.id
GROUP BY a.id, a.nom, a.prenom, a.matricule, a.statut
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_agent_wl_pk ON mv_agent_workload (agent_id);

-----------------------------------------------------------------------
-- 5. Coverage: agents per site over time
-----------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_site_coverage AS
SELECT
  s.id        AS site_id,
  s.nom       AS site_nom,
  s.ville     AS site_ville,
  COUNT(DISTINCT af.agent_id)                                          AS total_agents_ever,
  COUNT(DISTINCT af.agent_id) FILTER (WHERE af.statut = 'en cours')    AS current_agents,
  COUNT(DISTINCT af.id)                                                AS total_assignments,
  (SELECT COUNT(*) FROM rapports r WHERE r.site_id = s.id)             AS total_reports,
  (SELECT COUNT(*) FROM rapports r WHERE r.site_id = s.id AND r.type = 'incident') AS total_incidents
FROM sites s
LEFT JOIN affectations af ON af.site_id = s.id
GROUP BY s.id, s.nom, s.ville
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_site_cov_pk ON mv_site_coverage (site_id);
