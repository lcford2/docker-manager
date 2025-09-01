/**
 * Performance monitoring utilities for development debugging
 */

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private isEnabled: boolean = false;

  constructor() {
    // Only enable in development
    this.isEnabled =
      process.env.NODE_ENV === "development" &&
      process.env.REACT_APP_ENABLE_PERF_MONITOR === "true";
  }

  /**
   * Start timing a performance metric
   */
  start(name: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    this.metrics.set(name, {
      name,
      startTime: performance.now(),
      metadata,
    });
  }

  /**
   * End timing a performance metric
   */
  end(name: string): number | null {
    if (!this.isEnabled) return null;

    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Performance metric '${name}' was not started`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;

    console.log(`⏱️ [${name}] ${duration.toFixed(2)}ms`, metric.metadata || "");

    return duration;
  }

  /**
   * Measure a function execution time
   */
  measure<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    if (!this.isEnabled) return fn();

    this.start(name, metadata);
    const result = fn();
    this.end(name);
    return result;
  }

  /**
   * Measure an async function execution time
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    if (!this.isEnabled) return fn();

    this.start(name, metadata);
    const result = await fn();
    this.end(name);
    return result;
  }

  /**
   * Log render information for React components
   */
  logRender(componentName: string, props: any, reason?: string): void {
    if (!this.isEnabled) return;

    console.log(`🔄 [Render] ${componentName}`, {
      reason,
      propsCount: Object.keys(props || {}).length,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log state updates
   */
  logStateUpdate(componentName: string, oldState: any, newState: any): void {
    if (!this.isEnabled) return;

    console.log(`📊 [State Update] ${componentName}`, {
      oldState,
      newState,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log WebSocket events
   */
  logWebSocketEvent(event: string, data?: any): void {
    if (!this.isEnabled) return;

    console.log(`🔌 [WebSocket] ${event}`, {
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    if (!this.isEnabled) return "Performance monitoring is disabled";

    const metrics = this.getMetrics().filter((m) => m.duration !== undefined);

    if (metrics.length === 0) return "No metrics recorded";

    let report = "📈 Performance Report\n";
    report += "====================\n";

    metrics
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .forEach((metric) => {
        report += `${metric.name}: ${metric.duration?.toFixed(2)}ms\n`;
      });

    return report;
  }
}

// Global instance
export const perfMonitor = new PerformanceMonitor();

/**
 * Hook for monitoring React component renders
 */
export function useRenderLogger(componentName: string, props: any): void {
  if (process.env.NODE_ENV === "development") {
    perfMonitor.logRender(componentName, props);
  }
}
