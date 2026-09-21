"""add_scan_type_execution_log_and_bounty

Revision ID: f9911e223344
Revises: c0041e898005
Create Date: 2026-08-26 11:42:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9911e223344'
down_revision: Union[str, None] = 'c0041e898005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add scan_type and execution_log to scans
    op.add_column('scans', sa.Column('scan_type', sa.String(), server_default='vulnerability', nullable=False))
    op.add_column('scans', sa.Column('execution_log', sa.Text(), nullable=True))

    # 2. Add is_researcher to users
    op.add_column('users', sa.Column('is_researcher', sa.Boolean(), server_default='0', nullable=False))

    # 3. Create bounty_programs table
    op.create_table(
        'bounty_programs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('org_id', sa.String(36), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(32), server_default='draft', nullable=False),
        sa.Column('visibility', sa.String(32), server_default='public', nullable=False),
        sa.Column('safe_harbor_text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    # 4. Create bounty_scopes table
    op.create_table(
        'bounty_scopes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('program_id', sa.String(36), sa.ForeignKey('bounty_programs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('asset_type', sa.String(64), nullable=False),
        sa.Column('target', sa.String(255), nullable=False),
        sa.Column('in_scope', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
    )

    # 5. Create bounty_reward_tiers table
    op.create_table(
        'bounty_reward_tiers',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('program_id', sa.String(36), sa.ForeignKey('bounty_programs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('severity', sa.String(32), nullable=False),
        sa.Column('min_amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('max_amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('currency', sa.String(10), server_default='USD', nullable=False),
    )

    # 6. Create researchers table
    op.create_table(
        'researchers',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('display_name', sa.String(255), nullable=False),
        sa.Column('reputation_score', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_earned', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('total_reports', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    # 7. Create vulnerability_reports table
    op.create_table(
        'vulnerability_reports',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('program_id', sa.String(36), sa.ForeignKey('bounty_programs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('researcher_id', sa.String(36), sa.ForeignKey('researchers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('affected_scope_id', sa.String(36), sa.ForeignKey('bounty_scopes.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('steps_to_reproduce', sa.Text(), nullable=False),
        sa.Column('severity_claimed', sa.String(32), nullable=False),
        sa.Column('severity_confirmed', sa.String(32), nullable=True),
        sa.Column('cvss_score', sa.Float(), nullable=True),
        sa.Column('status', sa.String(32), server_default='submitted', nullable=False),
        sa.Column('reward_amount', sa.Float(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('triaged_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('disclosure_eligible_at', sa.DateTime(), nullable=True),
    )

    # 8. Create bounty_report_attachments table
    op.create_table(
        'bounty_report_attachments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('report_id', sa.String(36), sa.ForeignKey('vulnerability_reports.id', ondelete='CASCADE'), nullable=False),
        sa.Column('file_path', sa.String(512), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), nullable=True),
    )

    # 9. Create bounty_report_comments table
    op.create_table(
        'bounty_report_comments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('report_id', sa.String(36), sa.ForeignKey('vulnerability_reports.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('is_internal', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('bounty_report_comments')
    op.drop_table('bounty_report_attachments')
    op.drop_table('vulnerability_reports')
    op.drop_table('researchers')
    op.drop_table('bounty_reward_tiers')
    op.drop_table('bounty_scopes')
    op.drop_table('bounty_programs')
    op.drop_column('users', 'is_researcher')
    op.drop_column('scans', 'execution_log')
    op.drop_column('scans', 'scan_type')
