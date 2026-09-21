"""add_analytics_tables

Revision ID: a1b2c3d4e5f6
Revises: c0041e898005
Create Date: 2026-08-22 09:00:00.000000

Creates three new tables for the self-hosted analytics system:
  - page_visits          : raw per-request rows (90-day TTL, then aggregated)
  - daily_visit_summaries: pre-aggregated archive (retained indefinitely)
  - api_key_usages       : per-call log for API key usage tracking
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'c0041e898005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── page_visits ────────────────────────────────────────────────────────────
    op.create_table(
        "page_visits",
        sa.Column("id", sa.String(), nullable=False, primary_key=True),
        sa.Column("subdomain", sa.String(), nullable=False),
        sa.Column("path", sa.String(), nullable=False),
        sa.Column("method", sa.String(), nullable=False, server_default="GET"),
        sa.Column("visitor_hash", sa.String(), nullable=False),
        sa.Column("referrer", sa.String(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("country", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
        ),
    )
    op.create_index("ix_page_visits_subdomain", "page_visits", ["subdomain"])
    op.create_index("ix_page_visits_visitor_hash", "page_visits", ["visitor_hash"])
    op.create_index("ix_page_visits_created_at", "page_visits", ["created_at"])
    op.create_index(
        "ix_page_visits_subdomain_created_at",
        "page_visits",
        ["subdomain", "created_at"],
    )

    # ── daily_visit_summaries ──────────────────────────────────────────────────
    op.create_table(
        "daily_visit_summaries",
        sa.Column("id", sa.String(), nullable=False, primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("subdomain", sa.String(), nullable=False),
        sa.Column("visit_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unique_visitor_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=True,
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
        ),
    )
    op.create_index("ix_daily_visit_summaries_date", "daily_visit_summaries", ["date"])
    op.create_index(
        "ix_daily_visit_summaries_subdomain", "daily_visit_summaries", ["subdomain"]
    )
    op.create_index(
        "ix_daily_visit_summaries_date_subdomain",
        "daily_visit_summaries",
        ["date", "subdomain"],
    )

    # ── api_key_usages ─────────────────────────────────────────────────────────
    op.create_table(
        "api_key_usages",
        sa.Column("id", sa.String(), nullable=False, primary_key=True),
        sa.Column("api_key_id", sa.String(), nullable=False),
        sa.Column("api_key_name", sa.String(), nullable=True),
        sa.Column("endpoint", sa.String(), nullable=False),
        sa.Column("method", sa.String(), nullable=False, server_default="GET"),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
        ),
    )
    op.create_index("ix_api_key_usages_api_key_id", "api_key_usages", ["api_key_id"])
    op.create_index("ix_api_key_usages_created_at", "api_key_usages", ["created_at"])
    op.create_index(
        "ix_api_key_usages_key_created_at",
        "api_key_usages",
        ["api_key_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("api_key_usages")
    op.drop_table("daily_visit_summaries")
    op.drop_table("page_visits")
