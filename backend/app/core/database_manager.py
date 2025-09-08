import asyncio
import logging
from contextlib import asynccontextmanager
from enum import Enum
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.core.database import SessionLocal

logger = logging.getLogger(__name__)


class AccessType(Enum):
    READ = "read"
    WRITE = "write"


class DatabaseAccessManager:
    """
    Manages database access to ensure proper coordination between read
    and write operations.

    Key principles:
    1. Only one write operation can occur at a time
    2. Multiple reads can occur simultaneously when no write is active
    3. No reads can occur during write operations
    4. Write operations are queued and processed sequentially
    """

    def __init__(self):
        self._write_lock = asyncio.Lock()  # Ensures only one write at a time
        self._read_count = 0  # Number of active readers
        self._read_lock = asyncio.Lock()  # Protects read_count
        self._write_queue = asyncio.Queue()  # Queue for write operations
        self._active_write = False  # Flag to indicate if write is active

    async def _acquire_read_access(self) -> None:
        """Acquire read access - blocks if write is active"""
        async with self._read_lock:
            # Wait if there's an active write operation
            while self._active_write:
                await asyncio.sleep(0.01)
            self._read_count += 1
            logger.debug(f"Read access acquired. Active readers: {self._read_count}")

    async def _release_read_access(self) -> None:
        """Release read access"""
        async with self._read_lock:
            self._read_count -= 1
            logger.debug(f"Read access released. Active readers: {self._read_count}")

    async def _acquire_write_access(self) -> None:
        """Acquire write access - waits for all reads to complete"""
        await self._write_lock.acquire()

        # Wait for all active reads to complete
        while True:
            async with self._read_lock:
                if self._read_count == 0:
                    self._active_write = True
                    logger.debug("Write access acquired. All readers blocked.")
                    break
            await asyncio.sleep(0.01)

    async def _release_write_access(self) -> None:
        """Release write access"""
        async with self._read_lock:
            self._active_write = False
        self._write_lock.release()
        logger.debug("Write access released. Readers can proceed.")

    @asynccontextmanager
    async def get_session(self, access_type: AccessType = AccessType.READ):
        """
        Get a database session with proper access coordination

        Args:
            access_type: READ for read operations, WRITE for write operations
        """
        if access_type == AccessType.READ:
            await self._acquire_read_access()
        else:
            await self._acquire_write_access()

        session = None
        try:
            session = SessionLocal()

            # Configure session based on access type
            if access_type == AccessType.READ:
                # For read operations, don't auto-flush to avoid unexpected commits
                session.autoflush = False

            yield session

            # Only commit for write operations and if session is still active
            if access_type == AccessType.WRITE and session.is_active:
                try:
                    session.commit()
                    logger.debug("Write transaction committed")
                except Exception as commit_error:
                    logger.error(f"Error committing transaction: {commit_error}")
                    session.rollback()
                    raise

        except Exception as e:
            logger.error(f"Database session error ({access_type.value}): {e}")
            if session and session.is_active:
                try:
                    session.rollback()
                    logger.debug("Transaction rolled back due to error")
                except Exception as rollback_error:
                    logger.error(f"Error during rollback: {rollback_error}")
            raise
        finally:
            if session:
                try:
                    session.close()
                except Exception as close_error:
                    logger.error(f"Error closing session: {close_error}")

            if access_type == AccessType.READ:
                await self._release_read_access()
            else:
                await self._release_write_access()

    async def execute_read(self, operation: Callable[[Session], Any]) -> Any:
        """
        Execute a read operation with proper session management

        Args:
            operation: Function that takes a Session and returns result
        """
        async with self.get_session(AccessType.READ) as session:
            return operation(session)

    async def execute_write(self, operation: Callable[[Session], Any]) -> Any:
        """
        Execute a write operation with proper session management and retry logic

        Args:
            operation: Function that takes a Session and returns result
        """
        max_retries = 3
        for attempt in range(max_retries):
            try:
                async with self.get_session(AccessType.WRITE) as session:
                    result = operation(session)
                    logger.debug("Write operation completed successfully")
                    return result
            except Exception as e:
                # Check if this is a connection error that might be retryable
                error_str = str(e).lower()
                is_retryable = any(
                    keyword in error_str
                    for keyword in [
                        "connection",
                        "timeout",
                        "server closed",
                        "pool",
                        "database error",
                    ]
                )

                logger.warning(f"Write operation attempt {attempt + 1} failed: {e}")

                if attempt == max_retries - 1 or not is_retryable:
                    logger.error(
                        f"Write operation failed after {max_retries} "
                        "attempts or non-retryable error"
                    )
                    raise

                # Exponential backoff with jitter
                sleep_time = 0.5 * (2**attempt) + (0.1 * attempt)
                logger.debug(f"Retrying write operation in {sleep_time:.2f}s")
                await asyncio.sleep(sleep_time)

    def get_stats(self) -> dict:
        """Get current database access statistics"""
        return {
            "active_readers": self._read_count,
            "active_write": self._active_write,
            "write_lock_acquired": self._write_lock.locked(),
        }


# Global database access manager instance
db_manager = DatabaseAccessManager()


# Convenience functions for backward compatibility
@asynccontextmanager
async def get_read_session():
    """Get a read-only database session"""
    async with db_manager.get_session(AccessType.READ) as session:
        yield session


@asynccontextmanager
async def get_write_session():
    """Get a write database session"""
    async with db_manager.get_session(AccessType.WRITE) as session:
        yield session


async def execute_read_operation(operation: Callable[[Session], Any]) -> Any:
    """Execute a read operation with proper coordination"""
    return await db_manager.execute_read(operation)


async def execute_write_operation(operation: Callable[[Session], Any]) -> Any:
    """Execute a write operation with proper coordination"""
    return await db_manager.execute_write(operation)
