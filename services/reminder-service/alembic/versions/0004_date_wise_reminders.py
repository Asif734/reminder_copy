"""Add exact-date reminder definitions."""

import sqlalchemy as sa

from alembic import op

revision = "0004_date_wise_reminders"
down_revision = "0003_secondary_daily_time"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL requires a newly-added enum value to be committed before constraints use it.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE reminders.remindertype ADD VALUE IF NOT EXISTS 'DATE'")
    op.add_column("reminders", sa.Column("due_date", sa.Date()), schema="reminders")
    op.create_check_constraint(
        "due_date_date_only",
        "reminders",
        "(type = 'DATE' AND due_date IS NOT NULL) OR (type <> 'DATE' AND due_date IS NULL)",
        schema="reminders",
    )


def downgrade() -> None:
    op.drop_constraint("due_date_date_only", "reminders", schema="reminders", type_="check")
    op.drop_column("reminders", "due_date", schema="reminders")
    # PostgreSQL enums do not support dropping a value safely; DATE remains available but unused.
