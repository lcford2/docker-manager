import { useState, useEffect, useRef, useCallback } from "react";

import { ContainerStatsWithHistory } from "../types/metrics";
import { hasContainerDataChanged } from "../utils/dataComparison";

interface UseWebSocketOptions {
  url: string;
  token: string;
  onContainerStats?: (containers: ContainerStatsWithHistory[]) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  containers: ContainerStatsWithHistory[];
  error: string | null;
  reconnect: () => void;
}

export const useWebSocket = ({
  url,
  token,
  onContainerStats,
  reconnectAttempts = 5,
  reconnectInterval = 3000,
}: UseWebSocketOptions): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [containers, setContainers] = useState<ContainerStatsWithHistory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimeout = useRef<any>(null);
  const previousContainers = useRef<ContainerStatsWithHistory[]>([]);

  const connect = useCallback(() => {
    try {
      const wsUrl = `${url}?token=${encodeURIComponent(token)}`;
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.debug("WebSocket connected");
        setIsConnected(true);
        setError(null);
        reconnectCount.current = 0;

        // Initial data will be sent automatically by server
        console.debug("WebSocket connected, waiting for initial data...");
      };

      ws.current.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "container_stats" && message.data?.containers) {
            const containerStats = message.data
              .containers as ContainerStatsWithHistory[];

            // Only update if data has actually changed
            if (
              hasContainerDataChanged(
                previousContainers.current,
                containerStats,
              )
            ) {
              previousContainers.current = containerStats;
              setContainers(containerStats);
              onContainerStats?.(containerStats);
              console.debug(
                "Container stats updated via WebSocket:",
                containerStats.length,
                "containers",
              );
            }
          } else if (message.type === "system_stats") {
            console.debug("System stats received via WebSocket:", message.data);
            // System stats are handled by the Dashboard component directly if needed
          } else if (message.type === "connection") {
            console.debug("WebSocket connection confirmed:", message.data);
          }
        } catch (err: any) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.current.onclose = () => {
        console.debug("WebSocket disconnected");
        setIsConnected(false);

        // Attempt reconnection if we haven't exceeded max attempts
        if (reconnectCount.current < reconnectAttempts) {
          reconnectCount.current += 1;
          const delay =
            reconnectInterval * Math.pow(1.5, reconnectCount.current - 1);

          console.debug(
            `Attempting to reconnect in ${delay}ms (attempt ${reconnectCount.current}/${reconnectAttempts})`,
          );

          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setError("Failed to connect to WebSocket after multiple attempts");
        }
      };

      ws.current.onerror = (err: Event) => {
        console.error("WebSocket error:", err);
        setError("WebSocket connection error");
      };
    } catch (err) {
      console.error("Failed to create WebSocket connection:", err);
      setError("Failed to create WebSocket connection");
    }
  }, [url, token, onContainerStats, reconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    setIsConnected(false);
    reconnectCount.current = 0;
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectCount.current = 0;
    setError(null);
    connect();
  }, [connect, disconnect]);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Send ping every 30 seconds to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  return {
    isConnected,
    containers,
    error,
    reconnect,
  };
};
