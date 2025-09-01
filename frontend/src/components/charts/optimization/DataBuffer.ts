import { EnhancedChartDataPoint } from "../core/ChartTypes";

export interface DataBufferConfig {
  maxSize: number;
  windowSize: number; // milliseconds
  aggregationMethod: "average" | "max" | "min" | "latest";
  compressionEnabled: boolean;
  retentionPolicy: "time" | "count";
  maxAge?: number; // milliseconds
}

export interface BufferWindow {
  startTime: number;
  endTime: number;
  data: EnhancedChartDataPoint[];
  aggregated?: EnhancedChartDataPoint;
}

export class DataBuffer {
  private config: DataBufferConfig;
  private buffer: EnhancedChartDataPoint[] = [];
  private windows: Map<string, BufferWindow> = new Map();
  private compressionRatio: number = 1;

  constructor(config: DataBufferConfig) {
    this.config = config;
    this.startCleanupTimer();
  }

  /**
   * Add a data point to the buffer
   */
  addDataPoint(point: EnhancedChartDataPoint): void {
    // Add to main buffer
    this.buffer.push(point);

    // Add to windowed aggregation
    this.addToWindow(point);

    // Maintain buffer size
    this.maintainBufferSize();

    // Apply compression if enabled
    if (this.config.compressionEnabled) {
      this.considerCompression();
    }
  }

  /**
   * Add data point to appropriate time window
   */
  private addToWindow(point: EnhancedChartDataPoint): void {
    const windowKey = this.getWindowKey(point.timestamp);

    if (!this.windows.has(windowKey)) {
      const windowStart =
        Math.floor(point.timestamp / this.config.windowSize) *
        this.config.windowSize;
      this.windows.set(windowKey, {
        startTime: windowStart,
        endTime: windowStart + this.config.windowSize,
        data: [],
      });
    }

    const window = this.windows.get(windowKey)!;
    window.data.push(point);

    // Check if window should be aggregated
    if (this.shouldAggregateWindow(window)) {
      this.aggregateWindow(window);
    }
  }

  /**
   * Get window key for timestamp
   */
  private getWindowKey(timestamp: number): string {
    return Math.floor(timestamp / this.config.windowSize).toString();
  }

  /**
   * Check if window should be aggregated
   */
  private shouldAggregateWindow(window: BufferWindow): boolean {
    const now = Date.now();
    // Aggregate if window is complete (past its end time) or has enough data
    return now >= window.endTime || window.data.length >= 10;
  }

  /**
   * Aggregate data points in a window
   */
  private aggregateWindow(window: BufferWindow): void {
    if (window.data.length === 0) return;

    let cpu: number;
    let memory: number;

    switch (this.config.aggregationMethod) {
      case "average":
        cpu =
          window.data.reduce((sum, p) => sum + p.cpu, 0) / window.data.length;
        memory =
          window.data.reduce((sum, p) => sum + p.memory, 0) /
          window.data.length;
        break;

      case "max":
        cpu = Math.max(...window.data.map((p) => p.cpu));
        memory = Math.max(...window.data.map((p) => p.memory));
        break;

      case "min":
        cpu = Math.min(...window.data.map((p) => p.cpu));
        memory = Math.min(...window.data.map((p) => p.memory));
        break;

      case "latest":
      default:
        const latest = window.data[window.data.length - 1];
        cpu = latest.cpu;
        memory = latest.memory;
        break;
    }

    window.aggregated = {
      timestamp: window.startTime + (window.endTime - window.startTime) / 2,
      time: new Date(
        window.startTime + (window.endTime - window.startTime) / 2,
      ).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      cpu: Math.round(cpu * 100) / 100,
      memory: Math.round(memory * 100) / 100,
      metadata: {
        source: "websocket",
        quality: "high",
        interpolated: false,
      },
    };
  }

  /**
   * Maintain buffer size according to policy
   */
  private maintainBufferSize(): void {
    if (this.config.retentionPolicy === "count") {
      if (this.buffer.length > this.config.maxSize) {
        const excess = this.buffer.length - this.config.maxSize;
        this.buffer.splice(0, excess);
      }
    } else if (this.config.retentionPolicy === "time" && this.config.maxAge) {
      const cutoff = Date.now() - this.config.maxAge;
      this.buffer = this.buffer.filter((point) => point.timestamp >= cutoff);
    }
  }

  /**
   * Consider applying compression to old data
   */
  private considerCompression(): void {
    if (this.buffer.length < this.config.maxSize * 0.8) return;

    const compressionPoint = Math.floor(this.buffer.length * 0.5);
    const oldData = this.buffer.slice(0, compressionPoint);
    const newData = this.buffer.slice(compressionPoint);

    // Compress old data by reducing sample rate
    const compressed = this.compressData(oldData, 2);

    this.buffer = [...compressed, ...newData];
    this.compressionRatio *= 2;
  }

