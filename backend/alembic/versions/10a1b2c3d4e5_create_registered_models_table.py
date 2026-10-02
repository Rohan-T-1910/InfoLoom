"""create registered models table for model registry

Revision ID: 10a1b2c3d4e5
Revises: 9b2c3d4e5f6a
Create Date: 2026-10-03 03:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '10a1b2c3d4e5'
down_revision: Union[str, Sequence[str], None] = '9b2c3d4e5f6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to add registered_models table."""
    op.create_table(
        'registered_models',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('dataset_id', sa.Integer(), nullable=False),
        sa.Column('source_model_id', sa.Integer(), nullable=True),
        sa.Column('algorithm', sa.String(length=50), nullable=False),
        sa.Column('task_type', sa.String(length=50), nullable=False),
        sa.Column('target_column', sa.String(length=255), nullable=False),
        sa.Column('feature_names', sa.JSON(), nullable=False),
        sa.Column('target_classes', sa.JSON(), nullable=True),
        sa.Column('metrics', sa.JSON(), nullable=False),
        sa.Column('training_parameters', sa.JSON(), nullable=False),
        sa.Column('artifact_path', sa.String(length=500), nullable=False),
        sa.Column('artifact_size_bytes', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='ready'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['source_model_id'], ['ml_models.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', 'version', name='uq_user_model_version')
    )
    op.create_index(op.f('ix_registered_models_id'), 'registered_models', ['id'], unique=False)
    op.create_index(op.f('ix_registered_models_name'), 'registered_models', ['name'], unique=False)
    op.create_index(op.f('ix_registered_models_user_id'), 'registered_models', ['user_id'], unique=False)
    op.create_index(op.f('ix_registered_models_dataset_id'), 'registered_models', ['dataset_id'], unique=False)
    op.create_index(op.f('ix_registered_models_source_model_id'), 'registered_models', ['source_model_id'], unique=False)
    op.create_index('ix_registered_models_active', 'registered_models', ['user_id', 'name', 'is_active'], unique=False)
    op.create_index('ix_registered_models_dataset', 'registered_models', ['user_id', 'dataset_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema to drop registered_models table."""
    op.drop_index('ix_registered_models_dataset', table_name='registered_models')
    op.drop_index('ix_registered_models_active', table_name='registered_models')
    op.drop_index(op.f('ix_registered_models_source_model_id'), table_name='registered_models')
    op.drop_index(op.f('ix_registered_models_dataset_id'), table_name='registered_models')
    op.drop_index(op.f('ix_registered_models_user_id'), table_name='registered_models')
    op.drop_index(op.f('ix_registered_models_name'), table_name='registered_models')
    op.drop_index(op.f('ix_registered_models_id'), table_name='registered_models')
    op.drop_table('registered_models')
