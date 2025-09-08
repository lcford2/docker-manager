import docker
from fastapi import APIRouter, Depends

from app.core.exceptions import DockerConnectionError, NetworkNotFoundError
from app.core.logging import get_logger
from app.schemas.base import BulkDeleteRequest, BulkDeleteResponse
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


@router.post("/api/networks/bulk-delete", response_model=BulkDeleteResponse)
@timing_decorator(logger=logger)
def bulk_delete_networks(
    request: BulkDeleteRequest, current_user: str = Depends(verify_token)
):
    network_service = stats_collector.docker_client.networks
    deleted = []
    failed = []
    for network_id in request.entity_ids:
        try:
            network_service.get(network_id).remove()
            deleted.append(network_id)
        except docker.errors.NetworkNotFound:
            logger.warning(f"Network {network_id} not found")
        except docker.errors.APIError as e:
            logger.error(f"Error deleting network {network_id}: {e}")
            failed.append(network_id)
        except Exception as e:
            logger.error(f"Unexpected error deleting network {network_id}: {e}")
            failed.append(network_id)
    return {"deleted": deleted, "failed": failed}
