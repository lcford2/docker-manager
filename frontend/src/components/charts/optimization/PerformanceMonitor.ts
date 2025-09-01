import {
  ChartPerformanceMetrics,
  ChartPerformanceConfig,
} from "../core/ChartTypes";

export interface PerformanceAlert {
  type: "warning" | "critical";
  message: string;
  timestamp: number;
  metric: keyof ChartPerformanceMetrics;
  value: number;
  threshold: number;
}

export interface PerformanceSnapshot {
  timestamp: number;
  metrics: ChartPerformanceMetrics;
  memoryInfo?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  frameInfo?: {
    lastFrameTime: number;
    averageFrameTime: number;
  };
}

export class PerformanceMonitor {
  private config: ChartPerformanceConfig;
  private snapshots: PerformanceSnapshot[] = [];
  private alerts: PerformanceAlert[] = [];
  private frameTimings: number[] = [];
  private lastFrameTime: number = 0;
  private isProfilingEnabled: boolean = false;
  private profilingStartTime: number = 0;

  // Performance thresholds - updated for realistic modern browser usage
  private readonly THRESHOLDS = {
    renderTime: { warning: 16, critical: 100 }, // ms - increased critical threshold
    memoryUsage: { warning: 500, critical: 2000 }, // MB - realistic thresholds for modern apps
    fps: { warning: 30, critical: 15 }, // frames per second
    memoryGrowth: { warning: 50, critical: 200 }, // MB per minute - increased for data-intensive apps
  };

  constructor(config: ChartPerformanceConfig) {
    this.config = config;
    this.isProfilingEnabled = config.enableProfiling;
    this.setupPerformanceObserver();
  }

  /**
   * Start performance profiling for a render cycle
   */
  startProfiling(label: string = "chart-render"): void {
    if (!this.isProfilingEnabled) return;

    this.profilingStartTime = performance.now();
    if (performance.mark) {
      performance.mark(`${label}-start`);
    }
  }

  /**
   * End performance profiling and record metrics
   */
  endProfiling(
    dataPoints: number,
    engine: string,
    label: string = "chart-render",
  ): ChartPerformanceMetrics {
    const endTime = performance.now();
    const renderTime = endTime - this.profilingStartTime;

    if (this.isProfilingEnabled && performance.mark && performance.measure) {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);
    }

    const metrics: ChartPerformanceMetrics = {
      renderTime,
      memoryUsage: this.getMemoryUsage(),
      dataPoints,
      fps: this.calculateFPS(renderTime),
      lastUpdate: Date.now(),
      engine: engine as any,
    };

    this.recordSnapshot(metrics);
    this.checkThresholds(metrics);
    this.updateFrameTimings(renderTime);

