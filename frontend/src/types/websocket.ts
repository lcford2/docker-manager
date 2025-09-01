export interface WebSocketMessage {
  type: string;
  data: any;
}

export interface ContainerStatsMessage extends WebSocketMessage {
  type: "container_stats";
  data: {
    containers: ContainerStatsWithHistory[];
  };
}

export interface SystemStatsMessage extends WebSocketMessage {
  type: "system_stats";
  data: {
    containers_running: number;
    containers_paused: number;
    containers_stopped: number;
    images: number;
    server_version: string;
    total_memory: number;
    cpus: number;
  };
}

export interface ConnectionMessage extends WebSocketMessage {
  type: "connection";
  data: {
    status: string;
    user: string;
  };
}

export interface PingMessage extends WebSocketMessage {
  type: "ping";
  data: {};
}

export interface PongMessage extends WebSocketMessage {
  type: "pong";
  data: {};
}

export interface ContainerStatsWithHistory {
  id: string;
  name: string;
  status: string;
  uptime: string;
  uptime_seconds: number;
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  memory_percent: number;
  network_rx: number;
  network_tx: number;
  block_read: number;
  block_write: number;
  sparkline_data: {
    cpu: number[];
    memory: number[];
    network_rx: number[];
    network_tx: number[];
    block_read: number[];
    block_write: number[];
  };
  timestamp: string;
}

export type WebSocketConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface WebSocketConnectionStatus {
  state: WebSocketConnectionState;
  isConnected: boolean;
  error: string | null;
  connectionAttempts: number;
  lastConnected: Date | null;
  lastDataReceived: Date | null;
}

export interface WebSocketSubscription {
  id: string;
  type: string;
  callback: (data: any) => void;
}
