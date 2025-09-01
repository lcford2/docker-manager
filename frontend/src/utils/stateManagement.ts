/**
 * State management utilities for handling dashboard data updates
 */

import { ContainerStatsWithHistory } from "../types/metrics";
import { mergeSystemStats } from "./dataComparison";
import { DockerContainer, DockerStatus } from "../types/docker";

export interface SystemStats {
  containers_running: number;
  containers_stopped: number;
  containers_total: number;
  images: number;
  volumes: number;
  networks: number;
}

export interface DashboardState {
  systemStats: SystemStats;
  containers: (ContainerStatsWithHistory | DockerContainer)[];
  loading: boolean;
  error: string | null;
  dockerStatus: DockerStatus | null;
}

export interface StateUpdate {
  type: "REST_API" | "WEBSOCKET";
  data: Partial<DashboardState>;
  timestamp: number;
}

/**
 * Manages state updates from multiple sources (REST API and WebSocket)
 */
export class DashboardStateManager {
  private currentState: DashboardState;
  private lastRestApiUpdate: number = 0;
  private lastWebSocketUpdate: number = 0;

  constructor(initialState: DashboardState) {
    this.currentState = { ...initialState };
  }

  /**
   * Apply a state update from either REST API or WebSocket
   */
  applyUpdate(update: StateUpdate): DashboardState {
    const now = Date.now();

    if (update.type === "REST_API") {
      this.lastRestApiUpdate = now;
      // REST API provides authoritative data for initial load and full refresh
      this.currentState = {
        ...this.currentState,
        ...update.data,
        // Merge system stats intelligently
        systemStats: update.data.systemStats
          ? mergeSystemStats(
              update.data.systemStats,
              this.currentState.systemStats,
            )
          : this.currentState.systemStats,
      };
    } else if (update.type === "WEBSOCKET") {
      this.lastWebSocketUpdate = now;

      // WebSocket data is always preferred for immediate updates
      // Apply immediately for initial data, then use change detection for subsequent updates
      const shouldApply =
        this.lastRestApiUpdate === 0 || // No REST API data yet
        this.shouldApplyWebSocketUpdate(update);

      if (shouldApply) {
        this.currentState = {
          ...this.currentState,
          // WebSocket provides real-time container data
          containers: update.data.containers ?? this.currentState.containers,
          // Update loading state if provided
          loading:
            update.data.loading !== undefined
              ? update.data.loading
              : this.currentState.loading,
          // Update system stats based on real-time container count
          systemStats: update.data.containers
            ? this.calculateSystemStatsFromContainers(
                update.data.containers,
                this.currentState.systemStats,
              )
            : this.currentState.systemStats,
        };
      }
    }

    return { ...this.currentState };
  }

  /**
   * Determine if WebSocket update should be applied
   */
  private shouldApplyWebSocketUpdate(update: StateUpdate): boolean {
    if (!update.data.containers) return false;

    // Check if container data has meaningful changes
    const currentContainers = this.currentState.containers as ContainerStatsWithHistory[];
    const newContainers = update.data.containers as ContainerStatsWithHistory[];

    if (
      !currentContainers ||
      currentContainers.length !== newContainers.length
    ) {
      return true;
    }

    // Check for status changes or significant metric changes
    for (let i = 0; i < currentContainers.length; i++) {
      const current = currentContainers[i];
      const updated = newContainers.find((c) => c.id === current.id);

      if (!updated) return true;

      if (
        current.status !== updated.status ||
        Math.abs((current.cpu_percent ?? 0.0) - (updated.cpu_percent ?? 0.0)) >
          0.5 ||
        Math.abs(
          (current.memory_percent ?? 0.0) - (updated.memory_percent ?? 0.0),
        ) > 1
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate system stats from container data
   */
  private calculateSystemStatsFromContainers(
    containers: (ContainerStatsWithHistory | DockerContainer)[],
    baseStats: any,
  ): any {
    const runningCount = containers.filter(
      (c) => c.status === "running",
    ).length;

    return {
      ...baseStats,
      containers_running: runningCount,
      containers_stopped: Math.max(
        0,
        baseStats.containers_total - runningCount,
      ),
    };
  }

  /**
   * Get current state
   */
  getCurrentState(): DashboardState {
    return { ...this.currentState };
  }

  /**
   * Reset state to initial values
   */
  reset(initialState: DashboardState): void {
    this.currentState = { ...initialState };
    this.lastRestApiUpdate = 0;
    this.lastWebSocketUpdate = 0;
  }
}
