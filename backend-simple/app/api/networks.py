import docker
from fastapi import APIRouter, Depends

from app.core.exceptions import DockerConnectionError, NetworkNotFoundError
from app.core.logging import get_logger
from app.schemas.base import BulkActionResponse, BulkDeleteRequest
from app.schemas.networks import NetworkResponse
from app.services.auth import verify_token
from app.services.docker_stats import stats_collector
from app.utils import strip_sha, timing_decorator

router = APIRouter()
logger = get_logger(__name__)


@router.get("/api/networks", response_model=list[NetworkResponse])
@timing_decorator(logger=logger)
def get_networks(current_user: str = Depends(verify_token)):
    """Get Docker networks - simple implementation"""
    try:
        networks_data = stats_collector.docker_client.networks.list()
        networks = []
        # TODO : SEND MORE STATS
        for net in networks_data:
            networks.append(
                NetworkResponse(
                    id=strip_sha(net.id),
                    name=net.name,
                    driver=net.attrs.get("Driver", "bridge"),
                    scope=net.attrs.get("Scope", "local"),
                    created=net.attrs.get("Created", ""),
                    ipam=net.attrs.get("IPAM", {}),
                    internal=net.attrs.get("Internal", False),
                    attachable=net.attrs.get("Attachable", False),
                )
            )
        return networks
    except Exception as e:
        logger.error(f"Error fetching networks: {e}")
        return []


@router.post("/api/networks")
async def create_network(
    name: str,
    driver: str = "bridge",
    labels: dict[str, str] = {},
    current_user: str = Depends(verify_token),
):
    try:
        network = stats_collector.docker_client.networks.create(
            name=name, driver=driver, labels=labels
        )
        logger.info(f"Network {network.id} created successfully by user {current_user}")
        return {"message": f"Network {network.id} created successfully"}
    except docker.errors.APIError as e:
        logger.error(f"Docker API error creating network {name}: {e}")
        raise DockerConnectionError(f"Failed to create network {name}: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error creating network {name}: {e}")
        raise DockerConnectionError(f"Unexpected error creating network {name}")


@router.delete("/api/networks/{network_id}")
@timing_decorator(logger=logger)
def delete_network(network_id: str, current_user: str = Depends(verify_token)):
    try:
        network = stats_collector.docker_client.networks.get(network_id)
        network.remove()
        logger.info(f"Network {network_id} deleted successfully by user {current_user}")
        return {"message": f"Network {network_id} deleted successfully"}
    except docker.errors.NotFound:
        logger.warning(f"Network {network_id} not found for deletion")
        raise NetworkNotFoundError(network_id)
    except docker.errors.APIError as e:
        logger.error(f"Docker API error deleting network {network_id}: {e}")
        raise DockerConnectionError(f"Failed to delete network {network_id}: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error deleting network {network_id}: {e}")
        raise DockerConnectionError(f"Unexpected error deleting network {network_id}")


@router.get("/api/networks/{network_id}/inspect")
async def inspect_network(network_id: str, current_user: str = Depends(verify_token)):
    try:
        network = stats_collector.docker_client.networks.get(network_id)
        return NetworkResponse(
            id=network.id,
            name=network.name,
            driver=network.attrs.get("Driver"),
            scope=network.attrs.get("Scope"),
            created=network.attrs.get("Created"),
            ipam=network.attrs.get("IPAM"),
            internal=network.attrs.get("Internal"),
            attachable=network.attrs.get("Attachable"),
        )
    except docker.errors.APIError as e:
        logger.error(f"Docker API error inspecting network {network_id}: {e}")
        raise DockerConnectionError(f"Failed to inspect network {network_id}: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error inspecting network {network_id}: {e}")
        raise DockerConnectionError(f"Unexpected error inspecting network {network_id}")


@router.post("/api/networks/{network_id}/connect")
@timing_decorator(logger=logger)
def connect_container_to_network(
    network_id: str, container_id: str, current_user: str = Depends(verify_token)
):
    try:
        network = stats_collector.docker_client.networks.get(network_id)
        container = stats_collector.docker_client.containers.get(container_id)
        network.connect(container)
        logger.info(
            f"Container {container_id} connected to network {network_id} "
            f"by user {current_user}"
        )
        return {
            "message": f"Container {container_id} connected to network "
            f"{network_id} successfully"
        }
    except docker.errors.NotFound as e:
        logger.warning(
            f"Network {network_id} or container {container_id} not found: {e}"
        )
        raise NetworkNotFoundError(
            f"Network {network_id} or container {container_id} not found"
        )
    except docker.errors.APIError as e:
        logger.error(
            f"Docker API error connecting container {container_id} "
            f"to network {network_id}: {e}"
        )
        raise DockerConnectionError(
            f"Failed to connect container {container_id} to "
            f"network {network_id}: {str(e)}"
        )
    except Exception as e:
        logger.error(
            f"Unexpected error connecting container {container_id} "
            f"to network {network_id}: {e}"
        )
        raise DockerConnectionError(
            f"Unexpected error connecting container {container_id} "
            f"to network {network_id}"
        )


@router.post("/api/networks/{network_id}/disconnect")
@timing_decorator(logger=logger)
def disconnect_container_from_network(
    network_id: str, container_id: str, current_user: str = Depends(verify_token)
):
    try:
        network = stats_collector.docker_client.networks.get(network_id)
        container = stats_collector.docker_client.containers.get(container_id)
        network.disconnect(container)
        logger.info(
            f"Container {container_id} disconnected from network {network_id}"
            f" by user {current_user}"
        )
        return {
            "message": f"Container {container_id} disconnected from network "
            f"{network_id} successfully"
        }
    except docker.errors.NotFound as e:
        logger.warning(
            f"Network {network_id} or container {container_id} not found: {e}"
        )
        raise NetworkNotFoundError(
            f"Network {network_id} or container {container_id} not found"
        )
    except docker.errors.APIError as e:
        logger.error(
            f"Docker API error disconnecting container {container_id} from "
            f"network {network_id}: {e}"
        )
        raise DockerConnectionError(
            f"Failed to disconnect container {container_id} from network "
            f"{network_id}: {str(e)}"
        )
    except Exception as e:
        logger.error(
            f"Unexpected error disconnecting container {container_id}"
            f" from network {network_id}: {e}"
        )
        raise DockerConnectionError(
            f"Unexpected error disconnecting container {container_id}"
            f" from  network {network_id}"
        )


@router.post("/api/networks/bulk-delete", response_model=BulkActionResponse)
@timing_decorator(logger=logger)
def bulk_delete_networks(
    request: BulkDeleteRequest, current_user: str = Depends(verify_token)
):
    network_service = stats_collector.docker_client.networks
    successful = []
    failed = []
    for network_id in request.entity_ids:
        try:
            network_service.get(network_id).remove()
            successful.append(network_id)
        except docker.errors.NetworkNotFound:
            logger.warning(f"Network {network_id} not found")
        except docker.errors.APIError as e:
            logger.error(f"Error deleting network {network_id}: {e}")
            failed.append(network_id)
        except Exception as e:
            logger.error(f"Unexpected error deleting network {network_id}: {e}")
            failed.append(network_id)
    return BulkActionResponse(
        successful=successful,
        failed=failed,
        message=f"Deleted {len(successful)}/{len(request.entity_ids)} networks",
    )
