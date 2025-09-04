import asyncio
import logging
from datetime import datetime
from typing import Set

from app.core.cache import invalidate_docker_cache
from app.services.docker_collection_service import (
    container_collector,
    image_collector,
    network_collector,
    system_collector,
    volume_collector,
)
from app.services.websocket_service import manager as websocket_manager

logger = logging.getLogger(__name__)


class BackgroundTaskManager:
    def __init__(self):
        self.running_tasks: Set[asyncio.Task] = set()
        self.shutdown_event = asyncio.Event()

    async def start_collection_tasks(self):
        """Start all background collection tasks with proper scheduling"""
        logger.info("Starting Docker collection background tasks")

        try:
            # Create tasks with offset scheduling to prevent write conflicts
            tasks = [
                asyncio.create_task(
                    self._container_collection_loop()
                ),  # Start immediately
                asyncio.create_task(
                    self._delayed_start(3, self._image_collection_loop)
                ),  # Start after 3s
                asyncio.create_task(
                    self._delayed_start(6, self._volume_collection_loop)
                ),  # Start after 6s
                asyncio.create_task(
                    self._delayed_start(9, self._network_collection_loop)
                ),  # Start after 9s
                asyncio.create_task(
                    self._delayed_start(12, self._system_collection_loop)
                ),  # Start after 12s
                asyncio.create_task(
                    self._delayed_start(15, self._websocket_broadcast_loop)
                ),  # Start after 15s for WebSocket broadcasting
            ]

            # Store tasks for monitoring
            self.running_tasks.update(tasks)

            # Monitor task health
            health_task = asyncio.create_task(self._task_health_monitor())
            self.running_tasks.add(health_task)

            # Wait for shutdown signal
            await self.shutdown_event.wait()

        except Exception as e:
            logger.error(f"Error in background task manager: {e}")
        finally:
            await self._graceful_shutdown()

    async def _delayed_start(self, delay_seconds: int, task_func):
        """Start a task after a delay to prevent conflicts"""
        await asyncio.sleep(delay_seconds)
        await task_func()

    async def _container_collection_loop(self):
        """Container collection loop - every 10 seconds"""
        logger.info("Starting container collection loop (10s interval)")

        while not self.shutdown_event.is_set():
            try:
                start_time = datetime.now()
                await container_collector.collect_container_data()

                # Invalidate container cache after collection
                invalidate_docker_cache()

                duration = (datetime.now() - start_time).total_seconds()
                logger.debug(f"Container collection completed in {duration:.2f}s")

                # Wait for next interval
                await asyncio.sleep(10)

            except asyncio.CancelledError:
                logger.info("Container collection loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in container collection loop: {e}")
                await asyncio.sleep(10)  # Continue after error

    async def _image_collection_loop(self):
        """Image collection loop - every 30 seconds"""
        logger.info("Starting image collection loop (30s interval)")

        while not self.shutdown_event.is_set():
            try:
                start_time = datetime.now()
                await image_collector.collect_image_data()

                duration = (datetime.now() - start_time).total_seconds()
                logger.debug(f"Image collection completed in {duration:.2f}s")

                # Wait for next interval
                await asyncio.sleep(30)

            except asyncio.CancelledError:
                logger.info("Image collection loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in image collection loop: {e}")
                await asyncio.sleep(30)  # Continue after error

    async def _volume_collection_loop(self):
        """Volume collection loop - every 60 seconds"""
        logger.info("Starting volume collection loop (60s interval)")

        while not self.shutdown_event.is_set():
            try:
                start_time = datetime.now()
                await volume_collector.collect_volume_data()

                duration = (datetime.now() - start_time).total_seconds()
                logger.debug(f"Volume collection completed in {duration:.2f}s")

                # Wait for next interval
                await asyncio.sleep(60)

            except asyncio.CancelledError:
                logger.info("Volume collection loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in volume collection loop: {e}")
                await asyncio.sleep(60)  # Continue after error

    async def _network_collection_loop(self):
        """Network collection loop - every 30 seconds"""
        logger.info("Starting network collection loop (30s interval)")

        while not self.shutdown_event.is_set():
            try:
                start_time = datetime.now()
                await network_collector.collect_network_data()

                duration = (datetime.now() - start_time).total_seconds()
                logger.debug(f"Network collection completed in {duration:.2f}s")

                # Wait for next interval
                await asyncio.sleep(30)

            except asyncio.CancelledError:
                logger.info("Network collection loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in network collection loop: {e}")
                await asyncio.sleep(30)  # Continue after error

    async def _system_collection_loop(self):
        """System collection loop - every 10 seconds"""
        logger.info("Starting system collection loop (10s interval)")

        while not self.shutdown_event.is_set():
            try:
                start_time = datetime.now()
                await system_collector.collect_system_snapshot()

                duration = (datetime.now() - start_time).total_seconds()
                logger.debug(f"System collection completed in {duration:.2f}s")

                # Wait for next interval
                await asyncio.sleep(10)

            except asyncio.CancelledError:
                logger.info("System collection loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in system collection loop: {e}")
                await asyncio.sleep(10)  # Continue after error

    async def _websocket_broadcast_loop(self):
        """WebSocket broadcast loop - every 5 seconds for live updates"""
        logger.info("Starting WebSocket broadcast loop (5s interval)")

        while not self.shutdown_event.is_set():
            try:
                start_time = datetime.now()

                # Only broadcast if there are connected clients
                if websocket_manager.active_connections:
                    # Send container stats to all connected clients
                    await websocket_manager.send_container_stats()
                    # Send system stats to all connected clients
                    await websocket_manager.send_system_stats()

                    duration = (datetime.now() - start_time).total_seconds()
                    logger.debug(
                        f"WebSocket broadcast completed in {duration:.2f}s to "
                        f"{len(websocket_manager.active_connections)} clients"
                    )
                else:
                    logger.debug("No WebSocket clients connected - skipping broadcast")

                # Wait for next interval
                await asyncio.sleep(5)

            except asyncio.CancelledError:
                logger.info("WebSocket broadcast loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in WebSocket broadcast loop: {e}")
                await asyncio.sleep(5)  # Continue after error

    async def _task_health_monitor(self):
        """Monitor health of all collection tasks and restart if needed"""
        logger.info("Starting task health monitor")

        while not self.shutdown_event.is_set():
            try:
                # Check if any tasks have failed
                for task in list(self.running_tasks):
                    if task.done() and not task.cancelled():
                        try:
                            task.result()  # This will raise exception if task failed
                        except Exception as e:
                            logger.error(f"Task failed with error: {e}")
                            # Remove failed task
                            self.running_tasks.discard(task)

                            # Restart task based on its name
                            # this is a simplified approach
                            # In a real implementation,
                            # you might want more sophisticated task identification
                            logger.warning(
                                "Task restart logic not fully implemented - "
                                "manual restart required"
                            )

                # Wait before next health check
                await asyncio.sleep(30)  # Check every 30 seconds

            except asyncio.CancelledError:
                logger.info("Task health monitor cancelled")
                break
            except Exception as e:
                logger.error(f"Error in task health monitor: {e}")
                await asyncio.sleep(30)

    async def _graceful_shutdown(self):
        """Gracefully shutdown all running tasks"""
        logger.info("Starting graceful shutdown of background tasks")

        try:
            # Cancel all running tasks
            for task in self.running_tasks:
                if not task.done():
                    task.cancel()

            # Wait for all tasks to complete
            if self.running_tasks:
                await asyncio.gather(*self.running_tasks, return_exceptions=True)

            logger.info("All background tasks shutdown completed")

        except Exception as e:
            logger.error(f"Error during graceful shutdown: {e}")

    def shutdown(self):
        """Signal shutdown to all tasks"""
        logger.info("Shutdown signal received for background tasks")
        self.shutdown_event.set()


# Global background task manager instance
background_manager = BackgroundTaskManager()
