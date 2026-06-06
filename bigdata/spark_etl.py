"""
STB Security — PySpark batch ETL job.

This is the distributed-processing prototype of the analytics layer. It reads
the operational tables (presences, rapports, affectations) from PostgreSQL via
the JDBC connector, computes the same aggregates as the SQL materialized views
using Spark DataFrames, and writes the results to Parquet (a columnar Big Data
format).

In production this same job would run on a Spark cluster (YARN / Kubernetes)
reading from HDFS/Hive or a data lake instead of a single PostgreSQL instance —
the DataFrame logic stays identical, which is the whole point of prototyping
with Spark locally.

Run locally (requires Java 17+ and the PostgreSQL JDBC driver):

    pip install -r bigdata/requirements.txt
    python bigdata/spark_etl.py

Environment variables (with defaults):
    DB_HOST=localhost  DB_PORT=5432  DB_NAME=stb_security
    DB_USER=postgres   DB_PASSWORD=postgres
    OUTPUT_DIR=bigdata/output
"""

import os
from pyspark.sql import SparkSession
from pyspark.sql import functions as F


# ---- configuration --------------------------------------------------------
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "stb_security")
DB_USER = os.environ.get("DB_USER", "postgres")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "postgres")
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "bigdata/output")

JDBC_URL = f"jdbc:postgresql://{DB_HOST}:{DB_PORT}/{DB_NAME}"
JDBC_PROPS = {
    "user": DB_USER,
    "password": DB_PASSWORD,
    "driver": "org.postgresql.Driver",
}


def build_spark():
    """Create a local SparkSession, pulling the PostgreSQL JDBC driver."""
    return (
        SparkSession.builder.appName("STB-Security-Analytics-ETL")
        .config("spark.jars.packages", "org.postgresql:postgresql:42.7.3")
        .config("spark.sql.session.timeZone", "UTC")
        .master(os.environ.get("SPARK_MASTER", "local[*]"))
        .getOrCreate()
    )


def read_table(spark, table):
    return spark.read.jdbc(url=JDBC_URL, table=table, properties=JDBC_PROPS)


def write_parquet(df, name):
    path = os.path.join(OUTPUT_DIR, name)
    df.write.mode("overwrite").parquet(path)
    print(f"  wrote {df.count():>8} rows -> {path}")


def main():
    spark = build_spark()
    spark.sparkContext.setLogLevel("WARN")
    print("=== STB Security — Spark ETL ===\n")

    # ---- load ----
    print("Loading tables from PostgreSQL via JDBC...")
    presences = read_table(spark, "presences")
    rapports = read_table(spark, "rapports")
    sites = read_table(spark, "sites")
    print(f"  presences: {presences.count()} rows")
    print(f"  rapports:  {rapports.count()} rows\n")

    presences = presences.withColumn("month", F.date_trunc("month", F.col("date")))

    # ---- 1. Daily attendance per site ----
    print("Computing aggregates...")
    attendance_daily = (
        presences.groupBy("site_id", "date")
        .agg(
            F.count("*").alias("total"),
            F.sum(F.when(F.col("statut") == "present", 1).otherwise(0)).alias("present"),
            F.sum(F.when(F.col("statut") == "retard", 1).otherwise(0)).alias("late"),
            F.sum(F.when(F.col("statut") == "absent", 1).otherwise(0)).alias("absent"),
            F.sum(F.when(F.col("statut") == "conge", 1).otherwise(0)).alias("on_leave"),
        )
        .withColumn(
            "attendance_rate",
            F.round(F.col("present") / F.col("total") * 100, 1),
        )
    )
    write_parquet(attendance_daily, "attendance_daily")

    # ---- 2. Monthly absenteeism per site ----
    absenteeism_monthly = (
        presences.groupBy("site_id", "month")
        .agg(
            F.count("*").alias("total_records"),
            F.sum(F.when(F.col("statut") == "absent", 1).otherwise(0)).alias("absences"),
            F.sum(F.when(F.col("statut") == "retard", 1).otherwise(0)).alias("tardiness"),
        )
        .withColumn("absence_rate", F.round(F.col("absences") / F.col("total_records") * 100, 1))
        .withColumn("tardiness_rate", F.round(F.col("tardiness") / F.col("total_records") * 100, 1))
    )
    write_parquet(absenteeism_monthly, "absenteeism_monthly")

    # ---- 3. Monthly incidents per site / type ----
    incidents_monthly = (
        rapports.withColumn("month", F.date_trunc("month", F.col("date")))
        .groupBy("site_id", "type", "month")
        .agg(
            F.count("*").alias("total"),
            F.sum(F.when(F.col("statut") == "pending", 1).otherwise(0)).alias("pending"),
            F.sum(F.when(F.col("statut") == "approved", 1).otherwise(0)).alias("approved"),
        )
    )
    write_parquet(incidents_monthly, "incidents_monthly")

    # ---- 4. Agent workload ----
    agent_workload = (
        presences.groupBy("agent_id")
        .agg(
            F.count("*").alias("total_presence_days"),
            F.sum(F.when(F.col("statut") == "present", 1).otherwise(0)).alias("present_days"),
            F.sum(F.when(F.col("statut") == "absent", 1).otherwise(0)).alias("absent_days"),
            F.sum(F.when(F.col("statut") == "retard", 1).otherwise(0)).alias("late_days"),
        )
        .withColumn("attendance_rate", F.round(F.col("present_days") / F.col("total_presence_days") * 100, 1))
    )
    write_parquet(agent_workload, "agent_workload")

    print(f"\n=== Spark ETL complete. Parquet output in {OUTPUT_DIR}/ ===")
    spark.stop()


if __name__ == "__main__":
    main()
