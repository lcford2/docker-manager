import docker
from docker.errors import DockerException, NotFound, APIError
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class DockerClientWrapper:
    def __init__(self):
        self.client = None
        self.connection_attempted = False

    def _initialize_client(self):
        """Initialize Docker client with fallback options"""
        if self.client is not None or self.connection_attempted:
            return

        self.connection_attempted = True

        try:
            # Try with explicit socket path - this should work from container
            socket_path = "unix:///var/run/docker.sock"
            logger.info(f"Attempting to connect to Docker socket: {socket_path}")

            # Use APIClient for more direct control
            from docker import APIClient

            api_client = APIClient(base_url=socket_path)
            version_info = api_client.version()
            logger.info(
                f"Docker API version check successful: {version_info.get('Version', 'unknown')}"
            )

            # If API client works, create full client
            self.client = docker.DockerClient(base_url=socket_path)
            self.client.ping()
            logger.info("Docker client connected successfully via socket")
            return
        except Exception as e:
            logger.warning(f"Failed to connect via socket: {e}")

        try:
            # Second try: from environment variables with explicit socket
            import os

            os.environ["DOCKER_HOST"] = "unix:///var/run/docker.sock"
            logger.info(
                "Trying Docker connection from environment with explicit socket..."
            )
            self.client = docker.from_env()
            self.client.ping()
            logger.info("Docker client connected successfully from environment")
            return
        except Exception as e:
            logger.warning(f"Failed to connect from environment: {e}")

        try:
            # Third try: direct file socket access
            import subprocess

            result = subprocess.run(
                ["docker", "version"], capture_output=True, text=True
            )
            if result.returncode == 0:
                logger.info("Docker CLI accessible, trying client again...")
                self.client = docker.DockerClient(
                    base_url="unix:///var/run/docker.sock"
                )
                logger.info("Docker client created successfully")
                return
        except Exception as e:
            logger.warning(f"Docker CLI test failed: {e}")

        logger.error("All Docker connection attempts failed")
        self.client = None

    def _ensure_connected(self):
        """Ensure Docker client is connected"""
        if self.client is None and not self.connection_attempted:
            self._initialize_client()

        if self.client is None:
            raise DockerException("Docker client is not available")

    def get_containers(self, all: bool = True) -> List[Dict[str, Any]]:
        """Get list of containers"""
        try:
            self._ensure_connected()
            containers = self.client.containers.list(all=all)
            return [self._container_to_dict(container) for container in containers]
        except DockerException as e:
            logger.error(f"Error getting containers: {e}")
            raise

    def get_container(self, container_id: str) -> Optional[Dict[str, Any]]:
        """Get specific container details"""
        try:
            container = self.client.containers.get(container_id)
            return self._container_to_dict(container, detailed=True)
        except NotFound:
            return None
        except DockerException as e:
            logger.error(f"Error getting container {container_id}: {e}")
            raise

    def _container_to_dict(self, container, detailed: bool = False) -> Dict[str, Any]:
        """Convert container object to dictionary"""
        basic_info = {
            "id": container.id,
            "name": container.name,
            "status": container.status,
            "image": (
                container.image.tags[0] if container.image.tags else container.image.id
            ),
            "created": container.attrs.get("Created"),
            "ports": container.attrs.get("NetworkSettings", {}).get("Ports", {}),
        }

        if detailed:
            basic_info.update(
                {
                    "inspect": container.attrs,
                    "logs": container.logs(tail=100).decode("utf-8", errors="ignore"),
                }
            )

        return basic_info

    def start_container(self, container_id: str) -> bool:
        """Start a container"""
        try:
            container = self.client.containers.get(container_id)
            container.start()
            return True
        except (NotFound, APIError) as e:
            logger.error(f"Error starting container {container_id}: {e}")
            return False

    def stop_container(self, container_id: str) -> bool:
        """Stop a container"""
        try:
            container = self.client.containers.get(container_id)
            container.stop()
            return True
        except (NotFound, APIError) as e:
            logger.error(f"Error stopping container {container_id}: {e}")
            return False

    def restart_container(self, container_id: str) -> bool:
        """Restart a container"""
        try:
            container = self.client.containers.get(container_id)
            container.restart()
            return True
        except (NotFound, APIError) as e:
            logger.error(f"Error restarting container {container_id}: {e}")
            return False

    def remove_container(self, container_id: str, force: bool = False) -> bool:
        """Remove a container"""
        try:
            container = self.client.containers.get(container_id)
            container.remove(force=force)
            return True
        except (NotFound, APIError) as e:
            logger.error(f"Error removing container {container_id}: {e}")
            return False

    def get_container_stats(self, container_id: str) -> Optional[Dict[str, Any]]:
        """Get container resource statistics"""
        try:
            container = self.client.containers.get(container_id)
            stats = container.stats(stream=False)
            return stats
        except (NotFound, APIError) as e:
            logger.error(f"Error getting stats for container {container_id}: {e}")
            return None

    def get_system_info(self) -> Dict[str, Any]:
        """Get Docker system information"""
        try:
            self._ensure_connected()
            return self.client.info()
        except DockerException as e:
            logger.error(f"Error getting system info: {e}")
            raise


# Global docker client instance - initialized lazily
docker_client = None


def get_docker_client():
    """Get or create Docker client instance"""
    global docker_client
    if docker_client is None:
        docker_client = DockerClientWrapper()
    return docker_client
