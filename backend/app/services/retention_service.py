import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from sqlalchemy import and_, func

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.database_manager import execute_write_operation
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


class DataRetentionService:
    def __init__(self):
        self.retention_hours = settings.DATA_RETENTION_HOURS
        self.cleanup_batch_size = 1000
        self.inactive_resource_hours = 1

    async def start_retention_tasks(self):
        """Start background retention tasks"""
        logger.info("Starting data retention background tasks")

        while True:
            try:
                # Run cleanup every hour
                await self.cleanup_old_metrics()
                await self.cleanup_inactive_resources()

                # Wait for next cleanup cycle (1 hour)
                await asyncio.sleep(3600)

            except Exception as e:
                logger.error(f"Error in retention service: {e}")
                await asyncio.sleep(3600)  # Continue after error

    async def cleanup_old_metrics(self):
        """Delete metrics records older than 24 hours"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=self.retention_hours)

        try:
            # Cleanup container metrics
            container_metrics_deleted = await self._cleanup_table_by_timestamp(
                ContainerMetrics, cutoff_time, "Container metrics"
            )

            # Cleanup network metrics
            network_metrics_deleted = await self._cleanup_table_by_timestamp(
                NetworkMetrics, cutoff_time, "Network metrics"
            )

            # Cleanup system snapshots
            system_snapshots_deleted = await self._cleanup_table_by_timestamp(
                SystemSnapshot, cutoff_time, "System snapshots"
            )

            total_deleted = (
                container_metrics_deleted
                + network_metrics_deleted
                + system_snapshots_deleted
            )

            if total_deleted > 0:
                logger.info(
                    f"Cleanup completed: {container_metrics_deleted} container "
                    f"metrics, {network_metrics_deleted} network metrics, "
                    f"{system_snapshots_deleted} system snapshots deleted"
                )
            else:
                logger.debug("No old metrics to cleanup")

        except Exception as e:
            logger.error(f"Error during metrics cleanup: {e}")

    async def cleanup_inactive_resources(self):
        """Remove resources marked as inactive for more than 1 hour"""
        cutoff_time = datetime.utcnow() - timedelta(hours=self.inactive_resource_hours)

        try:
            # Cleanup inactive containers
            containers_deleted = await self._cleanup_inactive_resources(
                DockerContainer, cutoff_time, "containers"
            )

            # Cleanup inactive images
            images_deleted = await self._cleanup_inactive_resources(
                DockerImage, cutoff_time, "images"
            )

            # Cleanup inactive volumes
            volumes_deleted = await self._cleanup_inactive_resources(
                DockerVolume, cutoff_time, "volumes"
            )

            # Cleanup inactive networks
            networks_deleted = await self._cleanup_inactive_resources(
                DockerNetwork, cutoff_time, "networks"
            )

            total_deleted = (
                containers_deleted + images_deleted + volumes_deleted + networks_deleted
            )

            if total_deleted > 0:
                logger.info(
                    f"Inactive resources cleanup completed: {containers_deleted} "
                    f"containers, {images_deleted} images, {volumes_deleted} "
                    f"volumes, {networks_deleted} networks deleted"
                )
            else:
                logger.debug("No inactive resources to cleanup")

        except Exception as e:
            logger.error(f"Error during inactive resources cleanup: {e}")

    async def _cleanup_table_by_timestamp(
        self, model_class, cutoff_time: datetime, description: str
    ) -> int:
        """Generic method to cleanup a table by timestamp"""

        def _cleanup_batch(db):
            # Count records to be deleted first
            count_query = db.query(func.count(model_class.id)).filter(
                model_class.timestamp < cutoff_time
            )
            total_to_delete = count_query.scalar()

            if total_to_delete == 0:
                return 0

            logger.debug(f"Found {total_to_delete} {description} records to delete")

            # Delete in batches to avoid long-running transactions
            total_deleted = 0
            while True:
                # Get a batch of IDs to delete
                batch_query = (
                    db.query(model_class.id)
                    .filter(model_class.timestamp < cutoff_time)
                    .limit(self.cleanup_batch_size)
                )

                batch_ids = [row.id for row in batch_query.all()]

                if not batch_ids:
                    break

                # Delete the batch
                deleted_count = (
                    db.query(model_class)
                    .filter(model_class.id.in_(batch_ids))
                    .delete(synchronize_session=False)
                )

                total_deleted += deleted_count

                logger.debug(f"Deleted batch of {deleted_count} {description} records")

            return total_deleted

        return await execute_write_operation(_cleanup_batch)

    async def _cleanup_inactive_resources(
        self, model_class, cutoff_time: datetime, description: str
    ) -> int:
        """Generic method to cleanup inactive resources"""
        total_deleted = 0

        try:
            db = SessionLocal()
            try:
                # Count inactive resources to be deleted
                count_query = db.query(func.count(model_class.id)).filter(
                    and_(
                        not model_class.is_active,
                        model_class.updated_at < cutoff_time,
                    )
                )
                total_to_delete = count_query.scalar()

                if total_to_delete == 0:
                    return 0

                logger.debug(
                    f"Found {total_to_delete} inactive {description} to delete"
                )

                # Delete in batches to avoid long-running transactions
                while True:
                    # Get a batch of IDs to delete
                    batch_query = (
                        db.query(model_class.id)
                        .filter(
                            and_(
                                not model_class.is_active,
                                model_class.updated_at < cutoff_time,
                            )
                        )
                        .limit(self.cleanup_batch_size)
                    )

                    batch_ids = [row.id for row in batch_query.all()]

                    if not batch_ids:
                        break

                    # Delete the batch
                    deleted_count = (
                        db.query(model_class)
                        .filter(model_class.id.in_(batch_ids))
                        .delete(synchronize_session=False)
                    )

                    total_deleted += deleted_count
                    db.commit()

                    logger.debug(
                        f"Deleted batch of {deleted_count} inactive {description}"
                    )

                    # Brief pause to avoid overwhelming the database
                    await asyncio.sleep(0.1)
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error cleaning up inactive {description}: {e}")

        return total_deleted

    async def get_retention_stats(self) -> Dict[str, Any]:
        """Get statistics about data retention"""
        try:
            db = SessionLocal()
            try:
                cutoff_time = datetime.utcnow() - timedelta(hours=self.retention_hours)

                # Count old metrics
                old_container_metrics = (
                    db.query(func.count(ContainerMetrics.id))
                    .filter(ContainerMetrics.timestamp < cutoff_time)
                    .scalar()
                )

                old_network_metrics = (
                    db.query(func.count(NetworkMetrics.id))
                    .filter(NetworkMetrics.timestamp < cutoff_time)
                    .scalar()
                )

                old_system_snapshots = (
                    db.query(func.count(SystemSnapshot.id))
                    .filter(SystemSnapshot.timestamp < cutoff_time)
                    .scalar()
                )

                # Count inactive resources
                inactive_cutoff = datetime.utcnow() - timedelta(
                    hours=self.inactive_resource_hours
                )

                inactive_containers = (
                    db.query(func.count(DockerContainer.id))
                    .filter(
                        and_(
                            not DockerContainer.is_active,
                            DockerContainer.updated_at < inactive_cutoff,
                        )
                    )
                    .scalar()
                )

                inactive_images = (
                    db.query(func.count(DockerImage.id))
                    .filter(
                        and_(
                            not DockerImage.is_active,
                            DockerImage.updated_at < inactive_cutoff,
                        )
                    )
                    .scalar()
                )

                inactive_volumes = (
                    db.query(func.count(DockerVolume.id))
                    .filter(
                        and_(
                            not DockerVolume.is_active,
                            DockerVolume.updated_at < inactive_cutoff,
                        )
                    )
                    .scalar()
                )

                inactive_networks = (
                    db.query(func.count(DockerNetwork.id))
                    .filter(
                        and_(
                            not DockerNetwork.is_active,
                            DockerNetwork.updated_at < inactive_cutoff,
                        )
                    )
                    .scalar()
                )

                return {
                    "retention_hours": self.retention_hours,
                    "inactive_resource_hours": self.inactive_resource_hours,
                    "old_metrics": {
                        "container_metrics": old_container_metrics,
                        "network_metrics": old_network_metrics,
                        "system_snapshots": old_system_snapshots,
                        "total": old_container_metrics
                        + old_network_metrics
                        + old_system_snapshots,
                    },
                    "inactive_resources": {
                        "containers": inactive_containers,
                        "images": inactive_images,
                        "volumes": inactive_volumes,
                        "networks": inactive_networks,
                        "total": inactive_containers
                        + inactive_images
                        + inactive_volumes
                        + inactive_networks,
                    },
                }
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error getting retention stats: {e}")
            return {"error": str(e)}

    async def force_cleanup(self):
        """Force immediate cleanup (for testing or manual cleanup)"""
        logger.info("Starting forced cleanup")
        await self.cleanup_old_metrics()
        await self.cleanup_inactive_resources()
        logger.info("Forced cleanup completed")


# Global retention service instance
retention_service = DataRetentionService()
