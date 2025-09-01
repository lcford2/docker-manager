from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import json
import logging
from app.services.websocket_service import manager
from app.core.security import verify_token
from app.services.auth_service import AuthService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/connect")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """WebSocket endpoint for real-time updates"""

    # Authenticate user via token (no DB dependency here)
    username = verify_token(token)
    if not username:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Create a temporary database session for authentication only
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        auth_service = AuthService(db)
        user = auth_service.get_user_by_username(username)
        if not user or not user.is_active:
            await websocket.close(code=4002, reason="Invalid user")
            return

        # Check if user has read permissions
        if not auth_service.check_permission(user, "read"):
            await websocket.close(code=4003, reason="Insufficient permissions")
            return

        # Store user info for later use (without keeping DB connection)
        user_info = {"username": user.username, "role": user.role}
    finally:
        # Always close the database session after authentication
        db.close()

    await manager.connect(websocket)

    try:
        # Send connection confirmation
        await manager.send_personal_message(
            json.dumps(
                {
                    "type": "connection",
                    "data": {"status": "connected", "user": user_info["username"]},
                }
            ),
            websocket,
        )

        # Send initial data immediately
        await manager.send_initial_data_to_connection(websocket)

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for messages from client
                data = await websocket.receive_text()
                message = json.loads(data)

                # Handle different message types
                if message.get("type") == "ping":
                    await manager.send_personal_message(
                        json.dumps({"type": "pong", "data": {}}), websocket
                    )
                elif message.get("type") == "request_stats":
                    # Send immediate stats update
                    await manager.send_system_stats()
                    await manager.send_container_stats()

            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                logger.warning("Invalid JSON received from WebSocket client")
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}")

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        manager.disconnect(websocket)
