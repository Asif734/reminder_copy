from reminder_common.web import create_service_app

from app.api.reminders import router as reminders_router

app = create_service_app("reminder-service")
app.include_router(reminders_router)
