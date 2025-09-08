from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = (
        "postgresql://docker_manager:docker_manager@postgres:5432/docker_manager"
    )
    database_pool_size: int = 5
    database_max_overflow: int = 10

    # API Server
    api_host: str = "0.0.0.0"
    api_port: int = 6500

    # CORS
    cors_origins: List[str] = ["http://localhost:3050", "http://frontend:3050"]
    cors_allow_credentials: bool = True
    cors_allow_all_origins: bool = False  # Set to True for "*" behavior

    # Cache
    cache_ttl_seconds: int = 10

    # Redis (when implemented)
    redis_url: str = "redis://redis:6379/0"

    # Security
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Docker
    docker_collection_interval: int = 5  # seconds
    docker_cleanup_interval: int = 3600  # 1 hour

    # Application
    app_name: str = "Docker Manager API"
    app_version: str = "0.1.0"
    debug: bool = True

    # Profiling (development only)
    enable_profiler: bool = True
    profiler_slow_request_threshold_ms: int = 1000

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
