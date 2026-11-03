from datetime import date, time, timedelta
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


def test_date_wise_reminder_requires_a_future_due_date() -> None:
    due_date = date.today() + timedelta(days=30)
    value = ReminderCreate(
        title="Renew license",
        type=ReminderType.DATE,
        reminder_time=time(9),
        due_date=due_date,
        days_before=5,
    )
    assert value.due_date == due_date

    with pytest.raises(ValidationError):
        ReminderCreate(
            title="Old deadline",
            type=ReminderType.DATE,
            reminder_time=time(9),
            due_date=date.today() - timedelta(days=1),
        )


def test_date_wise_reminder_rejects_monthly_and_secondary_fields() -> None:
    with pytest.raises(ValidationError):
        ReminderCreate(
            title="Invalid exact date",
            type=ReminderType.DATE,
            reminder_time=time(9),
            due_date=date.today() + timedelta(days=30),
            monthly_due_day=15,
        )
