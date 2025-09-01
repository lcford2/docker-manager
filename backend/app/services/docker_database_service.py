import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, desc, func

from app.core.database import SessionLocal
from app.models.docker_models import (
    ContainerMetrics,
    DockerContainer,
    DockerImage,
    DockerNetwork,
    DockerVolume,
    NetworkMetrics,
    SystemSnapshot,
)

logger = logging.getLogger(__name__)


class DockerDatabaseService:
    def __init__(self):
        pass

    async def get_containers(self, all: bool = True) -> List[Dict[str, Any]]:
        """Get list of containers from database"""
        try:
            db = SessionLocal()
            try:
                query = db.query(DockerContainer)

                if not all:
                    # Only active containers
                    query = query.filter(DockerContainer.is_active)
                else:
                    # All containers, but prioritize active ones
                    query = query.filter(DockerContainer.is_active)

                containers = query.order_by(DockerContainer.name).all()

                result = []
                for container in containers:
                    result.append(
                        {
                            "id": container.id,
                            "name": container.name,
                            "status": container.status,
                            "image": container.image,
                            "created": (
                                container.created_at.isoformat()
                                if container.created_at
                                else ""
                            ),
                            "ports": {},  # TODO: Add port mapping to model if needed
                            "cpu_percent": container.cpu_percent,
                            "memory_percent": container.memory_percent,
                            "memory_usage": container.memory_usage,
                            "memory_limit": container.memory_limit,
                            "network_rx": container.network_rx,
                            "network_tx": container.network_tx,
                            "block_read": container.block_read,
                            "block_write": container.block_write,
                            "updated_at": (
                                container.updated_at.isoformat()
                                if container.updated_at
                                else ""
                            ),
                        }
                    )

                return result
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting containers from database: {e}")
            return []

    async def get_container_by_id(self, container_id: str) -> Optional[Dict[str, Any]]:
        """Get container by ID from database"""
        try:
            db = SessionLocal()
            try:
                container = (
                    db.query(DockerContainer)
                    .filter(
                        DockerContainer.id == container_id,
                        DockerContainer.is_active,
                    )
                    .first()
                )

                if not container:
                    return None

                return {
                    "id": container.id,
                    "name": container.name,
                    "status": container.status,
                    "image": container.image,
                    "created": (
                        container.created_at.isoformat() if container.created_at else ""
                    ),
                    "ports": {},  # TODO: Add port mapping to model if needed
                    "cpu_percent": container.cpu_percent,
                    "memory_percent": container.memory_percent,
                    "memory_usage": container.memory_usage,
                    "memory_limit": container.memory_limit,
                    "network_rx": container.network_rx,
                    "network_tx": container.network_tx,
                    "block_read": container.block_read,
                    "block_write": container.block_write,
                    "updated_at": (
                        container.updated_at.isoformat() if container.updated_at else ""
                    ),
                }
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting container {container_id} from database: {e}")
            return None

    async def get_container_metrics_history(
        self, container_id: str, minutes: int = 60
    ) -> List[Dict[str, Any]]:
        """Get historical metrics for a container"""
        try:
            db = SessionLocal()
            try:
                cutoff_time = datetime.utcnow() - timedelta(minutes=minutes)

                metrics = (
                    db.query(ContainerMetrics)
                    .filter(
                        ContainerMetrics.container_id == container_id,
                        ContainerMetrics.timestamp >= cutoff_time,
                    )
                    .order_by(ContainerMetrics.timestamp)
                    .all()
                )

                result = []
                for metric in metrics:
                    result.append(
                        {
                            "timestamp": metric.timestamp.isoformat(),
                            "cpu_percent": metric.cpu_percent,
                            "memory_percent": metric.memory_percent,
                            "memory_usage": metric.memory_usage,
                            "memory_limit": metric.memory_limit,
                            "network_rx": metric.network_rx,
                            "network_tx": metric.network_tx,
                            "block_read": metric.block_read,
                            "block_write": metric.block_write,
                        }
                    )

                return result
            finally:
                db.close()

        except Exception as e:
            logger.error(
                f"Error getting metrics history for container {container_id}: {e}"
            )
            return []

    async def get_images(self) -> List[Dict[str, Any]]:
        """Get list of images from database"""
        try:
            db = SessionLocal()
            try:
                images = (
                    db.query(DockerImage)
                    .filter(DockerImage.is_active)
                    .order_by(DockerImage.repository, DockerImage.tag)
                    .all()
                )

                result = []
                for image in images:
                    result.append(
                        {
                            "id": image.id,
                            "repository": image.repository,
                            "tag": image.tag,
                            "size": image.size_bytes,
                            "virtual_size": image.virtual_size_bytes,
                            "layer_count": image.layer_count,
                            "is_dangling": image.is_dangling,
                            "created": (
                                image.created_at.isoformat() if image.created_at else ""
                            ),
                        }
                    )

                return result
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting images from database: {e}")
            return []

    async def get_image_by_id(self, image_id: str) -> Optional[Dict[str, Any]]:
        """Get image by ID from database"""
        try:
            db = SessionLocal()
            try:
                image = (
                    db.query(DockerImage)
                    .filter(DockerImage.id == image_id, DockerImage.is_active)
                    .first()
                )

                if not image:
                    return None

                return {
                    "id": image.id,
                    "repository": image.repository,
                    "tag": image.tag,
                    "size": image.size_bytes,
                    "virtual_size": image.virtual_size_bytes,
                    "layer_count": image.layer_count,
                    "is_dangling": image.is_dangling,
                    "created": image.created_at.isoformat() if image.created_at else "",
                }
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting image {image_id} from database: {e}")
            return None

    async def get_volumes(self) -> List[Dict[str, Any]]:
        """Get list of volumes from database"""
        try:
            db = SessionLocal()
            try:
                volumes = (
                    db.query(DockerVolume)
                    .filter(DockerVolume.is_active)
                    .order_by(DockerVolume.name)
                    .all()
                )

                result = []
                for volume in volumes:
                    result.append(
                        {
                            "name": volume.name,
                            "driver": volume.driver,
                            "mountpoint": volume.mountpoint,
                            "volume_type": volume.volume_type,
                            "scope": volume.scope,
                            "size_bytes": volume.size_bytes,
                            "size": self._format_bytes(volume.size_bytes),
                            "created": (
                                volume.created_at.isoformat()
                                if volume.created_at
                                else ""
                            ),
                            "labels": {},  # TODO: Add labels to model if needed
                            "options": {},  # TODO: Add options to model if needed
                        }
                    )

                return result
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting volumes from database: {e}")
            return []

    async def get_volume_by_id(self, volume_name: str) -> Optional[Dict[str, Any]]:
        """Get volume by name from database"""
        try:
            db = SessionLocal()
            try:
                volume = (
                    db.query(DockerVolume)
                    .filter(DockerVolume.name == volume_name, DockerVolume.is_active)
                    .first()
                )

                if not volume:
                    return None

                return {
                    "name": volume.name,
                    "driver": volume.driver,
                    "mountpoint": volume.mountpoint,
                    "volume_type": volume.volume_type,
                    "scope": volume.scope,
                    "size_bytes": volume.size_bytes,
                    "size": self._format_bytes(volume.size_bytes),
                    "created": (
                        volume.created_at.isoformat() if volume.created_at else ""
                    ),
                    "labels": {},  # TODO: Add labels to model if needed
                    "options": {},  # TODO: Add options to model if needed
                }
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting volume {volume_name} from database: {e}")
            return None

    async def get_networks(self) -> List[Dict[str, Any]]:
        """Get list of networks from database"""
        try:
            db = SessionLocal()
            try:
                networks = (
                    db.query(DockerNetwork)
                    .filter(DockerNetwork.is_active)
                    .order_by(DockerNetwork.name)
                    .all()
                )

                result = []
                for network in networks:
                    result.append(
                        {
                            "id": network.id,
                            "name": network.name,
                            "driver": network.driver,
                            "scope": network.scope,
                            "containers_count": network.containers_count,
                            "created": (
                                network.created_at.isoformat()
                                if network.created_at
                                else ""
                            ),
                            "containers": {},  # TODO: Add container details if needed
                        }
                    )

                return result
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting networks from database: {e}")
            return []

    async def get_network_by_id(self, network_id: str) -> Optional[Dict[str, Any]]:
        """Get network by ID from database"""
        try:
            db = SessionLocal()
            try:
                network = (
                    db.query(DockerNetwork)
                    .filter(DockerNetwork.id == network_id, DockerNetwork.is_active)
                    .first()
                )

                if not network:
                    return None

                return {
                    "id": network.id,
                    "name": network.name,
                    "driver": network.driver,
                    "scope": network.scope,
                    "containers_count": network.containers_count,
                    "created": (
                        network.created_at.isoformat() if network.created_at else ""
                    ),
                    "containers": {},  # TODO: Add container details if needed
                }
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting network {network_id} from database: {e}")
            return None

    async def get_network_metrics_history(
        self, network_id: str, minutes: int = 60
    ) -> List[Dict[str, Any]]:
        """Get historical metrics for a network"""
        try:
            db = SessionLocal()
            try:
                cutoff_time = datetime.utcnow() - timedelta(minutes=minutes)

                metrics = (
                    db.query(NetworkMetrics)
                    .filter(
                        NetworkMetrics.network_id == network_id,
                        NetworkMetrics.timestamp >= cutoff_time,
                    )
                    .order_by(NetworkMetrics.timestamp)
                    .all()
                )

                result = []
                for metric in metrics:
                    result.append(
                        {
                            "timestamp": metric.timestamp.isoformat(),
                            "total_rx": metric.total_rx,
                            "total_tx": metric.total_tx,
                            "active_connections": metric.active_connections,
                        }
                    )

                return result
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting metrics history for network {network_id}: {e}")
            return []

    async def get_system_metrics(self, minutes: int = 60) -> Dict[str, Any]:
        """Get system metrics from database"""
        try:
            db = SessionLocal()
            try:
                cutoff_time = datetime.utcnow() - timedelta(minutes=minutes)

                # Get latest system snapshot
                latest_snapshot = (
                    db.query(SystemSnapshot)
                    .order_by(desc(SystemSnapshot.timestamp))
                    .first()
                )

                # Get historical snapshots
                historical_snapshots = (
                    db.query(SystemSnapshot)
                    .filter(SystemSnapshot.timestamp >= cutoff_time)
                    .order_by(SystemSnapshot.timestamp)
                    .all()
                )

                result = {"current": {}, "history": []}

                if latest_snapshot:
                    result["current"] = {
                        "containers_running": latest_snapshot.containers_running,
                        "containers_total": latest_snapshot.containers_total,
                        "images_count": latest_snapshot.images_count,
                        "volumes_count": latest_snapshot.volumes_count,
                        "networks_count": latest_snapshot.networks_count,
                        "timestamp": latest_snapshot.timestamp.isoformat(),
                    }

                for snapshot in historical_snapshots:
                    result["history"].append(
                        {
                            "containers_running": snapshot.containers_running,
                            "containers_total": snapshot.containers_total,
                            "images_count": snapshot.images_count,
                            "volumes_count": snapshot.volumes_count,
                            "networks_count": snapshot.networks_count,
                            "timestamp": snapshot.timestamp.isoformat(),
                        }
                    )

                return result
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting system metrics from database: {e}")
            return {"current": {}, "history": []}

    async def get_dashboard_summary(self) -> Dict[str, Any]:
        """Get dashboard summary data optimized for visualization"""
        try:
            db = SessionLocal()
            try:
                # Get current counts
                containers_running = (
                    db.query(DockerContainer)
                    .filter(
                        and_(
                            DockerContainer.is_active,
                            DockerContainer.status == "running",
                        )
                    )
                    .count()
                )

                containers_total = (
                    db.query(DockerContainer).filter(DockerContainer.is_active).count()
                )

                images_count = (
                    db.query(DockerImage).filter(DockerImage.is_active).count()
                )

                volumes_count = (
                    db.query(DockerVolume).filter(DockerVolume.is_active).count()
                )

                networks_count = (
                    db.query(DockerNetwork).filter(DockerNetwork.is_active).count()
                )

                # Get resource usage summary
                total_memory_usage = (
                    db.query(func.sum(DockerContainer.memory_usage))
                    .filter(
                        and_(
                            DockerContainer.is_active,
                            DockerContainer.status == "running",
                        )
                    )
                    .scalar()
                    or 0
                )

                avg_cpu_usage = (
                    db.query(func.avg(DockerContainer.cpu_percent))
                    .filter(
                        and_(
                            DockerContainer.is_active,
                            DockerContainer.status == "running",
                        )
                    )
                    .scalar()
                    or 0.0
                )

                total_image_size = (
                    db.query(func.sum(DockerImage.size_bytes))
                    .filter(DockerImage.is_active)
                    .scalar()
                    or 0
                )

                total_volume_size = (
                    db.query(func.sum(DockerVolume.size_bytes))
                    .filter(DockerVolume.is_active)
                    .scalar()
                    or 0
                )

                return {
                    "containers": {
                        "running": containers_running,
                        "total": containers_total,
                        "stopped": containers_total - containers_running,
                    },
                    "resources": {
                        "images": images_count,
                        "volumes": volumes_count,
                        "networks": networks_count,
                    },
                    "usage": {
                        "total_memory_bytes": int(total_memory_usage),
                        "total_memory": self._format_bytes(int(total_memory_usage)),
                        "avg_cpu_percent": round(float(avg_cpu_usage), 2),
                        "total_image_size_bytes": int(total_image_size),
                        "total_image_size": self._format_bytes(int(total_image_size)),
                        "total_volume_size_bytes": int(total_volume_size),
                        "total_volume_size": self._format_bytes(int(total_volume_size)),
                    },
                    "timestamp": datetime.utcnow().isoformat(),
                }
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting dashboard summary: {e}")
            return {
                "containers": {"running": 0, "total": 0, "stopped": 0},
                "resources": {"images": 0, "volumes": 0, "networks": 0},
                "usage": {
                    "total_memory_bytes": 0,
                    "total_memory": "0B",
                    "avg_cpu_percent": 0.0,
                    "total_image_size_bytes": 0,
                    "total_image_size": "0B",
                    "total_volume_size_bytes": 0,
                    "total_volume_size": "0B",
                },
                "timestamp": datetime.utcnow().isoformat(),
            }

    def _format_bytes(self, bytes_value: int) -> str:
        """Format bytes as human readable string"""
        if bytes_value == 0:
            return "0B"

        units = ["B", "KB", "MB", "GB", "TB"]
        unit_index = 0
        value = float(bytes_value)

        while value >= 1024 and unit_index < len(units) - 1:
            value /= 1024
            unit_index += 1

        if unit_index == 0:
            return f"{int(value)}B"
        else:
            return f"{value:.1f}{units[unit_index]}"


# Global database service instance
docker_database_service = DockerDatabaseService()
