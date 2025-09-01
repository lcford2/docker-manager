import { useTheme } from "@mui/material/styles";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  ChartData,
} from "chart.js";
import React, { useRef, useEffect, useMemo } from "react";
import { Line } from "react-chartjs-2";

import { ChartEngine, ChartEngineProps } from "../core/ChartEngine";
import {
  ChartEngineCapabilities,
  ChartEngineType,
  EnhancedChartConfig,
  EnhancedChartDataPoint,
} from "../core/ChartTypes";
import { PerformanceMonitor } from "../optimization/PerformanceMonitor";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export class ChartJsEngine extends ChartEngine {
  private performanceMonitor: PerformanceMonitor;

  constructor(config: EnhancedChartConfig) {
    super(config);
    this.performanceMonitor = new PerformanceMonitor(config.performance);
  }

  getEngineType(): ChartEngineType {
    return "chartjs";
  }

  getCapabilities(): ChartEngineCapabilities {
    return {
      supportsAnimation: true,
      supportsInteraction: true,
      supportsWebGL: false,
      maxDataPoints: 5000,
      performanceScore: 90,
    };
  }

  render(props: ChartEngineProps): React.ReactElement {
    return <ChartJsChart {...props} engine={this} />;
  }

  destroy(): void {
    this.performanceMonitor.clear();
  }

  updateData(data: EnhancedChartDataPoint[]): void {
    // Data updates are handled by React re-renders
  }

  resize(width: number, height: number): void {
    // ResponsiveContainer handles resizing automatically
  }
}

interface ChartJsChartProps extends ChartEngineProps {
  engine: ChartJsEngine;
}

const ChartJsChart: React.FC<ChartJsChartProps> = ({
  data,
  config,
  onPerformanceUpdate,
  onError,
  width,
  height,
  engine,
}) => {
  const theme = useTheme();
  const chartRef = useRef(null);

  // Performance monitoring
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
      renderTime: processingTime,
      memoryUsage: getMemoryUsage(), // Get real memory usage
      dataPoints: data.length,
      fps: 60, // Default to smooth rate
      lastUpdate: Date.now(),
      engine: "chartjs" as const,
    };

    if (data.length > 0) {
      onPerformanceUpdate?.(metrics);
    }
  }, [data, onPerformanceUpdate]);

  // Prepare chart data
  const chartData: ChartData<"line"> = useMemo(() => {
    const labels = data.map((point) => point.time);

    return {
      labels,
      datasets: [
        {
          label: "CPU %",
          data: data.map((point) => point.cpu),
          borderColor: config.theme.colors.cpu,
          backgroundColor: config.theme.gradients?.cpu
            ? `${config.theme.colors.cpu}20`
            : "transparent",
          borderWidth: 2,
          fill: config.theme.gradients ? "origin" : false,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: config.theme.colors.cpu,
          pointBorderColor: config.theme.colors.cpu,
        },
        {
          label: "Memory %",
          data: data.map((point) => point.memory),
          borderColor: config.theme.colors.memory,
          backgroundColor: config.theme.gradients?.memory
            ? `${config.theme.colors.memory}20`
            : "transparent",
          borderWidth: 2,
          fill: config.theme.gradients ? "origin" : false,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: config.theme.colors.memory,
          pointBorderColor: config.theme.colors.memory,
        },
      ],
    };
  }, [data, config.theme]);

  // Calculate Y-axis range
  const yAxisRange = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 100 };

    const allValues = data.flatMap((d) => [d.cpu, d.memory]);
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);

    const padding = (maxValue - minValue) * 0.1;
    return {
      min: Math.max(0, Math.floor(minValue - padding)),
      max: Math.min(100, Math.ceil(maxValue + padding)),
    };
  }, [data]);

  // Chart options
  const chartOptions: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: config.theme.animations.enabled
          ? config.theme.animations.duration
          : 0,
      },
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        title: {
          display: true,
          text: "Live Resource Usage",
          color: theme.palette.text.primary,
          font: {
            size: 16,
            weight: "bold",
          },
        },
        legend: {
          position: "top",
          labels: {
            color: theme.palette.text.primary,
            usePointStyle: true,
            font: {
              size: 12,
            },
          },
        },
        tooltip: {
          backgroundColor: theme.palette.background.paper,
          titleColor: theme.palette.text.primary,
          bodyColor: theme.palette.text.primary,
          borderColor: theme.palette.divider,
          borderWidth: 1,
          cornerRadius: theme.shape.borderRadius,
          displayColors: true,
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || "";
              const value = context.parsed.y;
              return `${label}: ${value.toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "category",
          display: true,
          title: {
            display: true,
            text: "Time",
            color: theme.palette.text.secondary,
          },
          ticks: {
            color: theme.palette.text.secondary,
            maxTicksLimit: 10,
            callback: function (value, index, values) {
              const label = this.getLabelForValue(value as number);
              if (config.time.includeSeconds) {
                return label;
              }
              // Remove seconds if not needed
              return label.split(":").slice(0, 2).join(":");
            },
          },
          grid: {
            color: config.theme.colors.grid,
            lineWidth: 1,
          },
        },
        y: {
          type: "linear",
          display: true,
          position: "left",
          min: yAxisRange.min,
          max: yAxisRange.max,
          title: {
            display: true,
            text: "Usage (%)",
            color: theme.palette.text.secondary,
          },
          ticks: {
            color: theme.palette.text.secondary,
            callback: function (value) {
              return `${value}%`;
            },
          },
          grid: {
            color: config.theme.colors.grid,
            lineWidth: 1,
          },
        },
      },
      elements: {
        line: {
          borderJoinStyle: "round",
          borderCapStyle: "round",
        },
      },
      // Performance optimizations
      parsing: false,
      normalized: true,
      spanGaps: true,
    }),
    [config, theme, yAxisRange],
  );

  // Add threshold lines plugin
  const thresholdPlugin = useMemo(
    () => ({
      id: "thresholdLines",
      afterDraw: (chart: ChartJS) => {
        if (!config.features.thresholdLines) return;

        const ctx = chart.ctx;
        const yAxis = chart.scales.y;
        const xAxis = chart.scales.x;

        ctx.save();

        // Warning line at 70%
        const warningY = yAxis.getPixelForValue(70);
        ctx.strokeStyle = config.theme.colors.warning;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(xAxis.left, warningY);
        ctx.lineTo(xAxis.right, warningY);
        ctx.stroke();

        // Warning label
        ctx.fillStyle = config.theme.colors.warning;
        ctx.font = "12px sans-serif";
        ctx.fillText("Warning", xAxis.right - 60, warningY - 5);

        // Critical line at 90%
        const criticalY = yAxis.getPixelForValue(90);
        ctx.strokeStyle = config.theme.colors.critical;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(xAxis.left, criticalY);
        ctx.lineTo(xAxis.right, criticalY);
        ctx.stroke();

        // Critical label
        ctx.fillStyle = config.theme.colors.critical;
        ctx.fillText("Critical", xAxis.right - 60, criticalY - 5);

        ctx.restore();
      },
    }),
    [config],
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Line
        ref={chartRef}
        data={chartData}
        options={chartOptions}
        plugins={config.features.thresholdLines ? [thresholdPlugin] : []}
      />
    </div>
  );
};

export default ChartJsEngine;
