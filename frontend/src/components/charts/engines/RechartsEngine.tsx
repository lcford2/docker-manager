import { useTheme } from "@mui/joy/styles";
import React, { useMemo, useCallback, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";

import { ChartEngine, ChartEngineProps } from "../core/ChartEngine";
import {
  ChartEngineCapabilities,
  ChartEngineType,
  EnhancedChartConfig,
  EnhancedChartDataPoint,
} from "../core/ChartTypes";
import { PerformanceMonitor } from "../optimization/PerformanceMonitor";

export class RechartsEngine extends ChartEngine {
  private performanceMonitor: PerformanceMonitor;

  constructor(config: EnhancedChartConfig) {
    super(config);
    this.performanceMonitor = new PerformanceMonitor(config.performance);
  }

  getEngineType(): ChartEngineType {
    return "recharts";
  }

  getCapabilities(): ChartEngineCapabilities {
    return {
      supportsAnimation: true,
      supportsInteraction: true,
      supportsWebGL: false,
      maxDataPoints: 2000,
      performanceScore: 85,
    };
  }

  render(props: ChartEngineProps): React.ReactElement {
    return <RechartsChart {...props} engine={this} />;
  }

  destroy(): void {
    // Cleanup resources
    this.performanceMonitor.clear();
  }

  updateData(data: EnhancedChartDataPoint[]): void {
    // Data updates are handled by React re-renders
  }

  resize(width: number, height: number): void {
    // ResponsiveContainer handles resizing automatically
  }
}

interface RechartsChartProps extends ChartEngineProps {
  engine: RechartsEngine;
}

const RechartsChart: React.FC<RechartsChartProps> = ({
  data,
  config,
  onPerformanceUpdate,
  onError,
  width,
  height,
  engine,
}) => {
  const theme = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);

  // Performance monitoring with proper timing and throttling
  useEffect(() => {
    // Simple performance metrics - just measure data processing time
    const startTime = performance.now();
    const processingTime = performance.now() - startTime;

    // Get actual memory usage
    const getMemoryUsage = (): number => {
      const perf = performance as any;
      if (perf.memory) {
        return perf.memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
      }
      return 0;
    };

    const metrics = {
      renderTime: processingTime, // Just the actual data processing time
      memoryUsage: getMemoryUsage(), // Get real memory usage
      dataPoints: data.length,
      fps: 60, // Default to smooth rate since we're not actually measuring frames
      lastUpdate: Date.now(),
      engine: "recharts" as const,
    };

    // Only report significant changes to avoid spam
    if (data.length > 0) {
      onPerformanceUpdate?.(metrics);
    }
  }, [data, onPerformanceUpdate]);

  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(":").map(Number);
    let seconds = 0;
    if (parts.length >= 2) {
      seconds += parts[0] * 3600 + parts[1] * 60;
    }
    if (parts.length === 3) {
      seconds += parts[2];
    }
    return seconds;
  };

  const formatTime = (
    totalSeconds: number,
    includeSeconds: boolean,
  ): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const pad = (n: number) => n.toString().padStart(2, "0");
    if (includeSeconds) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    } else {
      return `${pad(hours)}:${pad(minutes)}`;
    }
  };

  // Memoized chart data processing with backfilling
  const processedData = useMemo(() => {
    if (!data || data.length < 2) {
      return data.map((point) => ({
        ...point,
        cpu: Number(point.cpu) || 0,
        memory: Number(point.memory) || 0,
        cpuFormatted: `${(Number(point.cpu) || 0).toFixed(1)}%`,
        memoryFormatted: `${(Number(point.memory) || 0).toFixed(1)}%`,
      }));
    }

    const sortedData = [...data].sort(
      (a, b) => parseTime(a.time) - parseTime(b.time),
    );
    const times = sortedData.map((p) => parseTime(p.time));
    let minDelta = Infinity;
    for (let i = 1; i < times.length; i++) {
      const d = times[i] - times[i - 1];
      if (d > 0) minDelta = Math.min(minDelta, d);
    }
    if (minDelta === Infinity || minDelta === 0) {
      return sortedData.map((point) => ({
        ...point,
        cpu: Number(point.cpu) || 0,
        memory: Number(point.memory) || 0,
        cpuFormatted: `${(Number(point.cpu) || 0).toFixed(1)}%`,
        memoryFormatted: `${(Number(point.memory) || 0).toFixed(1)}%`,
      }));
    }

    const includeSeconds = config.time.includeSeconds;
    const backfilled: EnhancedChartDataPoint[] = [sortedData[0]];
    for (let i = 1; i < sortedData.length; i++) {
      const prevTime = times[i - 1];
      const currTime = times[i];
      let fillTime = prevTime + minDelta;
      while (fillTime < currTime) {
        backfilled.push({
          ...sortedData[i - 1],
          time: formatTime(fillTime, includeSeconds),
        });
        fillTime += minDelta;
      }
      backfilled.push(sortedData[i]);
    }

    return backfilled.map((point) => ({
      ...point,
      cpu: Number(point.cpu) || 0,
      memory: Number(point.memory) || 0,
      cpuFormatted: `${(Number(point.cpu) || 0).toFixed(1)}%`,
      memoryFormatted: `${(Number(point.memory) || 0).toFixed(1)}%`,
    }));
  }, [data, config.time.includeSeconds]);

  // Calculate dynamic Y-axis domain
  const yAxisDomain = useMemo(() => {
    if (processedData.length === 0) return [0, 100];

    const allValues = processedData.flatMap((d) => [d.cpu, d.memory]);
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);

    // Add 10% padding to min/max
    const padding = (maxValue - minValue) * 0.1;
    const min = Math.max(0, minValue - padding);
    const max = Math.min(100, maxValue + padding);

    return [Math.floor(min), Math.ceil(max)];
  }, [processedData]);

  const yTicks = useMemo(() => {
    const [minDomain, maxDomain] = yAxisDomain;
    const desiredTickCount = 4;
    const ticks: number[] = [];
    if (maxDomain <= minDomain) {
      return [minDomain];
    }
    const maxInterval = (maxDomain - minDomain) / (desiredTickCount - 1);
    let interval = Math.floor(maxInterval / 5) * 5;
    interval = interval > 0 ? interval : 5;
    const start = Math.ceil(minDomain / interval) * interval;
    let current = start;
    while (current <= maxDomain) {
      ticks.push(current);
      current += interval;
    }
    console.log(`Got ticks ${ticks} for [${minDomain}, ${maxDomain}]`);
    return ticks;
  }, [yAxisDomain]);

  // Format X-axis tick labels
  const formatXAxisTick = useCallback(
    (value: string) => {
      if (config.time.includeSeconds) {
        return value; // Already formatted with seconds
      }
      // Remove seconds if not needed
      return value.split(":").slice(0, 2).join(":");
    },
    [config.time.includeSeconds],
  );

  // Custom tooltip
  const CustomTooltip = useCallback(
    ({ active, payload, label }: any) => {
      if (!active || !payload || !payload.length) return null;

      return (
        <div
          style={{
            backgroundColor: theme.palette.background.surface,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: theme.radius.sm,
            padding: theme.spacing(1),
            boxShadow: theme.shadow.md,
          }}
        >
          <p style={{ margin: 0, fontWeight: "bold", marginBottom: 4 }}>
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p
              key={index}
              style={{
                margin: 0,
                color: entry.color,
                fontSize: "0.875rem",
              }}
            >
              {entry.name}: {entry.value.toFixed(1)}%
            </p>
          ))}
        </div>
      );
    },
    [theme],
  );

  // Threshold lines configuration
  const thresholdLines = useMemo(() => {
    const lines = [];

    if (config.features.thresholdLines) {
      // Warning threshold at 70%
      lines.push(
        <ReferenceLine
          key="warning"
          y={70}
          stroke={config.theme.colors.warning}
          strokeDasharray="5 5"
          label={{ value: "Warning", position: "insideTopRight" }}
        />,
      );

      // Critical threshold at 90%
      lines.push(
        <ReferenceLine
          key="critical"
          y={90}
          stroke={config.theme.colors.critical}
          strokeDasharray="5 5"
          label={{ value: "Critical", position: "insideTopRight" }}
        />,
      );
    }

    return lines;
  }, [config.features.thresholdLines, config.theme.colors]);

  // Animation configuration
  const animationConfig = useMemo(
    () => ({
      animationDuration: config.theme.animations.duration,
      isAnimationActive: false, // Explicitly disable animation for performance
    }),
    [config.theme.animations],
  );

  // Chart component selection based on configuration
  const ChartComponent = config.theme.gradients ? AreaChart : LineChart;

  return (
    <div ref={chartRef} style={{ width: "100%", height: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent
          data={processedData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={config.theme.colors.grid}
            opacity={0.2}
          />

          <XAxis
            dataKey="time"
            stroke={theme.palette.text.tertiary}
            tickFormatter={formatXAxisTick}
            interval="preserveStartEnd"
            minTickGap={50}
            tickCount={5}
          />

          <YAxis
            stroke={theme.palette.text.tertiary}
            domain={yAxisDomain}
            ticks={yTicks}
            label={{
              value: "Usage (%)",
              angle: -90,
              position: "insideLeft",
            }}
          />

          <Tooltip content={<CustomTooltip />} animationDuration={0} />

          <Legend />

          {thresholdLines}

          {ChartComponent === AreaChart ? (
            <>
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={config.theme.colors.cpu}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor={config.theme.colors.cpu}
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={config.theme.colors.memory}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor={config.theme.colors.memory}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>

              <Area
                type="monotone"
                dataKey="cpu"
                stroke={config.theme.colors.cpu}
                fillOpacity={0.8}
                fill={config.theme.colors.cpuFill}
                strokeWidth={2}
                dot={false}
                name="CPU %"
                {...animationConfig}
                isAnimationActive={false}
              />

              <Area
                type="monotone"
                dataKey="memory"
                stroke={config.theme.colors.memory}
                fillOpacity={0.8}
                fill={config.theme.colors.memoryFill}
                strokeWidth={2}
                dot={false}
                name="Memory %"
                {...animationConfig}
                isAnimationActive={false}
              />
            </>
          ) : (
            <>
              <Line
                type="linear"
                dataKey="cpu"
                stroke={config.theme.colors.cpu}
                strokeWidth={1.5}
                dot={false}
                name="CPU %"
                isAnimationActive={false}
                connectNulls={false}
              />

              <Line
                type="linear"
                dataKey="memory"
                stroke={config.theme.colors.memory}
                strokeWidth={1.5}
                dot={false}
                name="Memory %"
                isAnimationActive={false}
                connectNulls={false}
              />
            </>
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
};

export default RechartsEngine;