  /**
   * Compress data by reducing sample rate
   */
  private compressData(
    data: EnhancedChartDataPoint[],
    factor: number,
  ): EnhancedChartDataPoint[] {
    if (factor <= 1) return data;

    const compressed: EnhancedChartDataPoint[] = [];

    for (let i = 0; i < data.length; i += factor) {
      const chunk = data.slice(i, i + factor);
      if (chunk.length === 0) continue;

      // Create aggregated point from chunk
      const avgCpu = chunk.reduce((sum, p) => sum + p.cpu, 0) / chunk.length;
      const avgMemory =
        chunk.reduce((sum, p) => sum + p.memory, 0) / chunk.length;

      compressed.push({
        timestamp: chunk[Math.floor(chunk.length / 2)].timestamp,
        time: chunk[Math.floor(chunk.length / 2)].time,
        cpu: Math.round(avgCpu * 100) / 100,
        memory: Math.round(avgMemory * 100) / 100,
        metadata: {
          source: "websocket",
          quality: "medium",
          interpolated: true,
        },
      });
    }

    return compressed;
  }

  /**
   * Get all data points in buffer
   */
  getData(): EnhancedChartDataPoint[] {
    return [...this.buffer];
  }

  /**
   * Get data points in time range
   */
  getDataInRange(startTime: number, endTime: number): EnhancedChartDataPoint[] {
    return this.buffer.filter(
      (point) => point.timestamp >= startTime && point.timestamp <= endTime,
    );
  }

  /**
   * Get aggregated data from windows
   */
  getAggregatedData(): EnhancedChartDataPoint[] {
    const aggregated: EnhancedChartDataPoint[] = [];

    this.windows.forEach((window) => {
      if (window.aggregated) {
        aggregated.push(window.aggregated);
      }
    });

    return aggregated.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get buffer statistics
   */
  getStats() {
    const memoryUsage = this.estimateMemoryUsage();
    const oldestPoint = this.buffer[0];
    const newestPoint = this.buffer[this.buffer.length - 1];

    return {
      bufferSize: this.buffer.length,
      maxSize: this.config.maxSize,
      compressionRatio: this.compressionRatio,
      memoryUsage,
      windowCount: this.windows.size,
      timeSpan:
        oldestPoint && newestPoint
          ? newestPoint.timestamp - oldestPoint.timestamp
          : 0,
      dataRate: this.calculateDataRate(),
    };
  }

  /**
   * Estimate memory usage in bytes
   */
  private estimateMemoryUsage(): number {
    // Rough estimation: each data point is ~200 bytes
    const bufferMemory = this.buffer.length * 200;
    const windowMemory = this.windows.size * 1000;
    return bufferMemory + windowMemory;
  }

  /**
   * Calculate data ingestion rate (points per second)
   */
  private calculateDataRate(): number {
    if (this.buffer.length < 2) return 0;

    const recentPoints = this.buffer.slice(-10);
    if (recentPoints.length < 2) return 0;

    const timeSpan =
      recentPoints[recentPoints.length - 1].timestamp -
      recentPoints[0].timestamp;
    return timeSpan > 0 ? (recentPoints.length - 1) / (timeSpan / 1000) : 0;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.buffer = [];
    this.windows.clear();
    this.compressionRatio = 1;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DataBufferConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.maintainBufferSize();
  }

  /**
   * Export buffer data
   */
  exportData(format: "json" | "csv" = "json"): string {
    const data = this.getData();

    if (format === "csv") {
      const headers = [
        "timestamp",
        "time",
        "cpu",
        "memory",
        "source",
        "quality",
      ];
      const rows = data.map((point) => [
        point.timestamp,
        point.time,
        point.cpu,
        point.memory,
        point.metadata?.source || "",
        point.metadata?.quality || "",
      ]);

      return [headers, ...rows].map((row) => row.join(",")).join("\n");
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Start cleanup timer for old windows
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupOldWindows();
    }, 60000); // Clean up every minute
  }

  /**
   * Clean up old windows that are no longer needed
   */
  private cleanupOldWindows(): void {
    const cutoff = Date.now() - (this.config.maxAge || 24 * 60 * 60 * 1000); // Default 24 hours
    const keysToDelete: string[] = [];

    this.windows.forEach((window, key) => {
      if (window.endTime < cutoff) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.windows.delete(key));
  }

  /**
   * Interpolate missing data points
   */
  interpolateMissingData(maxGap: number = 5000): void {
    if (this.buffer.length < 2) return;

    const interpolated: EnhancedChartDataPoint[] = [];

    for (let i = 0; i < this.buffer.length - 1; i++) {
      const current = this.buffer[i];
      const next = this.buffer[i + 1];

      interpolated.push(current);

      const gap = next.timestamp - current.timestamp;
      if (gap > maxGap) {
        const steps = Math.floor(gap / 1000); // Interpolate every second

        for (let step = 1; step < steps; step++) {
          const ratio = step / steps;
          const interpolatedPoint: EnhancedChartDataPoint = {
            timestamp: current.timestamp + gap * ratio,
            time: new Date(current.timestamp + gap * ratio).toLocaleTimeString(
              [],
              {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              },
            ),
            cpu: current.cpu + (next.cpu - current.cpu) * ratio,
            memory: current.memory + (next.memory - current.memory) * ratio,
            metadata: {
              source: "websocket",
              quality: "medium",
              interpolated: true,
            },
          };
          interpolated.push(interpolatedPoint);
        }
      }
    }

    // Add the last point
    interpolated.push(this.buffer[this.buffer.length - 1]);

    this.buffer = interpolated;
  }
}
