import {
  WebSocketMessage,
  WebSocketConnectionStatus,
  WebSocketConnectionState,
  WebSocketSubscription,
} from "../types/websocket";
import { ReconnectionStrategy } from "../utils/reconnectionStrategy";

export interface WebSocketServiceConfig {
  url: string;
  token: string;
  pingInterval?: number;
  staleConnectionTimeout?: number;
  maxReconnectionAttempts?: number;
}

export interface WebSocketServiceEvents {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onReconnecting?: (attempt: number, delay: number) => void;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private config: WebSocketServiceConfig;
  private events: WebSocketServiceEvents = {};
  private reconnectionStrategy: ReconnectionStrategy;
  private subscriptions = new Map<string, WebSocketSubscription>();
  private pingInterval: number | null = null;
  private staleConnectionTimeout: number | null = null;
  private lastDataReceived: number = 0;
  private isDestroyed = false;

  private connectionStatus: WebSocketConnectionStatus = {
    state: "disconnected",
    isConnected: false,
    error: null,
    connectionAttempts: 0,
    lastConnected: null,
    lastDataReceived: null,
  };

  private constructor(config: WebSocketServiceConfig) {
    this.config = config;
    this.reconnectionStrategy = new ReconnectionStrategy({
      maxAttempts: config.maxReconnectionAttempts || 10,
    });

    // Set up network event listeners
    this.setupNetworkListeners();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: WebSocketServiceConfig): WebSocketService {
    if (!WebSocketService.instance && config) {
      WebSocketService.instance = new WebSocketService(config);
    } else if (!WebSocketService.instance) {
      throw new Error("WebSocketService must be initialized with config first");
    }
    return WebSocketService.instance;
  }

  /**
   * Initialize the service with configuration
   */
  public static initialize(config: WebSocketServiceConfig): WebSocketService {
    if (WebSocketService.instance) {
      WebSocketService.instance.destroy();
    }
    WebSocketService.instance = new WebSocketService(config);
    return WebSocketService.instance;
  }

