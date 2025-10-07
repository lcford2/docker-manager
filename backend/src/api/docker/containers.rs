use crate::api::RouteSpec;
use crate::api::middleware::{require_bearer_auth_middleware, require_write_permission_middleware};
use crate::api::types;
use crate::lib::{docker, errors::AppError, state::AppState};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    middleware,
    routing::{delete, get, post},
};
use log::{info, trace};
use std::default::Default;
use std::future::Future;
use std::sync::Arc;

/// Creates the router for Docker container endpoints
pub fn router() -> (Router<Arc<AppState>>, Vec<RouteSpec>) {
    // Read-only routes (any authenticated user)
    let read_routes = Router::new()
        .route("/containers", get(get_containers))
        .route("/containers/stats", get(get_stats))
        .layer(middleware::from_fn(require_bearer_auth_middleware));

    // Write routes (readwrite or admin only)
    let write_routes = Router::new()
        .route("/containers/{name}", delete(delete_container))
        .route("/containers/start/{name}", post(start_container))
        .route("/containers/stop/{name}", post(stop_container))
        .route("/containers/restart/{name}", post(restart_container))
        .route("/containers/bulk-stop", post(bulk_stop_containers))
        .route("/containers/bulk-start", post(bulk_start_containers))
        .route("/containers/bulk-restart", post(bulk_restart_containers))
        .route("/containers/bulk-delete", post(bulk_delete_containers))
        .layer(middleware::from_fn(require_write_permission_middleware));

    let r = Router::new().nest("/docker", read_routes.merge(write_routes));

    let docs = vec![
        RouteSpec {
            method: "GET",
            path: "/docker/containers".to_string(),
        },
        RouteSpec {
            method: "DELETE",
            path: "/docker/containers/{name}&force=false?volumes=false?link=false".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/containers/start/{name}".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/containers/stop/{name}".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/containers/restart/{name}".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/containers/bulk-stop".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/containers/bulk-start".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/containers/bulk-restart".to_string(),
        },
        RouteSpec {
            method: "POST",
            path: "/docker/containers/bulk-delete".to_string(),
        },
        RouteSpec {
            method: "GET",
            path: "/docker/containers/stats".to_string(),
        },
    ];
    (r, docs)
}

