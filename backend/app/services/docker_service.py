import logging
from typing import Any, Dict, List, Optional, Tuple

from app.core.docker_cli import docker_cli_client
from app.models.docker_types import SystemInfo

logger = logging.getLogger(__name__)


class DockerService:
    def __init__(self):
        self.client = docker_cli_client

    def get_containers(self, all: bool = True) -> List[Dict[str, Any]]:
        """Get list of containers"""
        try:
            return self.client.get_containers(all=all)
        except Exception as e:
            logger.error(f"Error getting containers: {e}")
            raise

    def get_container_detail(self, container_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed container information"""
        try:
            # For now, return basic container info
            containers = self.client.get_containers(all=True)
            for container in containers:
                if container.get("id", "").startswith(container_id):
                    return container
            return None
        except Exception as e:
            logger.error(f"Error getting container detail: {e}")
            raise

    def start_container(self, container_id: str) -> bool:
        """Start a container"""
        return self.client.start_container(container_id)

    def stop_container(self, container_id: str) -> bool:
        """Stop a container"""
        return self.client.stop_container(container_id)

    def restart_container(self, container_id: str) -> bool:
        """Restart a container"""
        return self.client.restart_container(container_id)

    def remove_container(self, container_id: str, force: bool = False) -> bool:
        """Remove a container"""
        return self.client.remove_container(container_id, force)

    def get_container_stats(self, container_id: str) -> Optional[Dict[str, Any]]:
        """Get container resource statistics"""
        return self.client.get_container_stats(container_id)

    def get_all_container_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get resource statistics for all running containers in a single call"""
        try:
            return self.client.get_all_container_stats()
        except Exception as e:
            logger.error(f"Error getting all container stats: {e}")
            return {}

    def get_container_logs(self, container_id: str, tail: int = 100) -> str:
        """Get container logs"""
        return self.client.get_container_logs(container_id, tail)

    def get_volumes(self) -> List[Dict[str, Any]]:
        """Get list of volumes"""
        try:
            return self.client.get_volumes()
        except Exception as e:
            logger.error(f"Error getting volumes: {e}")
            raise

    def get_volume_detail(self, volume_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed volume information"""
        try:
            volume = self.client.client.volumes.get(volume_name)
            return volume.attrs
        except Exception as e:
            logger.error(f"Error getting volume detail: {e}")
            return None

    def get_images(self) -> List[Dict[str, Any]]:
        """Get list of images"""
        try:
            return self.client.get_images()
        except Exception as e:
            logger.error(f"Error getting images: {e}")
            raise

    def remove_image(
        self, image_id: str, force: bool = False
    ) -> Tuple[bool, Optional[str]]:
        """Remove an image"""
        try:
            self.client.remove_image(image_id, force)
            return True, None
        except Exception as e:
            logger.error(f"Error removing image: {e}")
            return False, str(e)

    def get_networks(self) -> List[Dict[str, Any]]:
        """Get list of networks"""
        try:
            return self.client.get_networks()
        except Exception as e:
            logger.error(f"Error getting networks: {e}")
            raise

    def get_system_info(self) -> SystemInfo:
        """Get Docker system information"""
        try:
            info = self.client.get_system_info()
            return SystemInfo(
                containers_running=info.get("ContainersRunning", 0),
                containers_paused=info.get("ContainersPaused", 0),
                containers_stopped=info.get("ContainersStopped", 0),
                images=info.get("Images", 0),
                server_version=info.get("ServerVersion", ""),
                total_memory=info.get("MemTotal", 0),
                cpus=info.get("NCPU", 0),
            )
        except Exception as e:
            logger.error(f"Error getting system info: {e}")
            raise
