export interface ContainerMetricsPoint {
  timestamp: string;
  cpu_percent: number;
  memory_percent: number;
  memory_usage: number;
  memory_limit: number;
  network_rx: number;
  network_tx: number;
  block_read: number;
  block_write: number;
}

export interface SparklineData {
  cpu: number[];
  memory: number[];
  network_rx: number[];
  network_tx: number[];
  block_read: number[];
  block_write: number[];
}

export interface ContainerStatsWithHistory {
  id: string;
  names: string;
  image?: string; // Add optional image property
  status: string;
  uptime: string;
  uptime_seconds: number;
  cpu_percent?: number;
  memory_usage?: number;
  memory_limit?: number;
  memory_percent?: number;
  network_rx?: number;
  network_tx?: number;
  block_read?: number;
  block_write?: number;
  sparkline_data?: SparklineData;
  timestamp: string;
}

export interface ContainerMetricsHistory {
  container_id: string;
  container_name?: string;
  data_points: ContainerMetricsPoint[];
  start_time: string;
  end_time: string;
  interval_seconds: number;
}

export interface WebSocketContainerStatsMessage {
  type: "container_stats";
  data: {
    containers: ContainerStatsWithHistory[];
  };
}

export interface MetricSparklineProps {
  data: number[];
  color: string;
  label: string;
  unit?: string;
  height?: number;
  width?: number;
}

export interface ContainerCardProps {
  container: ContainerStatsWithHistory;
  onDetailsClick: (containerId: string) => void;
  isSelected?: boolean;
  layout?: "grid" | "list";
}

export interface ContainerGridProps {
  containers: ContainerStatsWithHistory[];
  onContainerClick: (containerId: string) => void;
  selectedContainer?: string | null;
}

export type ViewMode = "grid" | "list";
