import asyncio
import logging
from typing import Dict

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.docker_cli import docker_cli_client
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


class DockerCollectionService:
    def __init__(self):
        self.docker_client = docker_cli_client

    async def safe_database_write(self, operation):
        """Safe database write with retry logic and exponential backoff"""
        for attempt in range(3):
            db = None
            try:
                db = SessionLocal()
                operation(db)
                db.commit()
                break
            except IntegrityError as e:
                logger.warning(
                    f"Database integrity error on attempt {attempt + 1}: {e}"
                )
                if db:
                    db.rollback()
                await asyncio.sleep(0.1 * (attempt + 1))  # Exponential backoff
            except Exception as e:
                logger.error(f"Database write attempt {attempt + 1} failed: {e}")
                if db:
                    db.rollback()
                if attempt == 2:  # Last attempt
                    raise
                await asyncio.sleep(0.1 * (attempt + 1))
            finally:
                if db:
                    db.close()

    def _parse_bytes(self, byte_str: str) -> int:
        """Parse byte string like '1.23MB' or '2.45MiB' to integer bytes"""
        if not byte_str:
            return 0

        byte_str = byte_str.strip().upper()

        # Define multipliers. IEC units will have 'I'.
        multipliers = {
            "B": 1,
            "K": 10**3,
            "KB": 10**3,
            "M": 10**6,
            "MB": 10**6,
            "G": 10**9,
            "GB": 10**9,
            "T": 10**12,
            "TB": 10**12,
            "KI": 1024,
            "KIB": 1024,
            "MI": 1024**2,
            "MIB": 1024**2,
            "GI": 1024**3,
            "GIB": 1024**3,
            "TI": 1024**4,
            "TIB": 1024**4,
        }

        # Find the unit part of the string
        unit = ""
        value_str = byte_str
        # Sort keys by length, longest first, to handle 'KiB' before 'K'
        for u in sorted(multipliers.keys(), key=len, reverse=True):
            if byte_str.endswith(u):
                unit = u
                value_str = byte_str[: -len(u)].strip()
                break

        # If no unit found, assume it's just bytes
        if not unit:
            try:
                return int(float(value_str))
            except (ValueError, TypeError):
                return 0

        try:
            value = float(value_str)
            return int(value * multipliers[unit])
        except (ValueError, TypeError):
            return 0


class ContainerCollector(DockerCollectionService):
    async def collect_container_data(self):
        """Collect container data and store in database"""
        try:
            containers = self.docker_client.get_containers(all=True)
            stats = self.docker_client.get_all_container_stats()

            def update_containers(db: Session):
                # Mark all containers as inactive first
                db.query(DockerContainer).update({"is_active": False})

                for container in containers:
                    container_id = container.get("id", "")
                    if not container_id:
                        continue

                    # Get stats for this container
                    container_stats = stats.get(container_id, {})

                    # Update or create container record
                    db_container = (
                        db.query(DockerContainer)
                        .filter(DockerContainer.id == container_id)
                        .first()
                    )

                    if db_container:
                        self.update_container_state(
                            db_container, container, container_stats
                        )
                        db_container.is_active = True
                        db_container.updated_at = func.now()
                    else:
                        db_container = DockerContainer(
                            id=container_id,
                            name=container.get("name", ""),
                            status=container.get("status", ""),
                            image=container.get("image", ""),
                            is_active=True,
                        )
                        self.update_container_state(
                            db_container, container, container_stats
                        )
                        db.add(db_container)

                    # Store metrics if available
                    if container_stats and container.get("status") == "running":
                        self.store_container_metrics(db, container_id, container_stats)

            await self.safe_database_write(update_containers)

        except Exception as e:
            logger.error(f"Error collecting container data: {e}")

    def update_container_state(
        self, db_container: DockerContainer, container_data: Dict, stats_data: Dict
    ):
        """Update container state with latest data"""
        db_container.name = container_data.get("name", "")
        db_container.status = container_data.get("status", "")
        db_container.image = container_data.get("image", "")

        if stats_data:
            # Parse CPU percentage
            cpu_str = stats_data.get("CPUPerc", "0%").replace("%", "")
            try:
                db_container.cpu_percent = float(cpu_str)
            except ValueError:
                db_container.cpu_percent = 0.0

            # Parse memory usage and percentage
            mem_perc_str = stats_data.get("MemPerc", "0%").replace("%", "")

            try:
                db_container.memory_percent = float(mem_perc_str)
            except ValueError:
                db_container.memory_percent = 0.0

            # Parse network I/O
            net_io_str = stats_data.get("NetIO", "0B / 0B")
            if " / " in net_io_str:
                rx_str, tx_str = net_io_str.split(" / ")
                db_container.network_rx = self._parse_bytes(rx_str)
                db_container.network_tx = self._parse_bytes(tx_str)

            # Parse block I/O
            block_io_str = stats_data.get("BlockIO", "0B / 0B")
            if " / " in block_io_str:
                read_str, write_str = block_io_str.split(" / ")
                db_container.block_read = self._parse_bytes(read_str)
                db_container.block_write = self._parse_bytes(write_str)

    def store_container_metrics(self, db: Session, container_id: str, stats_data: Dict):
        """Store container metrics in time-series table"""
        try:
            # Parse stats data
            cpu_str = stats_data.get("CPUPerc", "0%").replace("%", "")
            cpu_percent = float(cpu_str) if cpu_str else 0.0

            mem_perc_str = stats_data.get("MemPerc", "0%").replace("%", "")
            memory_percent = float(mem_perc_str) if mem_perc_str else 0.0

            # Parse network I/O
            net_io_str = stats_data.get("NetIO", "0B / 0B")
            network_rx = network_tx = 0
            if " / " in net_io_str:
                rx_str, tx_str = net_io_str.split(" / ")
                network_rx = self._parse_bytes(rx_str)
                network_tx = self._parse_bytes(tx_str)

            # Parse block I/O
            block_io_str = stats_data.get("BlockIO", "0B / 0B")
            block_read = block_write = 0
            if " / " in block_io_str:
                read_str, write_str = block_io_str.split(" / ")
                block_read = self._parse_bytes(read_str)
                block_write = self._parse_bytes(write_str)

            # Create metrics record
            metrics = ContainerMetrics(
                container_id=container_id,
                cpu_percent=cpu_percent,
                memory_percent=memory_percent,
                network_rx=network_rx,
                network_tx=network_tx,
                block_read=block_read,
                block_write=block_write,
            )

            db.add(metrics)

        except Exception as e:
            logger.error(f"Error storing container metrics for {container_id}: {e}")


