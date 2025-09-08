import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import aiohttp
import docker

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging import get_logger
from app.models.containers import ContainerStats
from app.models.system_info import SystemInfo

logger = get_logger(__name__)


class DockerStatsCollector:
    def __init__(self):
        self.docker_client = docker.from_env()
        # self.redis_client = redis.from_url(
        #     "redis://redis:6379/0", decode_responses=True
        # )
        self._stats_cache = {}
        self._cache_timestamp = None
        self._cache_ttl = settings.cache_ttl_seconds
        self.base_url = "http://localhost/v1.41"  # Docker API version

    def get_docker_client_status(self):
        """Check if Docker client is available"""
        try:
            self.docker_client.ping()
            return {"status": "connected", "error": None}
        except Exception as e:
            return {"status": "disconnected", "error": str(e)}

    async def _get_container_stats_async(self, session, container_id, base_url):
        """Get stats for a single container asynchronously"""
        url = f"{base_url}/containers/{container_id}/stats?stream=false"
        try:
            async with session.get(url) as response:
                if response.status == 200:
                    return container_id, await response.json()
                else:
                    logger.warning(
                        f"Error fetching stats for {container_id}: "
                        f"HTTP {response.status}"
                    )
                    return container_id, None
        except Exception as e:
            logger.warning(f"Error fetching stats for {container_id}: {e}")
            return container_id, None

    def _parse_container_stats(self, container, stats_data):
        """Parse container stats data into the expected format"""
        container_data = {
            "id": container.id[:12],  # Short ID
            "name": container.name,
            "status": container.status,
            "image": container.image.tags[0] if container.image.tags else "unknown",
            "cpu_percent": 0.0,
            "memory_percent": 0.0,
            "memory_usage": 0,
            "memory_limit": 0,
            "network_rx": 0,
            "network_tx": 0,
            "block_read": 0,
            "block_write": 0,
            "timestamp": datetime.now(timezone.utc),
            "is_active": container.status == "running",
        }

        # Parse stats if available and container is running
        if container.status == "running" and stats_data:
            try:
                # CPU percentage
                cpu_delta = (
                    stats_data["cpu_stats"]["cpu_usage"]["total_usage"]
                    - stats_data["precpu_stats"]["cpu_usage"]["total_usage"]
                )
                system_delta = (
                    stats_data["cpu_stats"]["system_cpu_usage"]
                    - stats_data["precpu_stats"]["system_cpu_usage"]
                )

                if system_delta > 0 and cpu_delta > 0:
                    container_data["cpu_percent"] = (cpu_delta / system_delta) * 100.0

                # Memory stats
                mem_stats = stats_data["memory_stats"]
                if "usage" in mem_stats and "limit" in mem_stats:
                    container_data["memory_usage"] = mem_stats["usage"]
                    container_data["memory_limit"] = mem_stats["limit"]
                    if mem_stats["limit"] > 0:
                        container_data["memory_percent"] = (
                            mem_stats["usage"] / mem_stats["limit"]
                        ) * 100.0

                # Network stats
                networks = stats_data.get("networks", {})
                for network in networks.values():
                    container_data["network_rx"] += network.get("rx_bytes", 0)
                    container_data["network_tx"] += network.get("tx_bytes", 0)

                # Block I/O stats
                blkio_stats = stats_data.get("blkio_stats", {})
                if "io_service_bytes_recursive" in blkio_stats:
                    for item in blkio_stats["io_service_bytes_recursive"] or []:
                        if item["op"] == "Read":
                            container_data["block_read"] += item["value"]
                        elif item["op"] == "Write":
                            container_data["block_write"] += item["value"]

            except Exception as e:
                logger.warning(
                    f"Error parsing stats for container {container.name}: {e}"
                )

        return container_data

    async def collect_container_stats_async(self) -> List[Dict]:
        """Collect current container stats from Docker API asynchronously"""
        try:
            # Get all containers first (synchronous call, but fast)
            docker_containers = self.docker_client.containers.list(all=True)

            if not docker_containers:
                return []

            # Prepare containers data structure
            containers = []
            running_containers = []

            # Separate running containers that need stats
            for container in docker_containers:
                if container.status == "running":
                    running_containers.append(container)

            # Fetch stats asynchronously for running containers
            stats_results = {}
            if running_containers:
                connector = aiohttp.UnixConnector(path="/var/run/docker.sock")
                async with aiohttp.ClientSession(connector=connector) as session:
                    tasks = [
                        self._get_container_stats_async(
                            session, container.id, self.base_url
                        )
                        for container in running_containers
                    ]
                    results = await asyncio.gather(*tasks)
                    stats_results = dict(results)

            # Process all containers (running and non-running)
            for container in docker_containers:
                try:
                    stats_data = stats_results.get(container.id)
                    container_data = self._parse_container_stats(container, stats_data)
                    containers.append(container_data)
                except Exception as e:
                    logger.warning(f"Error processing container {container.name}: {e}")

            return containers

        except Exception as e:
            logger.error(f"Error collecting container stats: {e}")
            return []

    # Keep the synchronous version as a fallback
    def collect_container_stats(self) -> List[Dict]:
        """Collect current container stats from Docker API (synchronous fallback)"""
        try:
            return asyncio.run(self.collect_container_stats_async())
        except Exception as e:
            logger.error(f"Error in async stats collection, falling back to sync: {e}")
            return self._collect_container_stats_sync_fallback()

    def _collect_container_stats_sync_fallback(self) -> List[Dict]:
        """Synchronous fallback for collecting container stats"""
        try:
            containers = []
            docker_containers = self.docker_client.containers.list(all=True)

            for container in docker_containers:
                try:
                    # Get stats synchronously for running containers
                    stats_data = None
                    if container.status == "running":
                        stats_data = container.stats(stream=False)

                    container_data = self._parse_container_stats(container, stats_data)
                    containers.append(container_data)

                except Exception as e:
                    logger.warning(
                        f"Error collecting stats for container {container.name}: {e}"
                    )

            return containers

        except Exception as e:
            logger.error(f"Error in sync fallback stats collection: {e}")
            return []

    def collect_system_info(self) -> Dict:
        """Collect system information"""
        try:
            containers = self.docker_client.containers.list(all=True)
            images = self.docker_client.images.list()
            volumes = self.docker_client.volumes.list()
            networks = self.docker_client.networks.list()

            running_containers = [c for c in containers if c.status == "running"]

            return {
                "containers_running": len(running_containers),
                "containers_total": len(containers),
                "images_count": len(images),
                "volumes_count": len(volumes),
                "networks_count": len(networks),
                "timestamp": datetime.now(timezone.utc),
            }

        except Exception as e:
            logger.error(f"Error collecting system info: {e}")
            return {
                "containers_running": 0,
                "containers_total": 0,
                "images_count": 0,
                "volumes_count": 0,
                "networks_count": 0,
                "timestamp": datetime.now(timezone.utc),
            }

    def store_container_stats(self, containers_data: List[Dict]):
        """Store container stats in database"""
        db = SessionLocal()
        try:
            for container_data in containers_data:
                # Update or create container stats
                existing = (
                    db.query(ContainerStats).filter_by(id=container_data["id"]).first()
                )

                if existing:
                    for key, value in container_data.items():
                        setattr(existing, key, value)
                else:
                    stats = ContainerStats(**container_data)
                    db.add(stats)

            db.commit()
            logger.debug(f"Stored stats for {len(containers_data)} containers")

        except Exception as e:
            logger.error(f"Error storing container stats: {e}")
            db.rollback()
        finally:
            db.close()

    def store_system_info(self, system_data: Dict):
        """Store system info in database"""
        db = SessionLocal()
        try:
            system_info = SystemInfo(**system_data)
            db.add(system_info)
            db.commit()
            logger.debug("Stored system info")

        except Exception as e:
            logger.error(f"Error storing system info: {e}")
            db.rollback()
        finally:
            db.close()

    def get_cached_stats(self) -> Optional[Dict]:
        """Get cached stats if still valid"""
        if self._cache_timestamp and datetime.now() - self._cache_timestamp < timedelta(
            seconds=settings.cache_ttl_seconds
        ):
            return self._stats_cache
        return None

    def cleanup_old_data(self):
        """Remove data older than 24 hours"""
        db = SessionLocal()
        try:
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)

            # Clean old container stats
            deleted_containers = (
                db.query(ContainerStats)
                .filter(ContainerStats.timestamp < cutoff_time)
                .delete()
            )

            # Clean old system info
            deleted_system = (
                db.query(SystemInfo).filter(SystemInfo.timestamp < cutoff_time).delete()
            )

            db.commit()

            if deleted_containers or deleted_system:
                logger.info(
                    f"Cleaned up {deleted_containers} container records"
                    f" and {deleted_system} system records"
                )

        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            db.rollback()
        finally:
            db.close()

    async def publish_stats_to_redis(
        self, containers_data: List[Dict], system_data: Dict
    ):
        """Publish stats to Redis for WebSocket clients"""
        try:
            # Convert datetime objects to strings for JSON serialization
            containers_json = []
            for container in containers_data:
                container_copy = container.copy()
                if isinstance(container_copy.get("timestamp"), datetime):
                    container_copy["timestamp"] = container_copy[
                        "timestamp"
                    ].isoformat()
                containers_json.append(container_copy)

            system_copy = system_data.copy()
            if isinstance(system_copy.get("timestamp"), datetime):
                system_copy["timestamp"] = system_copy["timestamp"].isoformat()

            # Publish to Redis
            # self.redis_client.publish(
            #     "container_stats", json.dumps({"containers": containers_json})
            # )
            # self.redis_client.publish("system_stats", json.dumps(system_copy))

        except Exception as e:
            logger.error(f"Error publishing to Redis: {e}")


# Global collector instance
stats_collector = DockerStatsCollector()


async def run_collection_loop():
    """Main collection loop - runs every 10 seconds"""
    while True:
        try:
            # Collect data (now async for containers)
            containers_data = await stats_collector.collect_container_stats_async()
            system_data = stats_collector.collect_system_info()

            # Store in database
            stats_collector.store_container_stats(containers_data)
            stats_collector.store_system_info(system_data)

            # Publish to Redis for WebSocket clients
            await stats_collector.publish_stats_to_redis(containers_data, system_data)

            # Cache the results
            stats_collector._stats_cache = {
                "containers": containers_data,
                "system": system_data,
            }
            stats_collector._cache_timestamp = datetime.now()

            logger.debug(
                f"Collection cycle completed - {len(containers_data)} containers"
            )

        except Exception as e:
            logger.error(f"Error in collection loop: {e}")

        # Wait 10 seconds before next collection
        await asyncio.sleep(10)


async def run_cleanup_loop():
    """Cleanup loop - runs every hour"""
    while True:
        try:
            await asyncio.sleep(3600)  # Wait 1 hour
            stats_collector.cleanup_old_data()
        except Exception as e:
            logger.error(f"Error in cleanup loop: {e}")
