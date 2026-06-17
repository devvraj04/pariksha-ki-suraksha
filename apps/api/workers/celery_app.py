import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Check if Redis is available, otherwise automatically fall back to eager mode
redis_available = False
try:
    from redis import Redis
    r = Redis.from_url(REDIS_URL, socket_connect_timeout=1)
    r.ping()
    redis_available = True
except Exception:
    pass

if not redis_available:
    print("[Celery] Redis is not reachable. Falling back to Eager Mode (tasks run synchronously in-process).")

# Use in-memory cache backend when Redis is unavailable so that AsyncResult
# can still retrieve eager task results without crashing.
_backend_url = REDIS_URL if redis_available else "cache+memory://"

celery_app = Celery(
    "parikshasetu_tasks",
    broker=REDIS_URL,
    backend=_backend_url,
    include=[
        "apps.api.workers.tasks_exam",
        "apps.api.workers.tasks_vault",
        "apps.api.workers.tasks_printing",
        "apps.api.workers.tasks_transit",
        "apps.api.workers.tasks_evaluation",
        "apps.api.workers.tasks_results",
        "apps.api.workers.tasks_ai"
    ]
)

# Standard configurations
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300, # 5 minutes maximum runtime
    task_always_eager=not redis_available,
    task_store_eager_result=True,   # Store results even in eager/in-process mode
    task_eager_propagates=False     # Let task catch its own exceptions; don't re-raise into caller
)

# Celery Beat scheduled tasks configuration
celery_app.conf.beat_schedule = {
    "sync-transit-telemetry-every-minute": {
        "task": "apps.api.workers.tasks_transit.consume_trunk_telemetry",
        "schedule": 60.0, # Run every minute
    },
    "verify-watermarks-scheduled": {
        "task": "apps.api.workers.tasks_ai.scheduled_watermark_audit",
        "schedule": 300.0, # Run every 5 minutes
    }
}
