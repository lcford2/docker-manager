use axum::{
    extract::Request,
    http::{StatusCode, header::AUTHORIZATION},
    middleware::Next,
    response::Response,
};

use crate::lib::auth;

// Middleware that requires authentication
pub async fn require_bearer_auth_middleware(
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Try to extract the Authorization header
    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|header| header.to_str().ok());

    if let Some(auth_header) = auth_header {
        if auth_header.starts_with("Bearer ") {
            let token = &auth_header[7..]; // Remove "Bearer " prefix
            match auth::verify_jwt_token(token) {
                Ok(token_data) => {
                    let username = &token_data.claims.sub;
                    request.extensions_mut().insert(username.clone());
                    return Ok(next.run(request).await);
                }
                Err(_) => {
                    return Err(StatusCode::UNAUTHORIZED);
                }
            }
        }
    }

    // No valid Bearer token found
    Err(StatusCode::UNAUTHORIZED)
}
