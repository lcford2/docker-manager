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

    class Config:
        case_sensitive = True


settings = Settings()
