"""add keywords column

Revision ID: 92a41f2e8a1b
Revises: 545fe12e5059
Create Date: 2025-05-09 15:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY


# revision identifiers, used by Alembic.
revision = '92a41f2e8a1b'
down_revision = '545fe12e5059'
branch_labels = None
depends_on = None


def upgrade():
    # Add keywords column to the article table
    op.add_column('article', sa.Column(
        'keywords', ARRAY(sa.String()), nullable=True))


def downgrade():
    # Remove keywords column from article table
    op.drop_column('article', 'keywords')
