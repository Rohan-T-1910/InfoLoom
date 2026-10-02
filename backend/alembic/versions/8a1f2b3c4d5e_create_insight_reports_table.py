"""create insight reports table

Revision ID: 8a1f2b3c4d5e
Revises: 75ecf78d4f0d
Create Date: 2026-10-03 01:38:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8a1f2b3c4d5e'
down_revision: Union[str, Sequence[str], None] = '75ecf78d4f0d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'insight_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('dataset_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('insights', sa.JSON(), nullable=False),
        sa.Column('categories', sa.JSON(), nullable=False),
        sa.Column('kpi_summary', sa.JSON(), nullable=False),
        sa.Column('is_cleaned', sa.Boolean(), nullable=False),
        sa.Column('llm_polished', sa.Boolean(), nullable=False),
        sa.Column('total_insights', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_insight_reports_id'), 'insight_reports', ['id'], unique=False)
    op.create_index(op.f('ix_insight_reports_dataset_id'), 'insight_reports', ['dataset_id'], unique=False)
    op.create_index(op.f('ix_insight_reports_user_id'), 'insight_reports', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_insight_reports_user_id'), table_name='insight_reports')
    op.drop_index(op.f('ix_insight_reports_dataset_id'), table_name='insight_reports')
    op.drop_index(op.f('ix_insight_reports_id'), table_name='insight_reports')
    op.drop_table('insight_reports')
