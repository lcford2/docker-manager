import asyncio
import json
import logging

import redis.asyncio as redis
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.redis_client import redis_client
from app.core.security import verify_token
from app.services.auth_service import AuthService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/connect")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """WebSocket endpoint for real-time updates"""

    username = verify_token(token)
    if not username:
        await websocket.close(code=4001, reason="Invalid token")
        return

    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        auth_service = AuthService(db)
        user = auth_service.get_user_by_username(username)
        if not user or not user.is_active:
            await websocket.close(code=4002, reason="Invalid user")
            return
        if not auth_service.check_permission(user, "read"):
            await websocket.close(code=4003, reason="Insufficient permissions")
            return
    finally:
        db.close()

    await websocket.accept()

    # Shared state to coordinate between tasks
    connection_active = {"active": True}

    async def redis_listener():
        pubsub = None
        try:
            pubsub = redis_client.pubsub()
            await pubsub.subscribe("container_stats", "system_stats")
            logger.info("Redis pubsub subscribed to container_stats and system_stats")

            while connection_active["active"]:
                try:
                    message = await pubsub.get_message(
                        ignore_subscribe_messages=True, timeout=1.0
                    )
                    if message and message["data"] and connection_active["active"]:
                        channel = message["channel"]
                        data = message["data"]
                        logger.debug(f"Received Redis message on channel {channel}")

                        # Check if websocket is still connected before sending
                        if (
                            websocket.client_state.name == "CONNECTED"
                            and connection_active["active"]
                        ):
                            try:
                                if channel == "container_stats":
                                    await websocket.send_json(
                                        {
                                            "type": "container_stats",
                                            "data": json.loads(data),
                                        }
                                    )
                                elif channel == "system_stats":
                                    await websocket.send_json(
                                        {
                                            "type": "system_stats",
                                            "data": json.loads(data),
                                        }
                                    )
                            except Exception as send_error:
                                logger.warning(
                                    f"Failed to send WebSocket message: {send_error}"
                                )
                                connection_active["active"] = False
                                break  # Exit the loop if we can't send messages
                        else:
                            logger.debug(
                                "WebSocket not connected, stopping Redis listener"
                            )
                            connection_active["active"] = False
                            break
                except (redis.ConnectionError, redis.TimeoutError) as e:
                    logger.error(f"Redis connection error: {e}")
                    await asyncio.sleep(2)
                except asyncio.TimeoutError:
                    # Timeout is expected, continue listening
                    continue
                except WebSocketDisconnect:
                    logger.info("WebSocket disconnected during Redis listener")
                    break
                except Exception as e:
                    logger.error(f"Error in Redis listener: {e}")
                    break
        except Exception as e:
            logger.error(f"Failed to establish Redis pubsub connection: {e}")
        finally:
            if pubsub:
                try:
                    await pubsub.aclose()
                except Exception as e:
                    logger.error(f"Error closing Redis pubsub: {e}")

    async def client_listener():
        try:
            while connection_active["active"]:
                try:
                    data = await websocket.receive_text()
                    # Handle client messages if needed, e.g., ping/pong
                    message = json.loads(data)
                    if message.get("type") == "ping" and connection_active["active"]:
                        if websocket.client_state.name == "CONNECTED":
                            await websocket.send_json({"type": "pong"})
                except asyncio.TimeoutError:
                    continue
                except WebSocketDisconnect:
                    logger.info("WebSocket client disconnected")
                    connection_active["active"] = False
                    break
        except Exception as e:
            logger.error(f"Error in client listener: {e}")
            connection_active["active"] = False

    listener_task = asyncio.create_task(redis_listener())
    client_task = asyncio.create_task(client_listener())

    try:
        await asyncio.gather(listener_task, client_task, return_exceptions=True)
    except Exception as e:
        logger.error(f"WebSocket connection closed with error: {e}")
    finally:
        # Signal all tasks to stop
        connection_active["active"] = False

        # Cancel tasks if they're still running
        if not listener_task.done():
            listener_task.cancel()
        if not client_task.done():
            client_task.cancel()

        # Wait for tasks to complete cancellation with timeout
        try:
            await asyncio.wait_for(
                asyncio.gather(listener_task, client_task, return_exceptions=True),
                timeout=2.0,
            )
        except asyncio.TimeoutError:
            logger.warning("Tasks did not complete cancellation within timeout")
        except Exception:
            pass

        # Only close WebSocket if it's not already closed
        try:
            if websocket.client_state.name not in ["DISCONNECTED", "DISCONNECTING"]:
                await websocket.close()
                logger.debug("WebSocket connection closed cleanly")
        except Exception as e:
            logger.debug(f"WebSocket already closed or error during close: {e}")
