import { useCallback, useEffect } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { apiCacheService } from "../services/apiCacheService";
import { ContainerStatsWithHistory } from "../types/metrics";
import { DockerContainer } from "../types/docker";
import { SystemStats, useDockerStore } from "../store/dockerStore";

interface UseSharedWebSocketOptions {
  enableRestFallback?: boolean;
}

interface UseSharedWebSocketReturn {
  isConnected: boolean;
  containers: (ContainerStatsWithHistory | DockerContainer)[];
  systemStats: SystemStats;
  error: string | null;
  loading: boolean;
  reconnect: () => void;
  refresh: () => void;
}

const isValidSystemStats = (data: any): data is SystemStats => {
  return (
    data &&
    typeof data.containers_running === "number" &&
    typeof data.containers_stopped === "number" &&
    typeof data.containers_total === "number" &&
    typeof data.images === "number" &&
    typeof data.volumes === "number" &&
    typeof data.networks === "number"
  );
};

export const useSharedWebSocket = (
  options: UseSharedWebSocketOptions = {},
): UseSharedWebSocketReturn => {
  const { enableRestFallback = true } = options;

  const {
    isConnected,
    connectionStatus,
    reconnect: wsReconnect,
  } = useWebSocketContext();

  const {
    containers,
    systemStats,
    loading,
    error,
    setSystemStats,
    setLoading,
    setError,
    mergeData,
  } = useDockerStore();

  useEffect(() => {
    if (connectionStatus.state === "error") {
      setError(connectionStatus.error);
    } else {
      setError(null);
    }

    if (
      connectionStatus.state === "connecting" ||
      connectionStatus.state === "reconnecting"
    ) {
      setLoading(true);
    }
  }, [connectionStatus, setError, setLoading]);

  const fetchInitialData = useCallback(async () => {
    if (!enableRestFallback) return;

    setLoading(true);
    setError(null);

    try {
      const cachedContainers =
        apiCacheService.get<ContainerStatsWithHistory[]>("containers");
      if (cachedContainers) {
        mergeData({ containers: cachedContainers, loading: false });
        return;
      }

      const response = await fetch("/api/db/container_stats", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        apiCacheService.setWithConfig("containers", data, "containers");
        mergeData({ containers: data, loading: false });
      } else {
        throw new Error("Invalid container data format received from API");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch container data");
      setLoading(false);
    }
  }, [enableRestFallback, mergeData, setLoading, setError]);

  const fetchSystemInfo = useCallback(async () => {
    if (!enableRestFallback) return;

    try {
      const cachedSystemInfo = apiCacheService.get<SystemStats>("systemInfo");
      if (isValidSystemStats(cachedSystemInfo)) {
        setSystemStats(cachedSystemInfo);
        return;
      }

      const response = await fetch("/api/db/system_info", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (isValidSystemStats(data)) {
          apiCacheService.setWithConfig("systemInfo", data, "systemInfo");
          setSystemStats(data);
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err: any) {
      console.error("Failed to fetch system info:", err);
    }
  }, [enableRestFallback, setSystemStats]);

  useEffect(() => {
    if (!isConnected && enableRestFallback) {
      fetchInitialData();
      fetchSystemInfo();
    }
  }, [isConnected, enableRestFallback, fetchInitialData, fetchSystemInfo]);

  const refresh = useCallback(async () => {
    apiCacheService.delete("containers");
    apiCacheService.delete("systemInfo");

    if (!isConnected) {
      await fetchInitialData();
      await fetchSystemInfo();
    }
  }, [isConnected, fetchInitialData, fetchSystemInfo]);

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