class ImageCollector(DockerCollectionService):
    async def collect_image_data(self):
        """Collect image data and store in database"""
        try:
            images = self.docker_client.get_images()

            def update_images(db: Session):
                # Mark all images as inactive first
                db.query(DockerImage).update({"is_active": False})

                for image in images:
                    image_id = image.get("id", "")
                    if not image_id:
                        continue

                    # Update or create image record
                    db_image = (
                        db.query(DockerImage).filter(DockerImage.id == image_id).first()
                    )

                    if db_image:
                        self.update_image_state(db_image, image)
                        db_image.is_active = True
                        db_image.updated_at = func.now()
                    else:
                        db_image = DockerImage(
                            id=image_id,
                            repository=image.get("repository", ""),
                            tag=image.get("tag", ""),
                            is_active=True,
                        )
                        self.update_image_state(db_image, image)
                        db.add(db_image)

            await self.safe_database_write(update_images)

        except Exception as e:
            logger.error(f"Error collecting image data: {e}")

    def update_image_state(self, db_image: DockerImage, image_data: Dict):
        """Update image state with latest data"""
        db_image.repository = image_data.get("repository", "")
        db_image.tag = image_data.get("tag", "")

        # Parse size
        size_str = image_data.get("size", "0B")
        db_image.size_bytes = self._parse_bytes(size_str)

        # Parse virtual size
        virtual_size_str = image_data.get("virtual_size", "0B")
        db_image.virtual_size_bytes = self._parse_bytes(virtual_size_str)

        # Get layer count using Docker CLI
        layer_count = self.docker_client.get_image_layer_count(db_image.id)
        db_image.layer_count = layer_count

        # Determine if dangling
        db_image.is_dangling = self.calculate_dangling_status(image_data)

    def calculate_dangling_status(self, image_data: Dict) -> bool:
        """Calculate if image is dangling"""
        repository = image_data.get("repository", "")
        tag = image_data.get("tag", "")
        return repository == "<none>" or tag == "<none>"


