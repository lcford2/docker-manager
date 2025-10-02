//! API module containing all HTTP endpoints
//!
//! This module defines the API structure including health checks,
//! Docker resource management (containers, images, networks, volumes),
//! and database statistics endpoints.

use crate::lib::state::AppState;
use axum::Router;
use std::sync::Arc;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_swagger_ui::SwaggerUi;

pub mod auth;
pub mod health;
pub mod middleware;
pub mod websocket;
pub mod db {
    pub mod container_stats;
    pub mod system_stats;
}
pub mod docker {
    pub mod containers;
    pub mod images;
    pub mod networks;
    pub mod volumes;
}
pub mod types {
    pub mod containers;
    pub mod db;
    pub mod generic;
    pub mod images;
    pub mod networks;
    pub mod volumes;
}

/// Specification for an API route
#[derive(Clone, Debug)]
pub struct RouteSpec {
    pub method: &'static str,
    pub path: String,
}

#[derive(OpenApi)]
#[openapi(
    paths(
        health::health_check,
        docker::containers::get_containers,
        docker::containers::delete_container,
        docker::containers::start_container,
        docker::containers::stop_container,
        docker::containers::restart_container,
        docker::containers::get_stats,
        docker::networks::get_networks,
        docker::networks::delete_network,
        docker::networks::prune_networks,
        docker::volumes::get_volumes,
        docker::volumes::prune_volumes,
        docker::images::get_images,
        docker::images::prune_images,
        docker::images::pull_image,
        db::system_stats::get_system_stats,
        db::container_stats::get_container_stats,
    ),
    components(
        schemas(
            types::containers::ContainerSummary,
            types::containers::RemoveContainerQueryParams,
            types::containers::ContainerStatsQueryParams,
            types::db::ContainerStatsQuery,
            types::db::SystemStatsQuery,
            types::db::ContainerStat,
            types::db::SystemStat,
            types::db::ContainerStatsResponse,
            types::db::SystemStatsResponse,
            types::generic::HealthResponse,
            types::generic::GenericResponse,
        ),
    ),
    tags((name = "Docker Manager"))
)]
pub struct ApiDoc;

/// Creates the main API router combining all sub-routers
pub fn router(state: Arc<AppState>) -> (Router<Arc<AppState>>, Vec<RouteSpec>) {
    let (auth_router, auth_routes) = auth::router();
    let (health_router, health_routes) = health::router();
    let (containers_router, containers_routes) = docker::containers::router();
    let (volumes_router, volumes_routes) = docker::volumes::router();
    let (images_router, images_routes) = docker::images::router();
    let (networks_router, networks_routes) = docker::networks::router();
    let (c_stats_router, c_stats_routes) = db::container_stats::router();
    let (s_stats_router, s_stats_routes) = db::system_stats::router();

    // WebSocket router uses broadcaster from state
    let (ws_router, ws_routes) = websocket::router();
    let ws_router = ws_router.with_state(state.broadcaster.clone());

    let app_router = Router::new()
        .merge(auth_router)
        .merge(health_router)
        .merge(containers_router)
        .merge(volumes_router)
        .merge(networks_router)
        .merge(images_router)
        .merge(c_stats_router)
        .merge(s_stats_router)
        .merge(ws_router);

    let (openapi_router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi()).split_for_parts();

    let router = openapi_router
        .merge(SwaggerUi::new("/docs").url("/api/api-docs/openapi.json", api.clone()))
        .route(
            "/api-docs/openapi.json",
            axum::routing::get(|| async move { axum::Json(ApiDoc::openapi()) }),
        )
        .merge(app_router);

    let routes = health_routes
        .into_iter()
        .chain(auth_routes)
        .chain(containers_routes)
        .chain(volumes_routes)
        .chain(images_routes)
        .chain(networks_routes)
        .chain(c_stats_routes)
        .chain(s_stats_routes)
        .chain(ws_routes)
        .collect();
    (router, routes)
}