    return metrics;
  }

  /**
   * Record a performance snapshot
   */
  private recordSnapshot(metrics: ChartPerformanceMetrics): void {
    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      metrics,
      memoryInfo: this.getDetailedMemoryInfo(),
      frameInfo: {
        lastFrameTime: metrics.renderTime,
        averageFrameTime: this.getAverageFrameTime(),
      },
    };

    this.snapshots.push(snapshot);

    // Keep only last 1000 snapshots
    if (this.snapshots.length > 1000) {
      this.snapshots = this.snapshots.slice(-1000);
    }
  }

  /**
   * Check performance thresholds and generate alerts
   */
  private checkThresholds(metrics: ChartPerformanceMetrics): void {
    this.checkThreshold(
      "renderTime",
      metrics.renderTime,
      this.THRESHOLDS.renderTime,
    );
    this.checkThreshold(
      "memoryUsage",
      metrics.memoryUsage,
      this.THRESHOLDS.memoryUsage,
    );
    this.checkThreshold("fps", metrics.fps, this.THRESHOLDS.fps, true); // Lower is worse for FPS

    // Check memory growth rate
    const memoryGrowthRate = this.calculateMemoryGrowthRate();
    if (memoryGrowthRate !== null) {
      this.checkThreshold(
        "memoryUsage",
        memoryGrowthRate,
        this.THRESHOLDS.memoryGrowth,
      );
    }
  }

  /**
   * Check individual threshold and create alert if needed
   */
  private checkThreshold(
    metric: keyof ChartPerformanceMetrics,
    value: number,
    thresholds: { warning: number; critical: number },
    invertLogic: boolean = false,
  ): void {
    const isAboveWarning = invertLogic
      ? value < thresholds.warning
      : value > thresholds.warning;
    const isAboveCritical = invertLogic
      ? value < thresholds.critical
      : value > thresholds.critical;

    if (isAboveCritical) {
      this.addAlert("critical", metric, value, thresholds.critical);
    } else if (isAboveWarning) {
      this.addAlert("warning", metric, value, thresholds.warning);
    }
  }

  /**
   * Add performance alert
   */
  private addAlert(
    type: "warning" | "critical",
    metric: keyof ChartPerformanceMetrics,
    value: number,
    threshold: number,
  ): void {
    const message = this.generateAlertMessage(type, metric, value, threshold);

    const alert: PerformanceAlert = {
      type,
      message,
      timestamp: Date.now(),
      metric,
      value,
      threshold,
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log critical alerts
    if (type === "critical") {
      console.warn(`Chart Performance Alert: ${message}`);
    }
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(
    type: string,
    metric: keyof ChartPerformanceMetrics,
    value: number,
    threshold: number,
  ): string {
    const metricLabels = {
      renderTime: "Render time",
      memoryUsage: "Memory usage",
      fps: "Frame rate",
      dataPoints: "Data points",
      lastUpdate: "Last update",
      engine: "Engine",
    };

    const metricUnits = {
      renderTime: "ms",
      memoryUsage: "MB",
      fps: "fps",
      dataPoints: "",
      lastUpdate: "",
      engine: "",
    };

    const label = metricLabels[metric] || metric;
    const unit = metricUnits[metric] || "";

    return `${label} ${type}: ${value.toFixed(1)}${unit} (threshold: ${threshold}${unit})`;
  }

  /**
   * Calculate FPS from render time with proper frame rate calculation
   */
  private calculateFPS(renderTime: number): number {
    if (renderTime <= 0) return 60; // Default to 60 FPS for instant renders

    // Calculate theoretical FPS but cap at 60 (browser limit)
    const theoreticalFPS = 1000 / renderTime;
    return Math.min(Math.round(theoreticalFPS), 60);
  }

  /**
   * Update frame timing history
   */
  private updateFrameTimings(renderTime: number): void {
    this.frameTimings.push(renderTime);

    // Keep only last 60 frame timings (for average calculation)
    if (this.frameTimings.length > 60) {
      this.frameTimings = this.frameTimings.slice(-60);
    }
  }

  /**
   * Get average frame time over recent frames
   */
  private getAverageFrameTime(): number {
    if (this.frameTimings.length === 0) return 0;

    const sum = this.frameTimings.reduce((acc, time) => acc + time, 0);
    return sum / this.frameTimings.length;
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    const memoryInfo = this.getDetailedMemoryInfo();
    if (memoryInfo) {
      return memoryInfo.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }
    return 0;
  }

  /**
   * Get detailed memory information
   */
  private getDetailedMemoryInfo():
    | {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      }
    | undefined {
    const perf = performance as any;
    if (perf.memory) {
      return {
        usedJSHeapSize: perf.memory.usedJSHeapSize,
        totalJSHeapSize: perf.memory.totalJSHeapSize,
        jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
      };
    }
    return undefined;
  }

  /**
   * Calculate memory growth rate per minute
   */
  private calculateMemoryGrowthRate(): number | null {
    if (this.snapshots.length < 2) return null;

    const recent = this.snapshots.slice(-10); // Last 10 snapshots
    if (recent.length < 2) return null;

    const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
    const memoryDiff =
      recent[recent.length - 1].metrics.memoryUsage -
      recent[0].metrics.memoryUsage;

    if (timeSpan <= 0) return null;

    // Convert to MB per minute
    return (memoryDiff / timeSpan) * 60000;
  }

  /**
   * Setup Performance Observer for additional metrics
   */
  private setupPerformanceObserver(): void {
    if (typeof PerformanceObserver === "undefined") return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.name.includes("chart-render")) {
            // Additional processing for chart-specific performance entries
            this.processPerformanceEntry(entry);
          }
        }
      });

      observer.observe({ entryTypes: ["measure", "navigation", "paint"] });
    } catch (error) {
      console.warn(
        "Performance Observer not supported or failed to initialize:",
        error,
      );
    }
  }

  /**
   * Process performance observer entries
   */
  private processPerformanceEntry(entry: PerformanceEntry): void {
    if (this.isProfilingEnabled) {
      console.debug(
        `Performance entry: ${entry.name} took ${entry.duration}ms`,
      );
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    current: ChartPerformanceMetrics | null;
    averages: Partial<ChartPerformanceMetrics>;
    alerts: PerformanceAlert[];
    recommendations: string[];
  } {
    const current =
      this.snapshots.length > 0
        ? this.snapshots[this.snapshots.length - 1].metrics
        : null;
    const averages = this.calculateAverages();
    const recommendations = this.generateRecommendations(current, averages);

    return {
      current,
      averages,
      alerts: this.alerts.slice(-10), // Last 10 alerts
      recommendations,
    };
  }

  /**
   * Calculate average metrics
   */
  private calculateAverages(): Partial<ChartPerformanceMetrics> {
    if (this.snapshots.length === 0) return {};

    const recent = this.snapshots.slice(-30); // Last 30 snapshots
    const sum = recent.reduce(
      (acc, snapshot) => ({
        renderTime: acc.renderTime + snapshot.metrics.renderTime,
        memoryUsage: acc.memoryUsage + snapshot.metrics.memoryUsage,
        fps: acc.fps + snapshot.metrics.fps,
        dataPoints: acc.dataPoints + snapshot.metrics.dataPoints,
      }),
      { renderTime: 0, memoryUsage: 0, fps: 0, dataPoints: 0 },
    );

    return {
      renderTime: sum.renderTime / recent.length,
      memoryUsage: sum.memoryUsage / recent.length,
      fps: sum.fps / recent.length,
      dataPoints: sum.dataPoints / recent.length,
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    current: ChartPerformanceMetrics | null,
    averages: Partial<ChartPerformanceMetrics>,
  ): string[] {
    const recommendations: string[] = [];

    if (current && averages.renderTime && averages.renderTime > 20) {
      recommendations.push(
        "Consider reducing data points or switching to a more performant chart engine",
      );
    }

    if (current && averages.memoryUsage && averages.memoryUsage > 50) {
      recommendations.push(
        "Memory usage is high - consider implementing data compression or reducing buffer size",
      );
    }

    if (current && averages.fps && averages.fps < 30) {
      recommendations.push(
        "Low frame rate detected - disable animations or reduce update frequency",
      );
    }

    if (
      this.alerts.filter(
        (a) => a.type === "critical" && Date.now() - a.timestamp < 60000,
      ).length > 0
    ) {
      recommendations.push(
        "Critical performance issues detected - consider switching chart engine or reducing features",
      );
    }

    return recommendations;
  }

  /**
   * Export performance data
   */
  exportData(): string {
    const data = {
      snapshots: this.snapshots,
      alerts: this.alerts,
      summary: this.getPerformanceSummary(),
      config: this.config,
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Clear performance data
   */
  clear(): void {
    this.snapshots = [];
    this.alerts = [];
    this.frameTimings = [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ChartPerformanceConfig>): void {
    this.config = { ...this.config, ...config };
    this.isProfilingEnabled = this.config.enableProfiling;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(minutes: number = 5): PerformanceAlert[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.alerts.filter((alert) => alert.timestamp > cutoff);
  }

  /**
   * Check if performance is acceptable
   */
  isPerformanceAcceptable(): boolean {
    const recentCriticalAlerts = this.getRecentAlerts(1).filter(
      (a) => a.type === "critical",
    );
    return recentCriticalAlerts.length === 0;
  }
}
