use axum_login::{AuthUser, AuthnBackend, UserId};
use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, TokenData, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct User {
    pub name: String,
    pub pw_hash: Vec<u8>,
}

impl AuthUser for User {
    type Id = String;

    fn id(&self) -> Self::Id {
        self.name.clone()
    }

    fn session_auth_hash(&self) -> &[u8] {
        &self.pw_hash
    }
}

#[derive(Clone, Default)]
pub struct Backend {
    pub users: HashMap<String, User>,
}

#[derive(Clone, Deserialize)]
pub struct Credentials {
    pub user_name: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // subject (user identifier)
    pub exp: usize,  // expiration time (in seconds since Unix epoch)
    pub iat: usize,  // issued at (in seconds since Unix epoch)
}

impl AuthnBackend for Backend {
    type User = User;
    type Credentials = Credentials;
    type Error = std::convert::Infallible;

    async fn authenticate(
        &self,
        Credentials {
            user_name,
            password,
        }: Self::Credentials,
    ) -> Result<Option<Self::User>, Self::Error> {
        let user = self.users.get(&user_name).cloned();
        if let Some(user) = user {
            if user.pw_hash == hash_password(&password) {
                Ok(Some(user))
            } else {
                Ok(None)
            }
        } else {
            Ok(None)
        }
    }

    async fn get_user(&self, user_name: &UserId<Self>) -> Result<Option<Self::User>, Self::Error> {
        Ok(self.users.get(user_name).cloned())
    }
}

pub fn hash_password(password: &str) -> Vec<u8> {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(password);
    hasher.finalize().to_vec()
}

// JWT secret - in production, this should come from environment variables or config
const JWT_SECRET: &[u8] = b"your-secret-key";

pub fn generate_jwt_token(user_name: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = now + Duration::hours(24); // Token expires in 24 hours

    let claims = Claims {
        sub: user_name.to_owned(),
        exp: exp.timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET),
    )
}

pub fn verify_jwt_token(token: &str) -> Result<TokenData<Claims>, jsonwebtoken::errors::Error> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(JWT_SECRET),
        &Validation::default(),
    )
}
