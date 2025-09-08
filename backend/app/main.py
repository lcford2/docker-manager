import asyncio
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, containers, images, networks, system, volumes, websocket
from app.core.config import settings
from app.core.database import Base, engine
from app.services.background_tasks import background_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Docker Manager API")
    # Create database tables
    Base.metadata.create_all(bind=engine)

    # Start background collection tasks
    logger.info("Starting background collection tasks")
    background_task = asyncio.create_task(background_manager.start_collection_tasks())

    yield

    # Shutdown
    logger.info("Shutting down Docker Manager API")
    background_manager.shutdown()
    try:
        await asyncio.wait_for(background_task, timeout=30.0)
    except asyncio.TimeoutError:
        logger.warning("Background tasks did not shut down gracefully")
        background_task.cancel()


app = FastAPI(
    title="Docker Manager API",
    description="API for managing Docker containers, images, volumes, and networks",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(containers.router, prefix="/api/containers", tags=["containers"])
app.include_router(volumes.router, prefix="/api/volumes", tags=["volumes"])
app.include_router(images.router, prefix="/api/images", tags=["images"])
app.include_router(networks.router, prefix="/api/networks", tags=["networks"])
app.include_router(websocket.router, prefix="/api/ws", tags=["websocket"])
app.include_router(system.router, prefix="/api/system", tags=["system"])


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "docker-manager-api"}


@app.get("/api/docker-status")
async def docker_status():
    """Check Docker connection status"""
    try:
        from app.core.docker_cli import docker_cli_client

        return docker_cli_client.get_system_info()
    except Exception as e:
        return {"status": "disconnected", "error": str(e)}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=6500, reload=True, log_level="info")
