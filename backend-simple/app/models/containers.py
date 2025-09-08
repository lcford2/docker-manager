from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, Column, DateTime, Float, String

from app.core.database import Base


class ContainerStats(Base):
    __tablename__ = "container_stats"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    status = Column(String, nullable=False)
    image = Column(String)
    cpu_percent = Column(Float, default=0.0)
    memory_percent = Column(Float, default=0.0)
    memory_usage = Column(BigInteger)
    memory_limit = Column(BigInteger)
    network_rx = Column(BigInteger)
    network_tx = Column(BigInteger)
    block_read = Column(BigInteger)
    block_write = Column(BigInteger)
    timestamp = Column(DateTime, default=datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)
