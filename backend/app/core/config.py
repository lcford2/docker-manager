import os
from typing import List

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()


class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://docker_manager:docker_manager@postgres:5432/docker_manager",
    )

    # CORS
    ALLOWED_HOSTS: List[str] = ["http://localhost:3050", "http://frontend:3050", "*"]

    # Docker
    DOCKER_SOCKET: str = os.getenv("DOCKER_SOCKET", "unix:///var/run/docker.sock")

    # Admin user
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@dockermanager.local")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")

    # Circuit Breaker Settings
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: int = int(
        os.getenv("CIRCUIT_BREAKER_FAILURE_THRESHOLD", "3")
    )
    CIRCUIT_BREAKER_RECOVERY_TIMEOUT: int = int(
        os.getenv("CIRCUIT_BREAKER_RECOVERY_TIMEOUT", "30")
    )

    # Cache Settings
    CACHE_MAX_ITEMS: int = int(os.getenv("CACHE_MAX_ITEMS", "1000"))
    CACHE_DEFAULT_TTL: int = int(os.getenv("CACHE_DEFAULT_TTL", "300"))
    CACHE_CONTAINER_TTL: int = int(os.getenv("CACHE_CONTAINER_TTL", "30"))
    CACHE_SYSTEM_TTL: int = int(os.getenv("CACHE_SYSTEM_TTL", "60"))

    # Database Pool Settings
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "20"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "30"))
    DB_POOL_RECYCLE: int = int(os.getenv("DB_POOL_RECYCLE", "3600"))

    # Validation Limits
    MAX_BULK_OPERATIONS: int = int(os.getenv("MAX_BULK_OPERATIONS", "50"))
    MAX_HISTORICAL_DAYS: int = int(os.getenv("MAX_HISTORICAL_DAYS", "7"))
    MAX_LOG_LINES: int = int(os.getenv("MAX_LOG_LINES", "10000"))

    # Data Retention
    DATA_RETENTION_HOURS: int = int(os.getenv("DATA_RETENTION_HOURS", "24"))

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

    class Config:
        case_sensitive = True


settings = Settings()
