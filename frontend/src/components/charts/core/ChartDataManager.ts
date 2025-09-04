import {
  EnhancedChartDataPoint,
  ChartDataBufferConfig,
  ChartTimeConfig,
  DEFAULT_CHART_CONFIG,
} from "./ChartTypes";

export class ChartDataManager {
  private dataBuffer: EnhancedChartDataPoint[] = [];
  private config: ChartDataBufferConfig;
  private timeConfig: ChartTimeConfig;
  private lastDataPoint: EnhancedChartDataPoint | null = null;
  private aggregationBuffer: Map<string, EnhancedChartDataPoint[]> = new Map();

  constructor(
    dataConfig: Partial<ChartDataBufferConfig> = {},
    timeConfig: Partial<ChartTimeConfig> = {},
  ) {
    this.config = { ...DEFAULT_CHART_CONFIG.data, ...dataConfig };
    this.timeConfig = { ...DEFAULT_CHART_CONFIG.time, ...timeConfig };
  }

  /**
   * Add new data point with deduplication and aggregation
   */
  addDataPoint(
    cpu: number,
    memory: number,
    source: "websocket" | "rest" | "cached" = "websocket",
  ): EnhancedChartDataPoint | null {
    const now = Date.now();
    const timestamp = now; // Use raw timestamp for simplicity
    const formattedTime = this.formatTimestamp(timestamp);

    // Check for deduplication
    if (this.shouldSkipDataPoint(timestamp)) {
      return null;
    }

    const dataPoint: EnhancedChartDataPoint = {
      timestamp,
      time: formattedTime,
      cpu: this.sanitizeValue(cpu),
      memory: this.sanitizeValue(memory),
      metadata: {
        source,
        quality: this.assessDataQuality(cpu, memory),
        interpolated: false,
      },
    };

    // Apply aggregation if enabled
    if (this.config.aggregationWindow > 0) {
      return this.addToAggregationBuffer(dataPoint);
    }

    return this.addToBuffer(dataPoint);
  }

  /**
   * Add data point directly to buffer
   */
  private addToBuffer(
    dataPoint: EnhancedChartDataPoint,
  ): EnhancedChartDataPoint {
    this.dataBuffer.push(dataPoint);
    this.lastDataPoint = dataPoint;

    // Maintain buffer size
    if (this.dataBuffer.length > this.config.maxDataPoints) {
      this.dataBuffer = this.dataBuffer.slice(-this.config.maxDataPoints);
    }

    return dataPoint;
  }

  /**
   * Add to aggregation buffer and process if window is full
   */
  private addToAggregationBuffer(
    dataPoint: EnhancedChartDataPoint,
  ): EnhancedChartDataPoint | null {
    const windowKey = Math.floor(
      dataPoint.timestamp / this.config.aggregationWindow,
    ).toString();

    if (!this.aggregationBuffer.has(windowKey)) {
      this.aggregationBuffer.set(windowKey, []);
    }

    this.aggregationBuffer.get(windowKey)!.push(dataPoint);

    // Clean up old aggregation windows to prevent memory leaks
    this.cleanupOldAggregationWindows();

    // Check if we should process this window
    const windowData = this.aggregationBuffer.get(windowKey)!;
    const windowStart = parseInt(windowKey) * this.config.aggregationWindow;
    const windowEnd = windowStart + this.config.aggregationWindow;

    if (Date.now() >= windowEnd || windowData.length >= 10) {
      const aggregatedPoint = this.aggregateWindowData(windowData, windowStart);
      this.aggregationBuffer.delete(windowKey);
      return this.addToBuffer(aggregatedPoint);
    }

    return null;
  }

  /**
   * Aggregate data points within a time window
   */
  private aggregateWindowData(
    windowData: EnhancedChartDataPoint[],
    windowStart: number,
  ): EnhancedChartDataPoint {
    const avgCpu =
      windowData.reduce((sum, point) => sum + point.cpu, 0) / windowData.length;
    const avgMemory =
      windowData.reduce((sum, point) => sum + point.memory, 0) /
      windowData.length;

    return {
      timestamp: windowStart + this.config.aggregationWindow / 2,
      time: this.formatTimestamp(
        windowStart + this.config.aggregationWindow / 2,
      ),
      cpu: Math.round(avgCpu * 100) / 100,
      memory: Math.round(avgMemory * 100) / 100,
      metadata: {
        source: "websocket",
        quality: "high",
        interpolated: false,
      },
    };
  }

  /**
   * Round timestamp based on precision setting
   */
  private roundTimestamp(timestamp: number): number {
    switch (this.timeConfig.precision) {
      case "minute":
        return Math.floor(timestamp / 60000) * 60000;
      case "hour":
        return Math.floor(timestamp / 3600000) * 3600000;
      case "second":
      default:
        return Math.floor(timestamp / 1000) * 1000;
    }
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);

    if (this.timeConfig.includeSeconds) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Check if data point should be skipped due to deduplication
   */
  private shouldSkipDataPoint(timestamp: number): boolean {
    if (!this.lastDataPoint) {
      return false;
    }

    const timeDiff = timestamp - this.lastDataPoint.timestamp;
    return timeDiff < this.config.deduplicationThreshold;
  }

