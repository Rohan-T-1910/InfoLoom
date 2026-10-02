"""create report documents table

Revision ID: 9b2c3d4e5f6a
Revises: 8a1f2b3c4d5e
Create Date: 2026-10-03 02:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b2c3d4e5f6a'
down_revision: Union[str, Sequence[str], None] = '8a1f2b3c4d5e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'report_documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('dataset_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('report_type', sa.String(length=50), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False),
        sa.Column('sections_included', sa.JSON(), nullable=False),
        sa.Column('metadata_summary', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_report_documents_id'), 'report_documents', ['id'], unique=False)
    op.create_index(op.f('ix_report_documents_dataset_id'), 'report_documents', ['dataset_id'], unique=False)
    op.create_index(op.f('ix_report_documents_user_id'), 'report_documents', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_report_documents_user_id'), table_name='report_documents')
    op.drop_index(op.f('ix_report_documents_dataset_id'), table_name='report_documents')
    op.drop_index(op.f('ix_report_documents_id'), table_name='report_documents')
    op.drop_table('report_documents')