/// API Endpoint for getting a listing of containers
///
/// # Arguments
///
/// * `state` - The application state
///
/// # Returns
///
/// A JSON response containing the list of containers
#[utoipa::path(
    get,
    path = "/api/docker/containers",
    params(),
    responses(
        (status = 200, description = "OK", body = Vec<types::containers::ContainerSummary>),
        (status = 500, description = "Internal Server Error")
    )
)]
pub async fn get_containers(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<types::containers::ContainerSummary>>, AppError> {
    trace!("Getting containers");
    use bollard::query_parameters::ListContainersOptionsBuilder;
    let opts = Some(ListContainersOptionsBuilder::default().all(true).build());

    let containers = state.docker_client.list_containers(opts).await?;
    info!("Got {} containers", containers.len());
    let container_summaries: Vec<types::containers::ContainerSummary> =
        containers.into_iter().map(Into::into).collect();
    Ok(Json(container_summaries))
}

/// Internal function to handle simple container operations
///
/// # Arguments
///
/// * `name` - The name of the container
/// * `operation_name` - The name of the operation
/// * `operation` - The operation to perform
///
/// # Returns
///
/// Result indicating success or failure
async fn handle_container_operation<F, Fut>(
    name: String,
    operation_name: &str,
    operation: F,
) -> Result<Json<types::generic::GenericResponse>, AppError>
where
    F: FnOnce(String) -> Fut,
    Fut: Future<Output = Result<(), bollard::errors::Error>>,
{
    info!(
        "Handling container operation {} on {}",
        operation_name, name
    );
    operation(name.clone()).await?;
    info!(
        "Container operation {} on {} successful",
        operation_name.to_lowercase(),
        name
    );
    Ok(Json(types::generic::GenericResponse {
        success: true,
        error_message: String::new(),
    }))
}

/// API Endpoint for deleting a container
///
/// # Arguments
///
/// * `name` - The name or ID of the container to delete
/// * `params` - Query parameters controlling deletion behavior:
///   - `force`: If true, forcibly remove the container (kills running containers)
///   - `volumes`: If true, remove associated volumes
///   - `links`: If true, remove associated links
/// * `state` - The application state
///
/// # Returns
///
/// Returns a JSON response indicating success or failure
#[utoipa::path(
    delete,
    path = "/api/docker/containers/{name}",
    params(types::containers::RemoveContainerQueryParams),
    responses(
        (status = 200, description = "Container deleted successfully", body=types::generic::GenericResponse),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn delete_container(
    Path(name): Path<String>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<types::containers::RemoveContainerQueryParams>,
) -> Result<Json<types::generic::GenericResponse>, AppError> {
    handle_container_operation(name, "delete", |container_name| async move {
        use bollard::query_parameters::RemoveContainerOptionsBuilder;
        let opts = Some(
            RemoveContainerOptionsBuilder::default()
                .force(params.force.unwrap_or(false))
                .v(params.volumes.unwrap_or(false))
                .link(params.links.unwrap_or(false))
                .build(),
        );
        state
            .docker_client
            .remove_container(&container_name, opts)
            .await
    })
    .await
}

/// API Endpoint for starting a container
///
/// # Arguments
/// * `name` - The name or ID of the container to start
/// * `state` - The application state
///
/// # Returns
/// Returns a JSON response indicating success or failure
#[utoipa::path(
    post,
    path = "/api/docker/containers/start/{name}",
    responses(
        (status = 200, description = "Container started successfully", body=types::generic::GenericResponse),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn start_container(
    Path(name): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<types::generic::GenericResponse>, AppError> {
    handle_container_operation(name, "start", |container_name| async move {
        use bollard::query_parameters::StartContainerOptionsBuilder;
        let opts = Some(StartContainerOptionsBuilder::default().build());
        state
            .docker_client
            .start_container(&container_name, opts)
            .await
    })
    .await
}

/// API Endpoint for stopping a container
///
/// # Arguments
/// * `name` - The name or ID of the container to stop
/// * `state` - The application state
///
/// # Returns
/// Returns a JSON response indicating success or failure
#[utoipa::path(
    post,
    path = "/api/docker/containers/stop/{name}",
    responses(
        (status = 200, description = "Container stopped successfully", body=types::generic::GenericResponse),
        (status = 500, description = "Internal server error")
    )
)]
async fn stop_container(
    Path(name): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<types::generic::GenericResponse>, AppError> {
    handle_container_operation(name, "stop", |container_name| async move {
        use bollard::query_parameters::StopContainerOptionsBuilder;
        let opts = Some(
            StopContainerOptionsBuilder::default()
                .signal("SIGTERM")
                .build(),
        );
        state
            .docker_client
            .stop_container(&container_name, opts)
            .await
    })
    .await
}

/// API Endpoint for restarting a container
///
/// # Arguments
/// * `name` - The name or ID of the container to restart
/// * `state` - The application state
///
/// # Returns
/// Returns a JSON response indicating success or failure
#[utoipa::path(
    post,
    path = "/api/docker/containers/restart/{name}",
    responses(
        (status = 200, description = "Container restarted successfully", body=types::generic::GenericResponse),
        (status = 500, description = "Failed to restart container")
    )
)]
pub async fn restart_container(
    Path(name): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<types::generic::GenericResponse>, AppError> {
    handle_container_operation(name, "restart", |container_name| async move {
        use bollard::query_parameters::RestartContainerOptionsBuilder;
        let opts = Some(RestartContainerOptionsBuilder::default().build());
        state
            .docker_client
            .restart_container(&container_name, opts)
            .await
    })
    .await
}

/// API Endpoint for getting statistics of a set of containers
///
/// # Arguments
/// * `Query(params): Query<ContainerStatsQueryParams>` - Query parameters for container stats
/// * `State(state): State<Arc<AppState>>` - Application state
///
/// # Returns
/// Returns JSON with container statistics
#[utoipa::path(
    get,
    path = "/api/docker/containers/stats",
    params(types::containers::ContainerStatsQueryParams),
    responses(
        (status = 200, description = "Container stats retrieved successfully"),
        (status = 500, description = "Internal server error")
    )
)]
async fn get_stats(
    State(state): State<Arc<AppState>>,
    Query(params): Query<types::containers::ContainerStatsQueryParams>,
) -> Result<Json<Vec<bollard::secret::ContainerStatsResponse>>, AppError> {
    trace!("Getting container stats.");

    // check if containers are provided in the query params
    let mut containers: Vec<String> = params.containers.unwrap_or(vec![]);
    if containers.is_empty() {
        // if no containers are provided, fetch all containers
        use bollard::query_parameters::ListContainersOptionsBuilder;
        let get_opts = Some(ListContainersOptionsBuilder::default().all(true).build());
        let container_summaries = state.docker_client.list_containers(get_opts).await?;

        info!("Got {} containers", container_summaries.len());
        // unwrap the optional container names and then only push the first
        // one into the containers vector
        for container in container_summaries {
            let container_id: String = container.id.unwrap_or(String::new());
            if container_id.is_empty() {
                continue;
            }
            containers.push(container_id);
        }
    }

    let stats = docker::get_stats(&containers, &state).await;
    Ok(Json(stats))
}

