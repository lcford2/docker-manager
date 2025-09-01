from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

# Create engine with larger connection pool for background tasks and WebSocket connections
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=30,  # Increased for background tasks
    max_overflow=50,  # Increased for background tasks
    pool_pre_ping=True,  # Verify connections before use
    pool_recycle=3600,  # Recycle connections every hour
    connect_args={"connect_timeout": 60},  # Add connection timeout
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
