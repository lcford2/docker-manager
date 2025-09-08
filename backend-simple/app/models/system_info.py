from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer

from app.core.database import Base


class SystemInfo(Base):
    __tablename__ = "system_info"

    id = Column(Integer, primary_key=True, autoincrement=True)
    containers_running = Column(Integer, default=0)
    containers_total = Column(Integer, default=0)
    images_count = Column(Integer, default=0)
    volumes_count = Column(Integer, default=0)
    networks_count = Column(Integer, default=0)
    timestamp = Column(DateTime, default=datetime.now(timezone.utc))
