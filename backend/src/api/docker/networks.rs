use crate::api::RouteSpec;
use crate::api::middleware::{require_bearer_auth_middleware, require_write_permission_middleware};
use crate::api::types::{generic::GenericResponse, networks::BulkDeleteNetworksQueryParams};
use crate::lib::{errors::AppError, state::AppState};
use axum::{
    Json, Router,
    extract::{Path, State},
    middleware,
    routing::{delete, get, post},
};
use log::{info, trace};
use std::default::Default;
use std::sync::Arc;

/// Creates the router for Docker network endpoints
pub fn router() -> (Router<Arc<AppState>>, Vec<RouteSpec>) {
    // Read-only routes (any authenticated user)
    let read_routes = Router::new()
        .route("/networks", get(get_networks))
        .layer(middleware::from_fn(require_bearer_auth_middleware));

    // Write routes (readwrite or admin only)
    let write_routes = Router::new()
        .route("/networks/{name}", delete(delete_network))
        .route("/networks/bulk-delete", post(bulk_delete_networks))
        .route("/networks/prune", post(prune_networks))
        .layer(middleware::from_fn(require_write_permission_middleware));

    let r = Router::new().nest("/docker", read_routes.merge(write_routes));

    let docs = vec![
        RouteSpec {
            method: "GET",
            path: "/docker/networks".to_string(),
        },
        RouteSpec {
            method: "DELETE",
            path: "/docker/networks/{name}".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/networks/prune".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/networks/bulk-delete".to_string(),
        },
    ];
    (r, docs)
}

/// API Endpoint for getting network listing
///
/// # Arguments
/// * state - The application state
///
/// # Returns
/// JSON response with list of networks
#[utoipa::path(
    get,
    path = "/api/docker/networks",
    responses(
        (status = 200, description = "Networks retrieved successfully"),
        (status = 500, description = "Failed to retrieve networks")
    )
)]
pub async fn get_networks(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<bollard::secret::Network>>, AppError> {
    trace!("Getting networks");
    use bollard::query_parameters::ListNetworksOptionsBuilder;
    let opts = Some(ListNetworksOptionsBuilder::default().build());

    let networks = state.docker_client.list_networks(opts).await?;
    info!("Got {} networks", networks.len());
    Ok(Json(networks))
}

/// API Endpoint for deleting a network
///
/// # Arguments
/// * Path(network_name): `Path<String>`
/// * State(state): `State<Arc<AppState>>`
///
/// # Returns
/// JSON response indicating success or failure
#[utoipa::path(
    delete,
    path = "/api/docker/networks/{network_name}",
    params(
        ("network_name", description = "Name of the network to delete")
    ),
    responses(
        (status = 200, description = "Network deleted successfully", body = GenericResponse),
        (status = 500, description = "Failed to delete network")
    )
)]
pub async fn delete_network(
    Path(network_name): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<GenericResponse>, AppError> {
    trace!("Deleting network {}", network_name);
    state
        .docker_client
        .remove_network(network_name.as_str())
        .await?;
    info!("Deleted network {}", network_name);
    Ok(Json(GenericResponse {
        success: true,
        error_message: String::new(),
    }))
}

/// API Endpoint for pruning networks
///
/// # Arguments
/// * `State(state)` - The application state
///
/// # Returns
/// JSON response with pruning results
#[utoipa::path(
    post,
    path = "/api/docker/networks/prune",
    params(),
    responses(
        (status = 200, description = "Networks pruned successfully"),
        (status = 500, description = "Failed to prune networks")
    )
)]
pub async fn prune_networks(
    State(state): State<Arc<AppState>>,
) -> Result<Json<bollard::secret::NetworkPruneResponse>, AppError> {
    use bollard::query_parameters::PruneNetworksOptionsBuilder;
    let opts = Some(PruneNetworksOptionsBuilder::default().build());
    trace!("Pruning networks");
    let prune_response = state.docker_client.prune_networks(opts).await?;
    info!("Successfully pruned networks");
    Ok(Json(prune_response))
}

/// API Endpoint for deleting multiple networks
///
/// # Arguments
/// * `State(state)` - The application state
///
/// # Returns
/// JSON response with pruning results
#[utoipa::path(
    delete,
    path = "/api/docker/networks/bulk-delete",
    params(BulkDeleteNetworksQueryParams),
    responses(
        (status = 200, description = "Networks deleted successfully"),
        (status = 500, description = "Failed to delete networks")
    )
)]
pub async fn bulk_delete_networks(
    State(state): State<Arc<AppState>>,
    Json(params): Json<BulkDeleteNetworksQueryParams>,
) -> Result<Json<GenericResponse>, AppError> {
    let network_names = match params.networks {
        Some(names) => names,
        None => {
            return Err(AppError::InvalidInput(
                "Network names not provided".to_string(),
            ));
        }
    };
    let futures = network_names.into_iter().map(|name| {
        let state = state.clone();
        async move { state.docker_client.remove_network(name.as_str()).await }
    });

    futures::future::join_all(futures).await;
    Ok(Json(GenericResponse {
        success: true,
        error_message: String::new(),
    }))
}
