"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-09
"""
from pathlib import Path

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parent.parent / "sql" / "0001_initial_schema.sql"


def upgrade() -> None:
    sql = SQL_FILE.read_text()
    # Raw DB-API cursor with no parameters: psycopg2 then leaves '%' in SQL/comments alone.
    cursor = op.get_bind().connection.cursor()
    cursor.execute(sql)


def downgrade() -> None:
    # Drops every application table (keeps alembic_version) and the enum types from this migration.
    op.execute("""
        DO $$
        DECLARE r record;
        BEGIN
            FOR r IN SELECT tablename FROM pg_tables
                     WHERE schemaname = 'public' AND tablename <> 'alembic_version'
            LOOP
                EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
            END LOOP;
        END $$;
    """)
    for enum_type in ("user_role", "proposal_status", "milestone_status", "assignment_method", "assignment_run_status"):
        op.execute(f"DROP TYPE IF EXISTS {enum_type}")