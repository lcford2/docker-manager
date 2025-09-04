import logging
import time
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.exc import DisconnectionError, OperationalError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import QueuePool

from app.core.config import settings

logger = logging.getLogger(__name__)

# Create engine with enhanced connection pooling and monitoring
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,  # Optimized pool size
    max_overflow=30,  # Additional connections on demand
    pool_pre_ping=True,  # Verify connections before use
    pool_recycle=3600,  # Recycle connections every hour
    echo=False,  # Set to True for SQL debugging
    connect_args={"connect_timeout": 30},  # Connection timeout
)

# Create sessionmaker with optimized settings
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,  # Keep objects accessible after commit
)

Base = declarative_base()


# Add connection pool event listeners for monitoring
@event.listens_for(engine, "connect")
def set_connection_params(dbapi_connection, connection_record):
    """Set connection-level parameters for optimization"""
    if "postgresql" in settings.DATABASE_URL:
        with dbapi_connection.cursor() as cursor:
            cursor.execute("SET statement_timeout = '30s'")
            cursor.execute("SET idle_in_transaction_session_timeout = '60s'")


@event.listens_for(engine, "checkout")
def log_connection_checkout(dbapi_connection, connection_record, connection_proxy):
    """Log connection checkout for monitoring"""
    connection_record.info["checkout_time"] = time.time()
    logger.debug("Database connection checked out")


@event.listens_for(engine, "checkin")
def log_connection_checkin(dbapi_connection, connection_record):
    """Log connection checkin for monitoring"""
    checkout_time = connection_record.info.get("checkout_time")
    if checkout_time:
        duration = time.time() - checkout_time
        logger.debug(f"Database connection checked in after {duration:.2f}s")


def get_db() -> Session:
    """FastAPI dependency for database sessions with enhanced error handling"""
    db = SessionLocal()
    try:
        yield db
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database connection error: {e}")
        db.rollback()
        raise
    except Exception as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def get_db_context():
    """Context manager for database sessions with automatic transaction handling"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database connection error in context: {e}")
        db.rollback()
        raise
    except Exception as e:
        logger.error(f"Database transaction error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def test_connection() -> bool:
    """Test database connectivity"""
    try:
        with get_db_context() as db:
            db.execute("SELECT 1")
        logger.info("Database connection test successful")
        return True
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return False


def get_connection_pool_status() -> dict:
    """Get connection pool status for monitoring"""
    pool = engine.pool
    return {
        "pool_size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
        "invalid": pool.invalid(),
        "total_connections": pool.checkedin() + pool.checkedout(),
    }