class VolumeCollector(DockerCollectionService):
    async def collect_volume_data(self):
        """Collect volume data and store in database"""
        try:
            volumes = self.docker_client.get_volumes()

            def update_volumes(db: Session):
                # Mark all volumes as inactive first
                db.query(DockerVolume).update({"is_active": False})

                for volume in volumes:
                    volume_name = volume.get("name", "")
                    if not volume_name:
                        continue

                    # Update or create volume record
                    db_volume = (
                        db.query(DockerVolume)
                        .filter(DockerVolume.name == volume_name)
                        .first()
                    )

                    if db_volume:
                        self.update_volume_state(db_volume, volume)
                        db_volume.is_active = True
                        db_volume.updated_at = func.now()
                    else:
                        db_volume = DockerVolume(
                            id=volume_name,  # Use name as ID for volumes
                            name=volume_name,
                            driver=volume.get("driver", ""),
                            mountpoint=volume.get("mountpoint", ""),
                            volume_type=volume.get("scope", "local"),
                            scope=volume.get("scope", "local"),
                            is_active=True,
                        )
                        self.update_volume_state(db_volume, volume)
                        db.add(db_volume)

            await self.safe_database_write(update_volumes)

        except Exception as e:
            logger.error(f"Error collecting volume data: {e}")

    def update_volume_state(self, db_volume: DockerVolume, volume_data: Dict):
        """Update volume state with latest data"""
        db_volume.driver = volume_data.get("driver", "")
        db_volume.mountpoint = volume_data.get("mountpoint", "")
        db_volume.scope = volume_data.get("scope", "local")
        db_volume.volume_type = volume_data.get("scope", "local")

        # Calculate volume size
        db_volume.size_bytes = self.calculate_volume_size(
            volume_data.get("mountpoint", "")
        )

    def calculate_volume_size(self, mountpoint: str) -> int:
        """Calculate volume size using Docker CLI"""
        try:
            return self.docker_client.get_volume_size(mountpoint)
        except Exception as e:
            logger.error(f"Error calculating volume size for {mountpoint}: {e}")
            return 0


class NetworkCollector(DockerCollectionService):
    async def collect_network_data(self):
        """Collect network data and store in database"""
        try:
            networks = self.docker_client.get_networks()

            def update_networks(db: Session):
                # Mark all networks as inactive first
                db.query(DockerNetwork).update({"is_active": False})

                for network in networks:
                    network_id = network.get("id", "")
                    if not network_id:
                        continue

                    # Update or create network record
                    db_network = (
                        db.query(DockerNetwork)
                        .filter(DockerNetwork.id == network_id)
                        .first()
                    )

                    if db_network:
                        self.update_network_state(db_network, network)
                        db_network.is_active = True
                        db_network.updated_at = func.now()
                    else:
                        db_network = DockerNetwork(
                            id=network_id,
                            name=network.get("name", ""),
                            driver=network.get("driver", ""),
                            scope=network.get("scope", ""),
                            is_active=True,
                        )
                        self.update_network_state(db_network, network)
                        db.add(db_network)

                    # Store network metrics
                    self.calculate_network_metrics(db, network_id, network)

            await self.safe_database_write(update_networks)

        except Exception as e:
            logger.error(f"Error collecting network data: {e}")

    def update_network_state(self, db_network: DockerNetwork, network_data: Dict):
        """Update network state with latest data"""
        db_network.name = network_data.get("name", "")
        db_network.driver = network_data.get("driver", "")
        db_network.scope = network_data.get("scope", "")

        # Count containers in network
        containers = network_data.get("containers", {})
        db_network.containers_count = len(containers) if containers else 0

    def calculate_network_metrics(
        self, db: Session, network_id: str, network_data: Dict
    ):
        """Calculate and store network metrics"""
        try:
            # Get network traffic data
            traffic_data = self.docker_client.get_network_traffic(
                network_data.get("name", "")
            )

            # Create network metrics record
            metrics = NetworkMetrics(
                network_id=network_id,
                total_rx=traffic_data.get("rx_bytes", 0),
                total_tx=traffic_data.get("tx_bytes", 0),
                active_connections=network_data.get("containers", {})
                and len(network_data["containers"])
                or 0,
            )

            db.add(metrics)

        except Exception as e:
            logger.error(f"Error calculating network metrics for {network_id}: {e}")


class SystemCollector(DockerCollectionService):
    async def collect_system_snapshot(self):
        """Collect system snapshot and store in database"""
        try:

            def store_snapshot(db: Session):
                # Get current counts
                containers_running = (
                    db.query(DockerContainer)
                    .filter(
                        DockerContainer.is_active,
                        DockerContainer.status == "running",
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

                # Create snapshot
                snapshot = SystemSnapshot(
                    containers_running=containers_running,
                    containers_total=containers_total,
                    images_count=images_count,
                    volumes_count=volumes_count,
                    networks_count=networks_count,
                )

                db.add(snapshot)

            await self.safe_database_write(store_snapshot)

        except Exception as e:
            logger.error(f"Error collecting system snapshot: {e}")

    async def store_system_metrics(self, metrics_data: Dict):
        """Store system metrics"""
        await self.collect_system_snapshot()


# Global service instances
container_collector = ContainerCollector()
image_collector = ImageCollector()
volume_collector = VolumeCollector()
network_collector = NetworkCollector()
system_collector = SystemCollector()
