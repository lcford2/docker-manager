import json
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from app.core.config import settings
from app.core.logging import get_logger
from app.services.docker_stats import stats_collector

logger = get_logger(__name__)

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(
            f"WebSocket connected. Total connections: {len(self.active_connections)}"
        )

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(
            f"WebSocket disconnected. Total connections: {len(self.active_connections)}"
        )

    async def send_to_all(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        # Remove disconnected clients
        for connection in disconnected:
            self.disconnect(connection)


# global connection manager
manager = ConnectionManager()


@router.websocket("/api/ws/connect")
async def websocket_endpoint(websocket: WebSocket, token: str):
    # Simple token verification for WebSocket
    try:
        # Extract and verify token

        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        username = payload.get("sub")
        if username is None:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except JWTError:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await manager.connect(websocket)

    try:
        # Send initial data
        cached = stats_collector.get_cached_stats()
        if cached:
            if "containers" in cached:
                # Convert datetime objects to strings for JSON serialization
                containers_json = []
                for container in cached["containers"]:
                    container_copy = container.copy()
                    if isinstance(container_copy.get("timestamp"), datetime):
                        container_copy["timestamp"] = container_copy[
                            "timestamp"
                        ].isoformat()
                    containers_json.append(container_copy)

                await websocket.send_json(
                    {"type": "container_stats", "data": {"containers": containers_json}}
                )
            if "system" in cached:
                system_copy = cached["system"].copy()
                if isinstance(system_copy.get("timestamp"), datetime):
                    system_copy["timestamp"] = system_copy["timestamp"].isoformat()

                await websocket.send_json({"type": "system_stats", "data": system_copy})

        # Keep connection alive and handle client messages
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # Handle ping/pong
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
