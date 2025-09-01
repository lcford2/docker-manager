from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class DockerContainer(Base):
    __tablename__ = "docker_containers"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False)
    image = Column(String, nullable=False)
    cpu_percent = Column(Float, default=0.0)
    memory_percent = Column(Float, default=0.0)
    memory_usage = Column(BigInteger, default=0)
    memory_limit = Column(BigInteger, default=0)
    network_rx = Column(BigInteger, default=0)
    network_tx = Column(BigInteger, default=0)
    block_read = Column(BigInteger, default=0)
    block_write = Column(BigInteger, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    is_active = Column(Boolean, default=True)

    # Relationships
    metrics = relationship("ContainerMetrics", back_populates="container")


class DockerImage(Base):
    __tablename__ = "docker_images"

    id = Column(String, primary_key=True, index=True)
    repository = Column(String, nullable=False)
    tag = Column(String, nullable=False)
    size_bytes = Column(BigInteger, default=0)
    virtual_size_bytes = Column(BigInteger, default=0)
    layer_count = Column(Integer, default=0)
    is_dangling = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    is_active = Column(Boolean, default=True)


class DockerVolume(Base):
    __tablename__ = "docker_volumes"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    driver = Column(String, nullable=False)
    size_bytes = Column(BigInteger, default=0)
    mountpoint = Column(String, nullable=False)
    volume_type = Column(String, nullable=False)
    scope = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    is_active = Column(Boolean, default=True)


class DockerNetwork(Base):
    __tablename__ = "docker_networks"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    driver = Column(String, nullable=False)
    scope = Column(String, nullable=False)
    containers_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    is_active = Column(Boolean, default=True)

    # Relationships
    metrics = relationship("NetworkMetrics", back_populates="network")


class ContainerMetrics(Base):
    __tablename__ = "container_metrics"

    id = Column(Integer, primary_key=True, index=True)
    container_id = Column(
        String, ForeignKey("docker_containers.id"), nullable=False, index=True
    )
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    cpu_percent = Column(Float, default=0.0)
    memory_usage = Column(BigInteger, default=0)
    memory_limit = Column(BigInteger, default=0)
    memory_percent = Column(Float, default=0.0)
    network_rx = Column(BigInteger, default=0)
    network_tx = Column(BigInteger, default=0)
    block_read = Column(BigInteger, default=0)
    block_write = Column(BigInteger, default=0)

    # Relationships
    container = relationship("DockerContainer", back_populates="metrics")


class NetworkMetrics(Base):
    __tablename__ = "network_metrics"

    id = Column(Integer, primary_key=True, index=True)
    network_id = Column(
        String, ForeignKey("docker_networks.id"), nullable=False, index=True
    )
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    total_rx = Column(BigInteger, default=0)
    total_tx = Column(BigInteger, default=0)
    active_connections = Column(Integer, default=0)

    # Relationships
    network = relationship("DockerNetwork", back_populates="metrics")


class SystemSnapshot(Base):
    __tablename__ = "system_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    containers_running = Column(Integer, default=0)
    containers_total = Column(Integer, default=0)
    images_count = Column(Integer, default=0)
    volumes_count = Column(Integer, default=0)
    networks_count = Column(Integer, default=0)