  /**
   * Connect to WebSocket
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isDestroyed) {
        reject(new Error("Service has been destroyed"));
        return;
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      try {
        this.updateConnectionStatus("connecting");
        const wsUrl = `${this.config.url}?token=${encodeURIComponent(
          this.config.token,
        )}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.debug("WebSocket connected");
          this.updateConnectionStatus("connected");
          this.startHealthMonitoring();
          this.events.onConnect?.();
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event: CloseEvent) => {
          console.debug("WebSocket disconnected:", event.code, event.reason);
          this.handleDisconnect(event);
          reject(
            new Error(`WebSocket closed: ${event.reason || "Unknown reason"}`),
          );
        };

        this.ws.onerror = (error: Event) => {
          console.error("WebSocket error:", error);
          this.handleError("WebSocket connection error");
          reject(new Error("WebSocket connection error"));
        };
      } catch (error) {
        this.handleError("Failed to create WebSocket connection");
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  public disconnect(): void {
    this.stopHealthMonitoring();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.updateConnectionStatus("disconnected");
    this.events.onDisconnect?.();
  }

  /**
   * Send message to WebSocket
   */
  public send(message: WebSocketMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
      return false;
    }
  }

  /**
   * Subscribe to specific message types
   */
  public subscribe(type: string, callback: (data: any) => void): string {
    const id = `${type}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    this.subscriptions.set(id, { id, type, callback });
    return id;
  }

  /**
   * Unsubscribe from messages
   */
  public unsubscribe(id: string): boolean {
    return this.subscriptions.delete(id);
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): WebSocketConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Set event handlers
   */
  public setEvents(events: WebSocketServiceEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Manual reconnection
   */
  public reconnect(): void {
    if (this.reconnectionStrategy.shouldAttemptReconnection()) {
      this.attemptReconnection();
    }
  }

  /**
   * Destroy the service
   */
  public destroy(): void {
    this.isDestroyed = true;
    this.disconnect();
    this.subscriptions.clear();
    this.reconnectionStrategy.reset();
    this.removeNetworkListeners();

    if (WebSocketService.instance === this) {
      WebSocketService.instance = null as any;
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.lastDataReceived = Date.now();

      // Update connection status
      this.connectionStatus.lastDataReceived = new Date();

      // Notify subscribers
      this.subscriptions.forEach((subscription) => {
        if (subscription.type === message.type || subscription.type === "*") {
          subscription.callback(message.data);
        }
      });

      // Notify general message handler
      this.events.onMessage?.(message);
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnect(event: CloseEvent): void {
    this.stopHealthMonitoring();

    // Don't attempt reconnection for client-initiated disconnects
    if (event.code === 1000) {
      this.updateConnectionStatus("disconnected");
      return;
    }

    this.updateConnectionStatus("reconnecting");
    this.attemptReconnection();
  }

  /**
   * Handle WebSocket errors
   */
  private handleError(error: string): void {
    this.updateConnectionStatus("error", error);
    this.events.onError?.(error);
  }

  /**
   * Attempt reconnection with strategy
   */
  private attemptReconnection(): void {
    if (!this.reconnectionStrategy.startReconnection()) {
      this.updateConnectionStatus("error", "Max reconnection attempts reached");
      return;
    }

    const state = this.reconnectionStrategy.getState();
    this.connectionStatus.connectionAttempts = state.attempt;

    this.events.onReconnecting?.(state.attempt, state.nextDelay);

    setTimeout(() => {
      if (!this.isDestroyed) {
        this.connect()
          .then(() => {
            this.reconnectionStrategy.onReconnectionSuccess();
            this.updateConnectionStatus("connected");
          })
          .catch(() => {
            this.reconnectionStrategy.onReconnectionFailure();
            this.attemptReconnection();
          });
      }
    }, state.nextDelay);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    // Ping every 30 seconds
    this.pingInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: "ping", data: {} });
      }
    }, this.config.pingInterval || 30000);

    // Check for stale connections every 60 seconds
    this.staleConnectionTimeout = window.setInterval(() => {
      if (
        this.lastDataReceived > 0 &&
        Date.now() - this.lastDataReceived >
          (this.config.staleConnectionTimeout || 60000)
      ) {
        console.debug("WebSocket connection appears stale, reconnecting...");
        this.ws?.close(1000, "Stale connection");
      }
    }, 60000);
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.staleConnectionTimeout) {
      clearInterval(this.staleConnectionTimeout);
      this.staleConnectionTimeout = null;
    }
  }

  /**
   * Update connection status
   */
  private updateConnectionStatus(
    state: WebSocketConnectionState,
    error?: string,
  ): void {
    this.connectionStatus.state = state;
    this.connectionStatus.isConnected = state === "connected";
    this.connectionStatus.error = error || null;

    if (state === "connected") {
      this.connectionStatus.lastConnected = new Date();
      this.connectionStatus.connectionAttempts = 0;
    }
  }

  /**
   * Set up network event listeners
   */
  private setupNetworkListeners(): void {
    // Reconnect when network comes back online
    window.addEventListener("online", this.handleOnline);

    // Reconnect when tab becomes visible
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    // Reconnect when window regains focus
    window.addEventListener("focus", this.handleFocus);
  }

  /**
   * Remove network event listeners
   */
  private removeNetworkListeners(): void {
    window.removeEventListener("online", this.handleOnline);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    window.removeEventListener("focus", this.handleFocus);
  }

  private handleOnline = (): void => {
    if (this.connectionStatus.state === "disconnected") {
      this.connect();
    }
  };

  private handleVisibilityChange = (): void => {
    if (!document.hidden && this.connectionStatus.state === "disconnected") {
      this.connect();
    }
  };

  private handleFocus = (): void => {
    if (this.connectionStatus.state === "disconnected") {
      this.connect();
    }
  };
}
