use crate::api::RouteSpec;
use crate::lib::config::{UIConfig, WebSocketConfig};
use crate::lib::state::AppState;
use axum::{Json, Router, extract::State, routing::get};
use serde::Serialize;
use std::sync::Arc;

/// Frontend configuration response
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendConfig {
    pub websocket: WebSocketConfig,
    pub ui: UIConfig,
}

/// GET /api/config - Returns frontend configuration
/// This endpoint serves configuration values that the frontend needs
pub async fn get_config(State(state): State<Arc<AppState>>) -> Json<FrontendConfig> {
    Json(FrontendConfig {
        websocket: state.config.websocket.clone(),
        ui: state.config.ui.clone(),
    })
}

pub fn router() -> (Router<Arc<AppState>>, Vec<RouteSpec>) {
    let r = Router::new().route("/config", get(get_config));

    let docs = vec![RouteSpec {
        method: "GET",
        path: "/config".to_string(),
    }];

    (r, docs)
}
