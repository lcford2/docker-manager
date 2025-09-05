import { useCallback, useEffect, useState } from "react";

import { useWebSocketContext } from "../contexts/WebSocketContext";
import { apiCacheService } from "../services/apiCacheService";
import { ContainerStatsWithHistory } from "../types/metrics";

interface UseSharedWebSocketOptions {
  onContainerStats?: (containers: ContainerStatsWithHistory[]) => void;
  onSystemStats?: (stats: any) => void;
  enableRestFallback?: boolean;
}

interface UseSharedWebSocketReturn {
  isConnected: boolean;
  containers: ContainerStatsWithHistory[];
  systemStats: any;
  error: string | null;
  loading: boolean;
  reconnect: () => void;
  refresh: () => void;
}

export const useSharedWebSocket = (
  options: UseSharedWebSocketOptions = {},
): UseSharedWebSocketReturn => {
  const {
    onContainerStats,
    onSystemStats,
    enableRestFallback = true,
  } = options;

  const {
    isConnected,
    connectionStatus,
    containers: wsContainers,
    systemStats: wsSystemStats,
    reconnect: wsReconnect,
  } = useWebSocketContext();

  const [containers, setContainers] = useState<ContainerStatsWithHistory[]>([]);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Update containers when WebSocket data changes
  useEffect(() => {
    if (wsContainers && wsContainers.length > 0) {
      setContainers(wsContainers);
      setLoading(false);
      setError(null);
      onContainerStats?.(wsContainers);
    }
  }, [wsContainers, onContainerStats]);

  // Update system stats when WebSocket data changes
  useEffect(() => {
    if (wsSystemStats) {
      setSystemStats(wsSystemStats);
      onSystemStats?.(wsSystemStats);
    }
  }, [wsSystemStats, onSystemStats]);

  // Handle connection status changes
  useEffect(() => {
    if (connectionStatus.state === "error") {
      setError(connectionStatus.error);
    } else {
      setError(null);
    }

    // Set loading based on connection state
    if (
      connectionStatus.state === "connecting" ||
      connectionStatus.state === "reconnecting"
    ) {
      setLoading(true);
    } else if (
      connectionStatus.state === "connected" &&
      containers.length > 0
    ) {
      setLoading(false);
    }
  }, [connectionStatus, containers.length]);

  // REST API fallback for initial data loading
  const fetchInitialData = useCallback(async () => {
    if (!enableRestFallback) return;

    try {
      setLoading(true);
      setError(null);

      // Check cache first
      const cachedContainers =
        apiCacheService.get<ContainerStatsWithHistory[]>("containers");
      if (cachedContainers) {
        console.log("Cached containers:", cachedContainers);
        cachedContainers.forEach((container, index) => {
          console.log(
            `Cached Container ${index} (${container.name}): sparkline_data =`,
            container.sparkline_data,
          );
          if (container.sparkline_data) {
            console.log(
              `- CPU history length: ${container.sparkline_data.cpu?.length || 0}`,
            );
            console.log(
              `- Memory history length: ${container.sparkline_data.memory?.length || 0}`,
            );
          }
        });
      }
      if (cachedContainers) {
        setContainers(cachedContainers);
        setLoading(false);
        return;
      }

      // Fetch from REST API
      const response = await fetch("/api/containers", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate container data before setting
      if (Array.isArray(data)) {
        // Ensure all containers have required properties
        const validatedData = data.map((container) => ({
          ...container,
          cpu_percent: container.cpu_percent ?? 0.0,
          memory_percent: container.memory_percent ?? 0.0,
          memory_usage: container.memory_usage ?? 0,
          memory_limit: container.memory_limit ?? 0,
          network_rx: container.network_rx ?? 0,
          network_tx: container.network_tx ?? 0,
          block_read: container.block_read ?? 0,
          block_write: container.block_write ?? 0,
          sparkline_data: container.sparkline_data ?? {
            cpu: [],
            memory: [],
            network_rx: [],
            network_tx: [],
            block_read: [],
            block_write: [],
          },
        }));

        // Cache the validated data
        apiCacheService.setWithConfig(
          "containers",
          validatedData,
          "containers",
        );

        setContainers(validatedData);
        setLoading(false);
        onContainerStats?.(validatedData);
      } else {
        throw new Error("Invalid container data format");
      }
    } catch (err: any) {
      console.error("Failed to fetch initial container data:", err);
      setError(err.message || "Failed to fetch container data");
      setLoading(false);
    }
  }, [enableRestFallback, onContainerStats]);

  // Fetch system info as fallback
  const fetchSystemInfo = useCallback(
    async (retryCount = 0) => {
      if (!enableRestFallback) return;

      try {
        // Check cache first
        const cachedSystemInfo = apiCacheService.get("systemInfo");
        if (cachedSystemInfo) {
          setSystemStats(cachedSystemInfo);
          return;
        }

        // Fetch from REST API
        const response = await fetch("/api/system/info", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Validate system info data before setting
          if (data && typeof data === "object") {
            apiCacheService.setWithConfig("systemInfo", data, "systemInfo");
            setSystemStats(data);
            onSystemStats?.(data);
          }
        } else if (response.status === 404 && retryCount < 2) {
          // Retry after a delay if endpoint not found
          console.warn(
            `System info endpoint not found, retrying in ${(retryCount + 1) * 2}s...`,
          );
          setTimeout(
            () => fetchSystemInfo(retryCount + 1),
            (retryCount + 1) * 2000,
          );
        }
      } catch (err) {
        console.error("Failed to fetch system info:", err);
        // Retry on network errors
        if (retryCount < 2) {
          console.warn(
            `Retrying system info fetch in ${(retryCount + 1) * 2}s...`,
          );
          setTimeout(
            () => fetchSystemInfo(retryCount + 1),
            (retryCount + 1) * 2000,
          );
        }
      }
    },
    [enableRestFallback, onSystemStats],
  );

  // Load initial data when component mounts
  useEffect(() => {
    if (enableRestFallback && !isConnected) {
      fetchInitialData();
      fetchSystemInfo();
    }
  }, [enableRestFallback, isConnected, fetchInitialData, fetchSystemInfo]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    // Clear cache for containers to force fresh data
    apiCacheService.delete("containers");

    if (isConnected) {
      // If WebSocket is connected, trigger a refresh request
      // This will be handled by the WebSocket service
    } else {
      // Fall back to REST API
      await fetchInitialData();
    }
  }, [isConnected, fetchInitialData]);

  // Manual reconnection
  const reconnect = useCallback(() => {
    wsReconnect();
  }, [wsReconnect]);

  return {
    isConnected,
    containers,
    systemStats,
    error,
    loading,
    reconnect,
    refresh,
  };
};
