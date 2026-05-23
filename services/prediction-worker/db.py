import os
import uuid

import pandas as pd
from sqlalchemy import create_engine, text


def get_database_url():
    return os.getenv("DATABASE_URL", "")


def create_db_engine(database_url=None):
    url = database_url or get_database_url()
    if not url:
        raise ValueError("DATABASE_URL is not configured.")

    try:
        return create_engine(url, pool_pre_ping=True)
    except ModuleNotFoundError as error:
        raise RuntimeError(
            "PostgreSQL driver is not available for SQLAlchemy. "
            "Install a DBAPI driver such as psycopg2 in the worker runtime."
        ) from error


def fetch_upcoming_matches(engine, limit=50):
    query = text(
        """
        SELECT
          m.id,
          m.league_id,
          m.home_team_id,
          m.away_team_id,
          m.starts_at,
          ht.name AS home_team,
          at.name AS away_team,
          l.name AS league_name
        FROM matches m
        JOIN teams ht ON ht.id = m.home_team_id
        JOIN teams at ON at.id = m.away_team_id
        JOIN leagues l ON l.id = m.league_id
        WHERE m.status = 'SCHEDULED'
          AND m.starts_at >= CURRENT_TIMESTAMP
        ORDER BY m.starts_at ASC
        LIMIT :limit
        """
    )

    return pd.read_sql_query(query, engine, params={"limit": limit})


def fetch_recent_results(engine, limit=500):
    query = text(
        """
        SELECT
          id,
          league_id,
          home_team_id,
          away_team_id,
          home_score,
          away_score,
          starts_at
        FROM matches
        WHERE status = 'FINAL'
          AND home_score IS NOT NULL
          AND away_score IS NOT NULL
        ORDER BY starts_at DESC
        LIMIT :limit
        """
    )

    return pd.read_sql_query(query, engine, params={"limit": limit})


def save_predictions(engine, predictions):
    rows = [dict(row, id=_prediction_id()) for row in predictions]
    if not rows:
        return 0

    statement = text(
        """
        INSERT INTO model_predictions (
          id,
          match_id,
          model_name,
          model_version,
          market,
          selection,
          fair_probability,
          fair_price_decimal,
          edge_pct,
          rationale,
          created_at
        )
        VALUES (
          :id,
          :match_id,
          :model_name,
          :model_version,
          CAST(:market AS "MarketType"),
          :selection,
          :fair_probability,
          :fair_price_decimal,
          :edge_pct,
          :rationale,
          :created_at
        )
        """
    )

    with engine.begin() as connection:
        connection.execute(statement, rows)

    return len(rows)


def _prediction_id():
    return f"pred_{uuid.uuid4().hex}"