  /**
   * Sanitize numeric values
   */
  private sanitizeValue(value: number): number {
    if (typeof value !== "number" || isNaN(value) || !isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
  }

  /**
   * Assess data quality based on values
   */
  private assessDataQuality(
    cpu: number,
    memory: number,
  ): "high" | "medium" | "low" {
    if (
      typeof cpu !== "number" ||
      typeof memory !== "number" ||
      isNaN(cpu) ||
      isNaN(memory) ||
      !isFinite(cpu) ||
      !isFinite(memory)
    ) {
      return "low";
    }

    if (cpu < 0 || cpu > 100 || memory < 0 || memory > 100) {
      return "medium";
    }

    return "high";
  }

  /**
   * Get all data points
   */
  getData(): EnhancedChartDataPoint[] {
    return [...this.dataBuffer];
  }

  /**
   * Directly sets the data buffer. Used for initializing the chart with existing data.
   */
  setData(data: EnhancedChartDataPoint[]): void {
    this.dataBuffer = data.slice(-this.config.maxDataPoints);
    this.lastDataPoint = data.length > 0 ? data[data.length - 1] : null;
  }

  /**
   * Get data points within time range
   */
  getDataInRange(startTime: number, endTime: number): EnhancedChartDataPoint[] {
    return this.dataBuffer.filter(
      (point) => point.timestamp >= startTime && point.timestamp <= endTime,
    );
  }

  /**
   * Get latest data point
   */
  getLatestDataPoint(): EnhancedChartDataPoint | null {
    return this.lastDataPoint;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.dataBuffer = [];
    this.lastDataPoint = null;
    this.aggregationBuffer.clear();
  }

  /**
   * Get buffer statistics
   */
  getStats() {
    return {
      bufferSize: this.dataBuffer.length,
      maxSize: this.config.maxDataPoints,
      memoryUsage: this.estimateMemoryUsage(),
      oldestPoint: this.dataBuffer[0]?.timestamp || null,
      newestPoint: this.lastDataPoint?.timestamp || null,
      aggregationWindows: this.aggregationBuffer.size,
    };
  }

  /**
   * Estimate memory usage in bytes
   */
  private estimateMemoryUsage(): number {
    // Rough estimation: each data point is approximately 200 bytes
    return this.dataBuffer.length * 200 + this.aggregationBuffer.size * 1000;
  }

  /**
   * Update configuration
   */
  updateConfig(
    dataConfig: Partial<ChartDataBufferConfig>,
    timeConfig?: Partial<ChartTimeConfig>,
  ): void {
    this.config = { ...this.config, ...dataConfig };
    if (timeConfig) {
      this.timeConfig = { ...this.timeConfig, ...timeConfig };
    }

    // Trim buffer if max size reduced
    if (this.dataBuffer.length > this.config.maxDataPoints) {
      this.dataBuffer = this.dataBuffer.slice(-this.config.maxDataPoints);
    }
  }

  /**
   * Export data in various formats
   */
  exportData(format: "json" | "csv"): string {
    switch (format) {
      case "csv":
        return this.exportToCsv();
      case "json":
      default:
        return JSON.stringify(this.dataBuffer, null, 2);
    }
  }

  /**
   * Export data to CSV format
   */
  private exportToCsv(): string {
    const headers = ["timestamp", "time", "cpu", "memory", "source", "quality"];
    const rows = this.dataBuffer.map((point) => [
      point.timestamp,
      point.time,
      point.cpu,
      point.memory,
      point.metadata?.source || "",
      point.metadata?.quality || "",
    ]);

    return [headers, ...rows].map((row) => row.join(",")).join("\n");
  }

  /**
   * Fill gaps in data with interpolated values
   */
  interpolateGaps(maxGapMs: number = 10000): void {
    if (this.dataBuffer.length < 2) return;

    const interpolatedData: EnhancedChartDataPoint[] = [];

    for (let i = 0; i < this.dataBuffer.length - 1; i++) {
      const current = this.dataBuffer[i];
      const next = this.dataBuffer[i + 1];

      interpolatedData.push(current);

      const gap = next.timestamp - current.timestamp;
      if (gap > maxGapMs) {
        const steps = Math.floor(gap / 1000); // Interpolate every second

        for (let step = 1; step < steps; step++) {
          const ratio = step / steps;
          const interpolatedPoint: EnhancedChartDataPoint = {
            timestamp: current.timestamp + gap * ratio,
            time: this.formatTimestamp(current.timestamp + gap * ratio),
            cpu: current.cpu + (next.cpu - current.cpu) * ratio,
            memory: current.memory + (next.memory - current.memory) * ratio,
            metadata: {
              source: "websocket",
              quality: "medium",
              interpolated: true,
            },
          };
          interpolatedData.push(interpolatedPoint);
        }
      }
    }

    // Add the last point
    interpolatedData.push(this.dataBuffer[this.dataBuffer.length - 1]);

    this.dataBuffer = interpolatedData.slice(-this.config.maxDataPoints);
  }

  /**
   * Clean up old aggregation windows to prevent memory leaks
   */
  private cleanupOldAggregationWindows(): void {
    const now = Date.now();
    const cutoffTime = now - this.config.aggregationWindow * 10; // Keep only last 10 windows

    this.aggregationBuffer.forEach((windowData, windowKey) => {
      const windowStart = parseInt(windowKey) * this.config.aggregationWindow;
      if (windowStart < cutoffTime) {
        this.aggregationBuffer.delete(windowKey);
      }
    });
  }
}
