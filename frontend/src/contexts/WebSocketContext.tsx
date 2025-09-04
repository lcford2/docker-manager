import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";

import {
  WebSocketService,
  WebSocketServiceConfig,
} from "../services/websocketService";
import {
  WebSocketConnectionStatus,
  WebSocketMessage,
} from "../types/websocket";

interface WebSocketContextType {
  // Connection state
  isConnected: boolean;
  connectionStatus: WebSocketConnectionStatus;

  // Data state
  containers: any[];
  systemStats: any;

  // Methods
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => void;
  send: (message: WebSocketMessage) => boolean;

  // Subscription methods
  subscribe: (type: string, callback: (data: any) => void) => string;
  unsubscribe: (id: string) => boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined,
);

interface WebSocketProviderProps {
  children: ReactNode;
  config: WebSocketServiceConfig;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  config,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<WebSocketConnectionStatus>({
      state: "disconnected",
      isConnected: false,
      error: null,
      connectionAttempts: 0,
      lastConnected: null,
      lastDataReceived: null,
    });

  const [containers, setContainers] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState<any>(null);

  const [service, setService] = useState<WebSocketService | null>(null);

  // Initialize WebSocket service
  useEffect(() => {
    const wsService = WebSocketService.initialize(config);
    setService(wsService);

    // Set up event handlers
    wsService.setEvents({
      onConnect: () => {
        console.log("WebSocket connected via context");
        setIsConnected(true);
        setConnectionStatus(wsService.getConnectionStatus());
      },

      onDisconnect: () => {
        console.log("WebSocket disconnected via context");
        setIsConnected(false);
        setConnectionStatus(wsService.getConnectionStatus());
      },

      onError: (error: string) => {
        console.error("WebSocket error via context:", error);
        setConnectionStatus(wsService.getConnectionStatus());
      },

      onMessage: (message: WebSocketMessage) => {
        console.log("WebSocket message received via context:", message.type);

        // Handle different message types
        if (message.type === "container_stats" && message.data?.containers) {
          setContainers(message.data.containers);
        } else if (message.type === "system_stats") {
          setSystemStats(message.data);
        }
      },

      onReconnecting: (attempt: number, delay: number) => {
        console.log(`WebSocket reconnecting attempt ${attempt} in ${delay}ms`);
        setConnectionStatus(wsService.getConnectionStatus());
      },
    });

    // Cleanup on unmount
    return () => {
      wsService.destroy();
    };
  }, [config]);

  // Connect to WebSocket immediately when service is ready
  useEffect(() => {
    if (service) {
      service
        .connect()
        .then(() => {
          console.log("WebSocket connected successfully on app load");
        })
        .catch((error: any) => {
          console.error("Failed to connect WebSocket on app load:", error);
        });
    }
  }, [service]);

  // Subscribe to container and system stats
  useEffect(() => {
    if (service && isConnected) {
      // Subscribe to container stats
      const containerSubId = service.subscribe("container_stats", (data: any) => {
        if (data?.containers) {
          setContainers(data.containers);
        }
      });

      // Subscribe to system stats
      const systemSubId = service.subscribe("system_stats", (data: any) => {
        setSystemStats(data);
      });

      // Subscribe to all messages for debugging
      const allSubId = service.subscribe("*", (data: any) => {
        console.log("All WebSocket message received:", data);
      });

      // Cleanup subscriptions
      return () => {
        service.unsubscribe(containerSubId);
        service.unsubscribe(systemSubId);
        service.unsubscribe(allSubId);
      };
    }
  }, [service, isConnected]);

  // Update connection status periodically
  useEffect(() => {
    if (!service) return;

    const interval = setInterval(() => {
      setConnectionStatus(service.getConnectionStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, [service]);

  const connect = useCallback(async () => {
    if (service) {
      await service.connect();
    }
  }, [service]);

  const disconnect = useCallback(() => {
    if (service) {
      service.disconnect();
    }
  }, [service]);

  const reconnect = useCallback(() => {
    if (service) {
      service.reconnect();
    }
  }, [service]);

  const send = useCallback(
    (message: WebSocketMessage) => {
      if (service) {
        return service.send(message);
      }
      return false;
    },
    [service],
  );

  const subscribe = useCallback(
    (type: string, callback: (data: any) => void) => {
      if (service) {
        return service.subscribe(type, callback);
      }
      return "";
    },
    [service],
  );

  const unsubscribe = useCallback(
    (id: string) => {
      if (service) {
        return service.unsubscribe(id);
      }
      return false;
    },
    [service],
  );

  const contextValue: WebSocketContextType = {
    isConnected,
    connectionStatus,
    containers,
    systemStats,
    connect,
    disconnect,
    reconnect,
    send,
    subscribe,
    unsubscribe,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider",
    );
  }
  return context;
};
