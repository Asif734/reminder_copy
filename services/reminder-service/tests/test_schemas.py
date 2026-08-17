from datetime import time
import pytest
from pydantic import ValidationError

from app.models.reminder import ReminderType
from app.schemas.reminders import ReminderCreate


def test_daily_reminder_needs_no_assignment() -> None:
    value = ReminderCreate(
        title="Daily report",
        type=ReminderType.DAILY,
        reminder_time=time(16, 30),
    )
    assert value.title == "Daily report"


def test_monthly_reminder_requires_due_day() -> None:
    with pytest.raises(ValidationError):
        ReminderCreate(
            title="Monthly report",
            type=ReminderType.MONTHLY,
            reminder_time=time(10),
        )


def test_daily_reminder_rejects_monthly_due_day() -> None:
    with pytest.raises(ValidationError):
        ReminderCreate(
            title="Daily report",
            type=ReminderType.DAILY,
            reminder_time=time(10),
            monthly_due_day=15,
        )
