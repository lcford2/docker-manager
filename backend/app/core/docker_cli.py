import json
import logging
import subprocess
import time
from typing import Any, Dict, List, Optional

from app.core.circuit_breaker import CircuitBreakerOpenException, circuit_breaker

logger = logging.getLogger(__name__)


class DockerCLIWrapper:
    def __init__(self):
        self.available = self._test_docker_availability()
        self._last_availability_check = time.time()
        self._availability_check_interval = 30  # Check every 30 seconds

    def _test_docker_availability(self) -> bool:
        """Test if Docker CLI is available"""
        try:
            result = subprocess.run(
                ["docker", "--version"], capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                logger.info(f"Docker CLI available: {result.stdout.strip()}")
                self._last_availability_check = time.time()
                return True
            else:
                logger.error(f"Docker CLI test failed: {result.stderr}")
                return False
        except Exception as e:
            logger.error(f"Docker CLI not available: {e}")
            return False

    def _check_availability_if_needed(self) -> bool:
        """Check Docker availability if enough time has passed"""
        current_time = time.time()
        if (
            not self.available
            and (current_time - self._last_availability_check)
            >= self._availability_check_interval
        ):
            logger.info("Re-checking Docker availability...")
            self.available = self._test_docker_availability()
        return self.available

    @circuit_breaker(
        failure_threshold=3,
        recovery_timeout=30,
        expected_exception=(
            subprocess.SubprocessError,
            subprocess.TimeoutExpired,
            Exception,
        ),
        name="docker_command",
    )
    def _run_docker_command(self, command: List[str]) -> Optional[Dict[str, Any]]:
        """Run a docker command and return parsed JSON result"""
        if not self._check_availability_if_needed():
            raise Exception("Docker CLI not available")

        try:
            full_command = ["docker"] + command
            result = subprocess.run(
                full_command, capture_output=True, text=True, timeout=30
            )

            if result.returncode == 0:
                if result.stdout.strip():
                    try:
                        return json.loads(result.stdout)
                    except json.JSONDecodeError:
                        # For non-JSON output
                        return {"output": result.stdout.strip()}
                return {"success": True}
            else:
                error_msg = (
                    f"Docker command failed: {' '.join(full_command)}, "
                    f"Error: {result.stderr}"
                )
                logger.error(error_msg)
                raise Exception(error_msg)
        except subprocess.TimeoutExpired as e:
            error_msg = f"Docker command timed out: {' '.join(command)}"
            logger.error(error_msg)
            raise e
        except Exception as e:
            logger.error(f"Error running docker command: {e}")
            raise e

    @circuit_breaker(
        failure_threshold=3,
        recovery_timeout=30,
        expected_exception=(
            subprocess.SubprocessError,
            subprocess.TimeoutExpired,
            Exception,
        ),
        name="docker_system_info",
    )
    def get_system_info(self) -> Dict[str, Any]:
        """Get Docker system information"""
        try:
            if not self._check_availability_if_needed():
                return {"status": "disconnected", "error": "Docker CLI not available"}

            # Test basic connectivity
            version_result = subprocess.run(
                ["docker", "version", "--format", "{{.Server.Version}}"],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if version_result.returncode == 0:
                server_version = version_result.stdout.strip()

                # Get system info
                info_result = subprocess.run(
                    ["docker", "system", "info", "--format", "json"],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )

                if info_result.returncode == 0:
                    try:
                        info_data = json.loads(info_result.stdout)
                        return {
                            "status": "connected",
                            "docker_version": server_version,
                            "containers_running": info_data.get("ContainersRunning", 0),
                            "containers_paused": info_data.get("ContainersPaused", 0),
                            "containers_stopped": info_data.get("ContainersStopped", 0),
                            "images": info_data.get("Images", 0),
                            "server_version": server_version,
                            "total_memory": info_data.get("MemTotal", 0),
                            "cpus": info_data.get("NCPU", 0),
                        }
                    except json.JSONDecodeError:
                        pass

                return {"status": "connected", "docker_version": server_version}
            else:
                error_msg = (
                    f"Docker version check failed: {version_result.stderr.strip()}"
                )
                raise Exception(error_msg)

        except CircuitBreakerOpenException:
            return {
                "status": "circuit_open",
                "error": "Docker service temporarily unavailable",
            }
        except Exception as e:
            logger.error(f"Error getting system info: {e}")
            raise e

    @circuit_breaker(
        failure_threshold=3,
        recovery_timeout=30,
        expected_exception=(
            subprocess.SubprocessError,
            subprocess.TimeoutExpired,
            Exception,
        ),
        name="docker_containers",
    )
    def get_containers(self, all: bool = True) -> List[Dict[str, Any]]:
        """Get list of containers"""
        try:
            if not self._check_availability_if_needed():
                raise Exception("Docker CLI not available")

            cmd = ["ps", "--format", "json"]
            if all:
                cmd.append("-a")

            result = subprocess.run(
                ["docker"] + cmd, capture_output=True, text=True, timeout=15
            )

            if result.returncode == 0:
                containers = []
                for line in result.stdout.strip().split("\n"):
                    if line.strip():
                        try:
                            container = json.loads(line)
                            containers.append(
                                {
                                    "id": container.get("ID", ""),
                                    "name": container.get("Names", ""),
                                    "status": container.get("State", ""),
                                    "image": container.get("Image", ""),
                                    "created": container.get("CreatedAt", ""),
                                    "ports": {},  # Simplified for now
                                }
                            )
                        except json.JSONDecodeError:
                            continue
                return containers
            else:
                error_msg = f"Failed to get containers: {result.stderr}"
                logger.error(error_msg)
                raise Exception(error_msg)

        except CircuitBreakerOpenException:
            logger.warning("Circuit breaker open for container operations")
            return []
        except Exception as e:
            logger.error(f"Error getting containers: {e}")
            raise e

    def get_container_stats(self, container_id: str) -> Optional[Dict[str, Any]]:
        """Get container statistics"""
        try:
            if not self.available:
                return None

            result = subprocess.run(
                ["docker", "stats", "--no-stream", "--format", "json", container_id],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if result.returncode == 0 and result.stdout.strip():
                try:
                    return json.loads(result.stdout)
                except json.JSONDecodeError:
                    return None
            return None

        except Exception as e:
            logger.error(f"Error getting container stats: {e}")
            return None

    @circuit_breaker(
        failure_threshold=3,
        recovery_timeout=30,
        expected_exception=(
            subprocess.SubprocessError,
            subprocess.TimeoutExpired,
            Exception,
        ),
        name="docker_stats",
    )
    def get_all_container_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics for all running containers in a single call"""
        try:
            if not self._check_availability_if_needed():
                raise Exception("Docker CLI not available")

            result = subprocess.run(
                ["docker", "stats", "--no-stream", "--format", "json"],
                capture_output=True,
                text=True,
                timeout=10,  # Increased timeout for reliability
            )

            if result.returncode == 0 and result.stdout.strip():
                stats_dict = {}
                # Parse each line as JSON (each line is a container's stats)
                for line in result.stdout.strip().split("\n"):
                    if line.strip():
                        try:
                            container_stats = json.loads(line)
                            # Use container ID as key for lookup
                            container_id = container_stats.get("ID", "")
                            if container_id:
                                stats_dict[container_id] = container_stats
                        except json.JSONDecodeError:
                            logger.warning(
                                f"Failed to parse container stats line: {line}"
                            )
                            continue

                logger.debug(
                    "Successfully retrieved bulk stats for "
                    f"{len(stats_dict)} containers"
                )
                return stats_dict
            else:
                error_msg = f"Docker stats bulk call failed: {result.stderr}"
                logger.warning(error_msg)
                raise Exception(error_msg)

        except CircuitBreakerOpenException:
            logger.warning("Circuit breaker open for stats operations")
            return {}
        except subprocess.TimeoutExpired as e:
            logger.error("Docker stats bulk call timed out")
            raise e
        except Exception as e:
            logger.error(f"Error getting bulk container stats: {e}")
            raise e

    def start_container(self, container_id: str) -> bool:
        """Start a container"""
        try:
            if not self.available:
                return False

            result = subprocess.run(
                ["docker", "start", container_id],
                capture_output=True,
                text=True,
                timeout=15,
            )
            return result.returncode == 0

        except Exception as e:
            logger.error(f"Error starting container: {e}")
            return False

    def stop_container(self, container_id: str) -> bool:
        """Stop a container"""
        try:
            if not self.available:
                return False

            result = subprocess.run(
                ["docker", "stop", container_id],
                capture_output=True,
                text=True,
                timeout=30,
            )
            return result.returncode == 0

        except Exception as e:
            logger.error(f"Error stopping container: {e}")
            return False

    def restart_container(self, container_id: str) -> bool:
        """Restart a container"""
        try:
            if not self.available:
                return False

            result = subprocess.run(
                ["docker", "restart", container_id],
                capture_output=True,
                text=True,
                timeout=30,
            )
            return result.returncode == 0

        except Exception as e:
            logger.error(f"Error restarting container: {e}")
            return False

    def remove_container(self, container_id: str, force: bool = False) -> bool:
        """Remove a container"""
        try:
            if not self.available:
                return False

            cmd = ["docker", "rm", container_id]
            if force:
                cmd.insert(2, "--force")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
            )
            return result.returncode == 0

        except Exception as e:
            logger.error(f"Error removing container: {e}")
            return False

    def get_container_logs(self, container_id: str, tail: int = 100) -> str:
        """Get container logs"""
        try:
            if not self.available:
                return "Docker CLI not available"

            result = subprocess.run(
                ["docker", "logs", "--tail", str(tail), container_id],
                capture_output=True,
                text=True,
                timeout=15,
            )

            if result.returncode == 0:
                return result.stdout
            else:
                return f"Error getting logs: {result.stderr}"

        except Exception as e:
            logger.error(f"Error getting container logs: {e}")
            return f"Error: {str(e)}"

    def get_images(self) -> List[Dict[str, Any]]:
        """Get list of images"""
        try:
            if not self.available:
                return []

            result = subprocess.run(
                ["docker", "images", "--format", "json"],
                capture_output=True,
                text=True,
                timeout=15,
            )

            if result.returncode == 0:
                images = []
                for line in result.stdout.strip().split("\n"):
                    if line.strip():
                        try:
                            image = json.loads(line)
                            images.append(
                                {
                                    "id": image.get("ID", ""),
                                    "repository": image.get("Repository", ""),
                                    "tag": image.get("Tag", ""),
                                    "size": image.get("Size", ""),
                                    "virtual_size": image.get("VirtualSize", ""),
                                    "created": image.get("CreatedAt", ""),
                                }
                            )
                        except json.JSONDecodeError:
                            continue
                return images
            else:
                return []

        except Exception as e:
            logger.error(f"Error getting images: {e}")
            return []

    def get_volumes(self) -> List[Dict[str, Any]]:
        """Get list of volumes with full details"""
        try:
            if not self.available:
                return []

            # First, get the list of volume names
            result = subprocess.run(
                ["docker", "volume", "ls", "--quiet"],
                capture_output=True,
                text=True,
                timeout=15,
            )

            if result.returncode != 0:
                return []

            volume_names = [
                name.strip()
                for name in result.stdout.strip().split("\n")
                if name.strip()
            ]

            if not volume_names:
                return []

            # Then inspect all volumes to get detailed information
            inspect_result = subprocess.run(
                ["docker", "volume", "inspect"] + volume_names,
                capture_output=True,
                text=True,
                timeout=30,
            )

            if inspect_result.returncode == 0:
                try:
                    volumes_data = json.loads(inspect_result.stdout)
                    volumes = []

                    for volume in volumes_data:
                        volumes.append(
                            {
                                "name": volume.get("Name", ""),
                                "driver": volume.get("Driver", ""),
                                "mountpoint": volume.get("Mountpoint", ""),
                                "created": volume.get("CreatedAt", ""),
                                "labels": volume.get("Labels") or {},
                                "options": volume.get("Options") or {},
                                "scope": volume.get("Scope", ""),
                            }
                        )
                    return volumes
                except json.JSONDecodeError as e:
                    logger.error(f"Error parsing volume inspect data: {e}")
                    return []
            else:
                logger.error(f"Volume inspect failed: {inspect_result.stderr}")
                return []

        except Exception as e:
            logger.error(f"Error getting volumes: {e}")
            return []

    def get_networks(self) -> List[Dict[str, Any]]:
        """Get list of networks"""
        try:
            if not self.available:
                return []

            result = subprocess.run(
                ["docker", "network", "ls", "--format", "json"],
                capture_output=True,
                text=True,
                timeout=15,
            )

            if result.returncode == 0:
                networks = []
                for line in result.stdout.strip().split("\n"):
                    if line.strip():
                        try:
                            network = json.loads(line)
                            networks.append(
                                {
                                    "id": network.get("ID", ""),
                                    "name": network.get("Name", ""),
                                    "driver": network.get("Driver", ""),
                                    "scope": network.get("Scope", ""),
                                    "created": "",
                                    "containers": {},
                                }
                            )
                        except json.JSONDecodeError:
                            continue
                return networks
            else:
                return []

        except Exception as e:
            logger.error(f"Error getting networks: {e}")
            return []

    def remove_image(self, image_id: str, force: bool = False) -> bool:
        """Remove an image"""
        try:
            if not self.available:
                return False

            cmd = ["docker", "rmi", image_id]
            if force:
                cmd.insert(2, "--force")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
            )
            return result.returncode == 0

        except Exception as e:
            logger.error(f"Error removing image: {e}")
            return False

    def get_volume_size(self, mountpoint: str) -> int:
        """Get volume size using docker system df command"""
        try:
            if not self.available:
                return 0

            # Use docker system df to get volume sizes
            result = subprocess.run(
                ["docker", "system", "df", "-v", "--format", "json"],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0 and result.stdout.strip():
                try:
                    system_df = json.loads(result.stdout)
                    volumes = system_df.get("Volumes", [])

                    for volume in volumes:
                        if volume.get("MountPoint") == mountpoint:
                            size_str = volume.get("Size", "0B")
                            return self._parse_bytes_string(size_str)

                    # If not found in system df, try du command on mountpoint
                    if mountpoint and mountpoint != "":
                        du_result = subprocess.run(
                            ["du", "-sb", mountpoint],
                            capture_output=True,
                            text=True,
                            timeout=10,
                        )
                        if du_result.returncode == 0:
                            size_bytes = du_result.stdout.split()[0]
                            return int(size_bytes)

                except (json.JSONDecodeError, ValueError, IndexError):
                    logger.warning(f"Failed to parse volume size for {mountpoint}")

            return 0

        except Exception as e:
            logger.error(f"Error getting volume size for {mountpoint}: {e}")
            return 0

    def get_image_layer_count(self, image_id: str) -> int:
        """Get image layer count using docker image inspect"""
        try:
            if not self.available:
                return 0

            result = subprocess.run(
                [
                    "docker",
                    "image",
                    "inspect",
                    image_id,
                    "--format",
                    "{{.RootFS.Layers}}",
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if result.returncode == 0 and result.stdout.strip():
                # Output format is like [sha256:abc123 sha256:def456 ...]
                layers_str = result.stdout.strip()
                if layers_str and layers_str != "[]":
                    # Count the number of sha256: entries
                    return layers_str.count("sha256:")

            return 0

        except Exception as e:
            logger.error(f"Error getting layer count for image {image_id}: {e}")
            return 0

    def get_network_traffic(self, network_name: str) -> dict:
        """Get network traffic data using network interface statistics"""
        try:
            if not self.available:
                return {"rx_bytes": 0, "tx_bytes": 0}

            # Get network interface name for Docker network
            result = subprocess.run(
                [
                    "docker",
                    "network",
                    "inspect",
                    network_name,
                    "--format",
                    "{{.Options}}",
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if result.returncode != 0:
                return {"rx_bytes": 0, "tx_bytes": 0}

            # For now, return zero values as network traffic collection
            # requires more complex integration with system network interfaces
            # This is a placeholder implementation
            return {"rx_bytes": 0, "tx_bytes": 0}

        except Exception as e:
            logger.error(f"Error getting network traffic for {network_name}: {e}")
            return {"rx_bytes": 0, "tx_bytes": 0}

    def _parse_bytes_string(self, byte_str: str) -> int:
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


# Global Docker CLI client instance
docker_cli_client = DockerCLIWrapper()
