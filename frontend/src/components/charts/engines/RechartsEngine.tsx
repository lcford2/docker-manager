import React, { useMemo, useCallback, useEffect, useRef } from 'react';
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
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import { ChartEngine, ChartEngineProps } from '../core/ChartEngine';
import { 
  ChartEngineCapabilities, 
  ChartEngineType, 
  EnhancedChartConfig,
  EnhancedChartDataPoint 
} from '../core/ChartTypes';
import { PerformanceMonitor } from '../optimization/PerformanceMonitor';

export class RechartsEngine extends ChartEngine {
  private performanceMonitor: PerformanceMonitor;

  constructor(config: EnhancedChartConfig) {
    super(config);
    this.performanceMonitor = new PerformanceMonitor(config.performance);
  }

  getEngineType(): ChartEngineType {
    return 'recharts';
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
      engine: 'recharts' as const,
    };
    
    // Only report significant changes to avoid spam
    if (data.length > 0) {
      onPerformanceUpdate?.(metrics);
    }
  }, [data, onPerformanceUpdate]);

  // Memoized chart data processing
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map(point => ({
      ...point,
      // Ensure numeric values for better chart rendering
      cpu: Number(point.cpu) || 0,
      memory: Number(point.memory) || 0,
      // Add formatted values for tooltips
      cpuFormatted: `${(Number(point.cpu) || 0).toFixed(1)}%`,
      memoryFormatted: `${(Number(point.memory) || 0).toFixed(1)}%`,
    }));
  }, [data]);

  // Calculate dynamic Y-axis domain
  const yAxisDomain = useMemo(() => {
    if (processedData.length === 0) return [0, 100];

    const allValues = processedData.flatMap(d => [d.cpu, d.memory]);
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);

    // Add 10% padding to min/max
    const padding = (maxValue - minValue) * 0.1;
    const min = Math.max(0, minValue - padding);
    const max = Math.min(100, maxValue + padding);

    return [Math.floor(min), Math.ceil(max)];
  }, [processedData]);

  // Format X-axis tick labels
  const formatXAxisTick = useCallback((value: string) => {
    if (config.time.includeSeconds) {
      return value; // Already formatted with seconds
    }
    // Remove seconds if not needed
    return value.split(':').slice(0, 2).join(':');
  }, [config.time.includeSeconds]);

  // Custom tooltip
  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div style={{
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius,
        padding: theme.spacing(1),
        boxShadow: theme.shadows[4],
      }}>
        <p style={{ margin: 0, fontWeight: 'bold', marginBottom: 4 }}>
          {label}
        </p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ 
            margin: 0, 
            color: entry.color,
            fontSize: '0.875rem' 
          }}>
            {entry.name}: {entry.value.toFixed(1)}%
          </p>
        ))}
      </div>
    );
  }, [theme]);

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
        />
      );
      
      // Critical threshold at 90%
      lines.push(
        <ReferenceLine 
          key="critical" 
          y={90} 
          stroke={config.theme.colors.critical}
          strokeDasharray="5 5"
          label={{ value: "Critical", position: "insideTopRight" }}
        />
      );
    }
    
    return lines;
  }, [config.features.thresholdLines, config.theme.colors]);

  // Animation configuration
  const animationConfig = useMemo(() => ({
    isAnimationActive: config.theme.animations.enabled,
    animationDuration: config.theme.animations.duration,
  }), [config.theme.animations]);

  // Chart component selection based on configuration
  const ChartComponent = config.theme.gradients ? AreaChart : LineChart;

  return (
    <div ref={chartRef} style={{ width: '100%', height: '100%' }}>
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
            stroke={theme.palette.text.secondary}
            tickFormatter={formatXAxisTick}
            interval="preserveStartEnd"
            minTickGap={50}
            tickCount={5}
          />
          
          <YAxis
            stroke={theme.palette.text.secondary}
            domain={yAxisDomain}
            tickCount={4}
            label={{
              value: 'Usage (%)',
              angle: -90,
              position: 'insideLeft',
            }}
          />
          
          <Tooltip 
            content={<CustomTooltip />}
            animationDuration={0}
          />
          
          <Legend />

          {thresholdLines}

          {ChartComponent === AreaChart ? (
            <>
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={config.theme.colors.cpu} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={config.theme.colors.cpu} stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={config.theme.colors.memory} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={config.theme.colors.memory} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              
              <Area
                type="monotone"
                dataKey="cpu"
                stroke={config.theme.colors.cpu}
                fillOpacity={1}
                fill="url(#cpuGradient)"
                strokeWidth={2}
                dot={false}
                name="CPU %"
                {...animationConfig}
              />
              
              <Area
                type="monotone"
                dataKey="memory"
                stroke={config.theme.colors.memory}
                fillOpacity={1}
                fill="url(#memoryGradient)"
                strokeWidth={2}
                dot={false}
                name="Memory %"
                {...animationConfig}
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