/// API Endpoint for stopping several containers
///
/// # Arguments
/// * `params` - The parameters for the request
/// * `state` - The application state
///
/// # Returns
/// Returns a JSON response indicating success or failure
#[utoipa::path(
    post,
    path = "/api/docker/containers/bulk-stop",
    responses(
        (status = 200, description = "Containers stopped successfully", body=types::generic::GenericResponse),
        (status = 500, description = "Internal server error")
    )
)]
async fn bulk_stop_containers(
    State(state): State<Arc<AppState>>,
    Json(params): Json<types::containers::BulkStopContainersQueryParams>,
) -> Result<Json<types::generic::GenericResponse>, AppError> {
    let container_names: Vec<String> = match params.containers {
        Some(containers) => containers,
        None => {
            return Err(AppError::InvalidInput(
                "Container names not provided.".to_string(),
            ));
        }
    };

    let signal: String = match params.signal {
        Some(signal) => signal,
        None => "SIGTERM".to_string(),
    };

    let valid_signals = vec!["SIGTERM", "SIGINT", "SIGHUP", "SIGKILL"];
    if !valid_signals.contains(&signal.as_str()) {
        return Err(AppError::InvalidInput(
            "Invalid signal provided".to_string(),
        ));
    }

    let futures = container_names.into_iter().map(|container_name| {
        let signal = signal.clone();
        let state = state.clone();
        async move {
            use bollard::query_parameters::StopContainerOptionsBuilder;
            let opts = Some(
                StopContainerOptionsBuilder::default()
                    .signal(signal.as_str())
                    .build(),
            );
            state
                .docker_client
                .stop_container(&container_name, opts)
                .await
        }
    });

    futures::future::join_all(futures).await;

    Ok(Json(types::generic::GenericResponse {
        success: true,
        error_message: String::new(),
    }))
}

/// API Endpoint for starting several containers
///
/// # Arguments
/// * `params` - The parameters for the request
/// * `state` - The application state
///
/// # Returns
/// Returns a JSON response indicating success or failure
#[utoipa::path(
    post,
    path = "/api/docker/containers/bulk-start",
    responses(
        (status = 200, description = "Containers started successfully", body=types::generic::GenericResponse),
        (status = 500, description = "Internal server error")
    )
)]
async fn bulk_start_containers(
    State(state): State<Arc<AppState>>,
    Json(params): Json<types::containers::BulkStartContainersQueryParams>,
) -> Result<Json<types::generic::GenericResponse>, AppError> {
    let container_names: Vec<String> = match params.containers {
        Some(containers) => containers,
        None => docker::get_container_names(&state.clone(), false).await,
    };

    let futures = container_names.into_iter().map(|container_name| {
        let state = state.clone();
        async move {
            use bollard::query_parameters::StartContainerOptionsBuilder;
            let opts = Some(StartContainerOptionsBuilder::default().build());
            state
                .docker_client
                .start_container(&container_name, opts)
                .await
        }
    });

    futures::future::join_all(futures).await;

    Ok(Json(types::generic::GenericResponse {
        success: true,
        error_message: String::new(),
    }))
}

/// API Endpoint for restarting several containers
///
/// # Arguments
/// * `params` - The parameters for the request
/// * `state` - The application state
///
/// # Returns
/// Returns a JSON response indicating success or failure
#[utoipa::path(
    post,
    path = "/api/docker/containers/bulk-restart",
    responses(
        (status = 200, description = "Containers restarted successfully", body=types::generic::GenericResponse),
        (status = 500, description = "Internal server error")
    )
)]
async fn bulk_restart_containers(
    State(state): State<Arc<AppState>>,
    Json(params): Json<types::containers::BulkStartContainersQueryParams>,
) -> Result<Json<types::generic::GenericResponse>, AppError> {
    let container_names: Vec<String> = match params.containers {
        Some(containers) => containers,
        None => docker::get_container_names(&state.clone(), false).await,
    };

    let futures = container_names.into_iter().map(|container_name| {
        let state = state.clone();
        async move {
            use bollard::query_parameters::RestartContainerOptionsBuilder;
            let opts = Some(RestartContainerOptionsBuilder::default().build());
            state
                .docker_client
                .restart_container(&container_name, opts)
                .await
        }
    });

    futures::future::join_all(futures).await;

    Ok(Json(types::generic::GenericResponse {
        success: true,
        error_message: String::new(),
    }))
}

/// API Endpoint for deleting several containers
///
/// # Arguments
/// * `params` - The parameters for the request
/// * `state` - The application state
///
/// # Returns
/// Returns a JSON response indicating success or failure
#[utoipa::path(
    post,
    path = "/api/docker/containers/bulk-delete",
    responses(
        (status = 200, description = "Containers deleted successfully", body=types::generic::GenericResponse),
        (status = 500, description = "Internal server error")
    )
)]
async fn bulk_delete_containers(
    State(state): State<Arc<AppState>>,
    Json(params): Json<types::containers::BulkDeleteContainersQueryParams>,
) -> Result<Json<types::generic::GenericResponse>, AppError> {
    let container_names: Vec<String> = match params.containers {
        Some(containers) => containers,
        None => docker::get_container_names(&state.clone(), false).await,
    };

    let force = params.force.unwrap_or(false);
    let volumes = params.volumes.unwrap_or(false);
    let links = params.links.unwrap_or(false);

    let futures = container_names.into_iter().map(|container_name| {
        let state = state.clone();
        async move {
            use bollard::query_parameters::RemoveContainerOptionsBuilder;
            let opts = Some(
                RemoveContainerOptionsBuilder::default()
                    .force(force)
                    .v(volumes)
                    .link(links)
                    .build(),
            );
            state
                .docker_client
                .remove_container(&container_name, opts)
                .await
        }
    });

    futures::future::join_all(futures).await;

    Ok(Json(types::generic::GenericResponse {
        success: true,
        error_message: String::new(),
    }))
}
