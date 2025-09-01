from fastapi import WebSocket
from typing import List, Dict
import json
import logging
from datetime import datetime, timezone
from app.services.docker_service import DockerService
from app.services.docker_database_service import docker_database_service
from app.models.docker_types import WebSocketMessage
from dateutil import parser

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.docker_service = None
        self.last_system_stats = None
        self.last_container_stats = None

    def _get_docker_service(self):
        """Lazy initialization of Docker service"""
        if self.docker_service is None:
            try:
                self.docker_service = DockerService()
            except Exception as e:
                logger.error(f"Failed to initialize Docker service: {e}")
                return None
        return self.docker_service

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(
            f"WebSocket connected. Total connections: {len(self.active_connections)}"
        )

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(
            f"WebSocket disconnected. Total connections: {len(self.active_connections)}"
        )

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                disconnected.append(connection)

        # Remove disconnected connections
        for connection in disconnected:
            self.disconnect(connection)

    async def send_system_stats(self):
        """Send system statistics from database to all connected clients"""
        try:
            # Get system metrics from database
            system_data = await docker_database_service.get_dashboard_summary()

            # Format for WebSocket message
            current_stats = {
                "containers_running": system_data["containers"]["running"],
                "containers_paused": 0,  # TODO: Add paused status tracking if needed
                "containers_stopped": system_data["containers"]["stopped"],
                "images": system_data["resources"]["images"],
                "server_version": "Unknown",  # Could be added to system snapshot if needed
                "total_memory": system_data["usage"]["total_memory_bytes"],
                "cpus": 0,  # Could be added to system info if needed
            }

            # Only broadcast if data has changed
            if self.last_system_stats is None or self._stats_changed(
                self.last_system_stats, current_stats
            ):
                self.last_system_stats = current_stats
                message = WebSocketMessage(type="system_stats", data=current_stats)
                await self.broadcast(json.dumps(message.dict()))
        except Exception as e:
            logger.error(f"Error sending system stats: {e}")

    async def send_personal_system_stats(self, websocket: WebSocket):
        """Send system statistics to a specific connected client"""
        try:
            docker_service = self._get_docker_service()
            if docker_service is None:
                return

            system_info = docker_service.get_system_info()
            current_stats = system_info.dict()
            message = WebSocketMessage(type="system_stats", data=current_stats)
            await self.send_personal_message(json.dumps(message.dict()), websocket)
        except Exception as e:
            logger.error(f"Error sending personal system stats: {e}")

    def _stats_changed(self, old_stats: dict, new_stats: dict) -> bool:
        """Check if stats have meaningful changes"""
        if not old_stats or not new_stats:
            return True

        # Check key fields that matter for UI updates
        key_fields = [
            "containers_running",
            "containers_total",
            "images",
            "volumes",
            "networks",
        ]
        return any(old_stats.get(field) != new_stats.get(field) for field in key_fields)

    def _container_stats_changed(self, old_stats: list, new_stats: list) -> bool:
        """Check if container stats have meaningful changes"""
        if not old_stats or not new_stats:
            return True

        if len(old_stats) != len(new_stats):
            return True

        # Create lookup dictionaries by container ID
        old_lookup = {stat["id"]: stat for stat in old_stats}
        new_lookup = {stat["id"]: stat for stat in new_stats}

        # Check if container IDs changed
        if set(old_lookup.keys()) != set(new_lookup.keys()):
            return True

        # Check for significant changes in metrics
        for container_id in old_lookup:
            old_container = old_lookup[container_id]
            new_container = new_lookup[container_id]

            # Check status changes
            if old_container["status"] != new_container["status"]:
                return True

            # Check significant metric changes (more than 1% CPU or 2% memory)
            if (
                abs(old_container["cpu_percent"] - new_container["cpu_percent"]) > 1.0
                or abs(
                    old_container["memory_percent"] - new_container["memory_percent"]
                )
                > 2.0
            ):
                return True

        return False

    async def _generate_container_stats_data(self):
        """Generate container statistics data from database"""
        try:
            # Get containers from database instead of Docker daemon
            containers = await docker_database_service.get_containers(all=False)
            stats_data = []

            # Early return if no containers
            if not containers:
                logger.info("No running containers found, returning empty stats")
                return []

            logger.info(f"Retrieved {len(containers)} containers from database")

            # Process each container using database data
            for container in containers:
                container_id = container.get("id", "")

                if container.get("status") == "running":
                    # Calculate uptime
                    uptime_str, uptime_seconds = self._calculate_uptime(
                        container.get("created", "")
                    )

                    # Get sparkline data (historical metrics from last hour)
                    sparkline_data = await self._get_sparkline_data_from_db(
                        container_id, 60
                    )

                    # Build enhanced container stats using database data
                    enhanced_stats = {
                        "id": container_id,
                        "name": container.get("name", "").lstrip("/"),
                        "status": container.get("status", "unknown"),
                        "uptime": uptime_str,
                        "uptime_seconds": uptime_seconds,
                        "cpu_percent": container.get("cpu_percent", 0.0),
                        "memory_usage": container.get("memory_usage", 0),
                        "memory_limit": container.get("memory_limit", 0),
                        "memory_percent": container.get("memory_percent", 0.0),
                        "network_rx": container.get("network_rx", 0),
                        "network_tx": container.get("network_tx", 0),
                        "block_read": container.get("block_read", 0),
                        "block_write": container.get("block_write", 0),
                        "sparkline_data": sparkline_data,
                        "timestamp": container.get(
                            "updated_at", datetime.now(timezone.utc).isoformat()
                        ),
                    }

                    stats_data.append(enhanced_stats)
                else:
                    logger.debug(f"Skipping non-running container {container_id}")

            return stats_data

        except Exception as e:
            logger.error(f"Error generating container stats from database: {e}")
            return []

    async def _get_sparkline_data_from_db(
        self, container_id: str, minutes: int = 60
    ) -> Dict[str, List[float]]:
        """Get sparkline data from database metrics"""
        try:
            metrics_data = await docker_database_service.get_container_metrics_history(
                container_id, minutes
            )

            if not metrics_data:
                return {
                    "cpu": [],
                    "memory": [],
                    "network_rx": [],
                    "network_tx": [],
                    "block_read": [],
                    "block_write": [],
                }

            # Extract values for sparklines
            cpu_data = [point["cpu_percent"] for point in metrics_data]
            memory_data = [point["memory_percent"] for point in metrics_data]
            network_rx_data = [point["network_rx"] for point in metrics_data]
            network_tx_data = [point["network_tx"] for point in metrics_data]
            block_read_data = [point["block_read"] for point in metrics_data]
            block_write_data = [point["block_write"] for point in metrics_data]

            return {
                "cpu": cpu_data,
                "memory": memory_data,
                "network_rx": network_rx_data,
                "network_tx": network_tx_data,
                "block_read": block_read_data,
                "block_write": block_write_data,
            }

        except Exception as e:
            logger.error(
                f"Error getting sparkline data for container {container_id}: {e}"
            )
            return {
                "cpu": [],
                "memory": [],
                "network_rx": [],
                "network_tx": [],
                "block_read": [],
                "block_write": [],
            }

    async def send_container_stats(self):
        """Send enhanced container statistics with uptime and sparkline data to all connected clients"""
        try:
            stats_data = await self._generate_container_stats_data()

            # Only broadcast if container data has changed significantly
            if self._container_stats_changed(self.last_container_stats, stats_data):
                self.last_container_stats = stats_data
                message = WebSocketMessage(
                    type="container_stats", data={"containers": stats_data}
                )
                await self.broadcast(json.dumps(message.dict()))
        except Exception as e:
            logger.error(f"Error sending container stats: {e}")

    async def send_personal_container_stats(self, websocket: WebSocket):
        """Send enhanced container statistics to a specific connected client"""
        try:
            stats_data = await self._generate_container_stats_data()
            message = WebSocketMessage(
                type="container_stats", data={"containers": stats_data}
            )
            await self.send_personal_message(json.dumps(message.dict()), websocket)
        except Exception as e:
            logger.error(f"Error sending personal container stats: {e}")

    async def send_initial_data_to_connection(self, websocket: WebSocket):
        """Send both system stats and container stats immediately to a new connection"""
        try:
            logger.info("Sending initial data to new WebSocket connection")

            # Send system stats first
            await self.send_personal_system_stats(websocket)

            # Send container stats second
            await self.send_personal_container_stats(websocket)

            logger.info("Initial data sent successfully to new connection")
        except Exception as e:
            logger.error(f"Error sending initial data to connection: {e}")

    def _parse_size_string(self, size_str: str) -> int:
        """Parse size strings like '1.2GB', '500MB', etc. to bytes"""
        try:
            size_str = size_str.strip()
            if size_str == "0B" or size_str == "--":
                return 0

            # Extract number and unit
            import re

            match = re.match(r"([\d.]+)([A-Za-z]*)", size_str)
            if not match:
                return 0

            value = float(match.group(1))
            unit = match.group(2).upper()

            # Convert to bytes
            multipliers = {
                "B": 1,
                "KB": 1024,
                "MB": 1024**2,
                "GB": 1024**3,
                "TB": 1024**4,
                "KIB": 1024,
                "MIB": 1024**2,
                "GIB": 1024**3,
                "TIB": 1024**4,
            }

            return int(value * multipliers.get(unit, 1))

        except Exception:
            return 0

    def _calculate_uptime(self, created_str: str) -> tuple[str, int]:
        """Calculate container uptime from creation timestamp"""
        try:
            if not created_str:
                return "Unknown", 0

            # Try to parse various timestamp formats
            try:
                # First try dateutil parser which handles many formats
                created_dt = parser.parse(created_str)
            except Exception:
                # Fallback to manual parsing for common Docker formats
                if created_str.endswith("Z"):
                    created_dt = datetime.fromisoformat(
                        created_str.replace("Z", "+00:00")
                    )
                elif "+0000 UTC" in created_str:
                    # Handle format like "2025-08-29 01:38:03 +0000 UTC"
                    clean_str = created_str.replace(" +0000 UTC", "+00:00")
                    created_dt = datetime.fromisoformat(clean_str)
                else:
                    created_dt = datetime.fromisoformat(created_str)

            # Make timezone aware if needed
            if created_dt.tzinfo is None:
                created_dt = created_dt.replace(tzinfo=timezone.utc)

            now = datetime.now(timezone.utc)
            uptime_delta = now - created_dt

            total_seconds = int(uptime_delta.total_seconds())

            # Format uptime string
            days = total_seconds // 86400
            hours = (total_seconds % 86400) // 3600
            minutes = (total_seconds % 3600) // 60

            if days > 0:
                uptime_str = f"{days} days, {hours} hours, {minutes} minutes"
            elif hours > 0:
                uptime_str = f"{hours} hours, {minutes} minutes"
            else:
                uptime_str = f"{minutes} minutes"

            return uptime_str, total_seconds

        except Exception as e:
            logger.error(f"Error calculating uptime: {e}")
            return "Unknown", 0

    async def send_container_events(self):
        """Monitor and send container events from database"""
        try:
            # Get containers from database
            containers = await docker_database_service.get_containers(all=True)
            message = WebSocketMessage(
                type="container_event",
                data={"containers": containers},
            )
            await self.broadcast(json.dumps(message.dict()))
        except Exception as e:
            logger.error(f"Error sending container events: {e}")


# Global connection manager
manager = ConnectionManager()
