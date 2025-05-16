from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "worker",
    broker=settings.CELERY_BROKER_URL,
    include=["app.workers.tasks"]
)

# Configure Celery beat schedule for periodic tasks
# celery_app.conf.beat_schedule = {
#     "fetch-articles-periodically": {
#         "task": "app.workers.tasks.fetch_all_articles",
#         "schedule": 60.0 * settings.FETCH_INTERVAL_MINUTES,  # Every N minutes
#     },
# }

# Scheduled tasks commented out - now only triggered manually
celery_app.conf.timezone = "UTC"
