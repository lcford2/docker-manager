import asyncio
import logging
import threading

from app.core.redis_client import redis_client
from app.services.background_tasks import background_manager
from app.services.retention_service import retention_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global flag to ensure tasks are started only once
tasks_started = threading.Event()


async def main_background_tasks():
    """The main entry point for all background async tasks."""
    # Pass redis_client to the background manager
    background_manager.redis_client = redis_client

    logger.info("Gathering background tasks...")
    await asyncio.gather(
        background_manager.start_collection_tasks(),
        retention_service.start_retention_tasks(),
    )


def run_background_loop():
    """Runs the asyncio event loop."""
    logger.info("Starting new asyncio event loop for background tasks.")
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(main_background_tasks())
    finally:
        loop.close()
        logger.info("Background asyncio event loop closed.")


def on_starting(server):
    """
    Gunicorn master process hook.
    This is called in the master process before any workers are forked.
    """
    if not tasks_started.is_set():
        logger.info("Master process starting background tasks in a new thread...")
        thread = threading.Thread(target=run_background_loop, daemon=True)
        thread.start()
        tasks_started.set()
        logger.info("Background tasks thread started.")
    else:
        logger.info("Background tasks already started.")


def post_fork(server, worker):
    """
    Gunicorn worker process hook.
    This is called in the worker process after it has been forked.
    """
    logger.info(f"Worker {worker.pid} forked.")
