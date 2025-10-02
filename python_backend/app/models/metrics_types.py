from typing import Dict, List

from pydantic import BaseModel


class ContainerMetricsPoint(BaseModel):
    """Single metrics data point with timestamp"""

    timestamp: str
    cpu_percent: float
    memory_percent: float
    memory_usage: int
    memory_limit: int
    network_rx: int
    network_tx: int
    block_read: int
    block_write: int


class SparklineData(BaseModel):
    """Sparkline data for UI components"""

    cpu: List[float]
    memory: List[float]
    network_rx: List[int]
    network_tx: List[int]
    block_read: List[int]
    block_write: List[int]


class ContainerStatsWithHistory(BaseModel):
    """Enhanced container stats with uptime and sparkline data"""

    id: str
    name: str
    status: str
    uptime: str
    uptime_seconds: int
    cpu_percent: float
    memory_usage: int
    memory_limit: int
    memory_percent: float
    network_rx: int
    network_tx: int
    block_read: int
    block_write: int
    sparkline_data: SparklineData
    timestamp: str


class ContainerMetricsHistory(BaseModel):
    """Historical metrics data for a container"""

    container_id: str
    container_name: str
    data_points: List[ContainerMetricsPoint]
    start_time: str
    end_time: str
    interval_seconds: int = 5


class WebSocketContainerStatsMessage(BaseModel):
    """WebSocket message for container stats"""

    type: str = "container_stats"
    data: Dict[str, List[ContainerStatsWithHistory]]
