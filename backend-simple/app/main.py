import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth,
    containers,
    images,
    networks,
    profiler,
    system,
    volumes,
    websocket,
)
from app.core.config import settings
from app.core.database import create_tables
from app.core.exceptions import (
    DockerManagerException,
    docker_manager_exception_handler,
    generic_exception_handler,
)
from app.core.logging import get_logger, setup_logging
from app.core.profiling import ProfilerMiddleware
from app.services.docker_stats import (
    run_cleanup_loop,
    run_collection_loop,
    stats_collector,
)

# Configure logging
setup_logging()
logger = get_logger(__name__)


# Background tasks
async def start_background_tasks():
    logger.info("Starting background tasks")

    # Start collection and cleanup tasks
    collection_task = asyncio.create_task(run_collection_loop())
    cleanup_task = asyncio.create_task(run_cleanup_loop())

    return collection_task, cleanup_task


# Application lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Docker Manager API")
    create_tables()

    # Start background tasks
    tasks = await start_background_tasks()

    yield

    # Shutdown
    logger.info("Shutting down Docker Manager API")
    for task in tasks:
        task.cancel()


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="API for managing Docker containers and viewing stats",
    version=settings.app_version,
    lifespan=lifespan,
)

# Exception handlers
app.add_exception_handler(DockerManagerException, docker_manager_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Profiling middleware (development only)
if settings.enable_profiler or settings.debug:
    profiler_middleware = ProfilerMiddleware(app, enabled=True)
    app.add_middleware(type(profiler_middleware), enabled=True)
    logger.info("Profiling middleware enabled")

# CORS middleware
cors_origins = ["*"] if settings.cors_allow_all_origins else settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# routes

app.include_router(auth.router)
app.include_router(containers.router)
app.include_router(images.router)
app.include_router(networks.router)
app.include_router(system.router)
app.include_router(volumes.router)
app.include_router(websocket.router)

# Add profiler routes in development
if settings.enable_profiler or settings.debug:
    app.include_router(profiler.router)


@app.get("/api/health")
async def health_check():
    docker_status = stats_collector.get_docker_client_status()
    return {
        "status": "healthy" if docker_status["status"] == "connected" else "degraded",
        "docker": docker_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
    )
