//! Docker client utilities
//!
//! This module provides helper functions for interacting with Docker
//! to fetch statistics and resource counts.

use crate::lib::state::AppState;
use bollard::Docker;
use bollard::secret::ContainerStatsResponse;
use log::error;

/// Retrieves statistics for a single container
///
/// # Arguments
/// * `container_name` - The name of the container to get stats for
/// * `docker_client` - The Docker client to use for the request
///
/// # Returns
/// Returns a tuple containing:
/// - `StatusCode`: HTTP status code (200 OK on success, 500 on error)
/// - `Json<GetContainersStatsResponse>`: JSON response with success status and error message if applicable
pub async fn get_container_stats(
    container_name: &str,
    docker_client: &Docker,
) -> ContainerStatsResponse {
    use bollard::query_parameters::StatsOptionsBuilder;
    use futures_util::StreamExt;
    let opts = Some(
        StatsOptionsBuilder::new()
            .stream(false)
            .one_shot(false)
            .build(),
    );
    let mut stats_stream = docker_client.stats(container_name, opts).take(1);
    while let Some(stats_result) = stats_stream.next().await {
        match stats_result {
            Ok(stats) => {
                return stats;
            }
            Err(e) => {
                error!("Error fetching container stats: {e}");
                return ContainerStatsResponse::default();
            }
        }
    }
    error!("Error handling container stats stream.");
    ContainerStatsResponse::default()
}

/// Retrieves statistics for multiple containers concurrently
///
/// # Arguments
/// * `container_ids` - List of container IDs to fetch stats for
/// * `state` - Application state
///
/// # Returns
/// Vector of container statistics responses
pub async fn get_stats(
    container_ids: &Vec<String>,
    state: &AppState,
) -> Vec<ContainerStatsResponse> {
    // run this concurrently
    let futures = container_ids
        .iter()
        .map(|container_id| get_container_stats(container_id.as_str(), &state.docker_client));

    futures::future::join_all(futures).await
}

/// Gets the number of containers on the system
///
/// # Arguments
/// * `state` - Application state
/// * `all` - If true, includes stopped containers
pub async fn get_num_containers(state: &AppState, all: bool) -> usize {
    use bollard::query_parameters::ListContainersOptionsBuilder;
    let opts = Some(ListContainersOptionsBuilder::default().all(all).build());

    let result = state.docker_client.list_containers(opts).await;
    match result {
        Ok(containers) => containers.len(),
        Err(err) => {
            error!("Failed to get containers: {}", err);
            0
        }
    }
}

/// Gets the number of volumes on the system
pub async fn get_num_volumes(state: &AppState) -> usize {
    use bollard::query_parameters::ListVolumesOptionsBuilder;
    let opts = Some(ListVolumesOptionsBuilder::default().build());

    let result = state.docker_client.list_volumes(opts).await;
    match result {
        Ok(response) => response.volumes.as_ref().map_or(0, |v| v.len()),
        Err(err) => {
            error!("Failed to get volumes: {}", err);
            0
        }
    }
}

/// Gets the number of images on the system
pub async fn get_num_images(state: &AppState) -> usize {
    use bollard::query_parameters::ListImagesOptionsBuilder;
    let opts = Some(ListImagesOptionsBuilder::default().all(false).build());

    let result = state.docker_client.list_images(opts).await;
    match result {
        Ok(images) => images.len(),
        Err(err) => {
            error!("Failed to get images: {}", err);
            0
        }
    }
}

/// Gets the number of networks on the system
pub async fn get_num_networks(state: &AppState) -> usize {
    use bollard::query_parameters::ListNetworksOptionsBuilder;
    let opts = Some(ListNetworksOptionsBuilder::default().build());

    let result = state.docker_client.list_networks(opts).await;
    match result {
        Ok(networks) => networks.len(),
        Err(err) => {
            error!("Failed to get networks: {}", err);
            0
        }
    }
}

/// Gets the names of all containers on the system
pub async fn get_container_names(state: &AppState, all: bool) -> Vec<String> {
    use bollard::query_parameters::ListContainersOptionsBuilder;
    let opts = Some(ListContainersOptionsBuilder::default().all(all).build());

    let result = state.docker_client.list_containers(opts).await;
    match result {
        Ok(containers) => containers
            .into_iter()
            .map(|c| {
                c.names
                    .unwrap_or_default()
                    .first()
                    .unwrap_or(&"".to_string())
                    .clone()
            })
            .collect(),
        Err(err) => {
            error!("Failed to get container names: {}", err);
            Vec::new()
        }
    }
}
