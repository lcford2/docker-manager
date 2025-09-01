import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { ChartEngine, ChartEngineProps } from '../core/ChartEngine';
import { 
  ChartEngineCapabilities, 
  ChartEngineType, 
  EnhancedChartConfig,
  EnhancedChartDataPoint 
} from '../core/ChartTypes';
import { PerformanceMonitor } from '../optimization/PerformanceMonitor';

export class CanvasEngine extends ChartEngine {
  private performanceMonitor: PerformanceMonitor;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;

  constructor(config: EnhancedChartConfig) {
    super(config);
    this.performanceMonitor = new PerformanceMonitor(config.performance);
  }

  getEngineType(): ChartEngineType {
    return 'canvas';
  }

  getCapabilities(): ChartEngineCapabilities {
    return {
      supportsAnimation: true,
      supportsInteraction: true,
      supportsWebGL: false,
      maxDataPoints: 10000,
      performanceScore: 95,
    };
  }

  render(props: ChartEngineProps): React.ReactElement {
    return <CanvasChart {...props} engine={this} />;
  }

  destroy(): void {
    this.performanceMonitor.clear();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  updateData(data: EnhancedChartDataPoint[]): void {
    // Data updates trigger re-renders through React
  }

  resize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  setCanvas(canvas: HTMLCanvasElement | null): void {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d') || null;
  }
}

interface CanvasChartProps extends ChartEngineProps {
  engine: CanvasEngine;
}

const CanvasChart: React.FC<CanvasChartProps> = ({
  data,
  config,
  onPerformanceUpdate,
  onError,
  width = 800,
  height = 400,
  engine,
}) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRenderTime = useRef<number>(0);

  // Set canvas reference in engine
  useEffect(() => {
    engine.setCanvas(canvasRef.current);
  }, [engine]);

  // Responsive canvas sizing
  useEffect(() => {
    const updateSize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Set actual size
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // Set display size
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      // Scale context for high-DPI displays
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Chart dimensions and padding
  const chartDimensions = useMemo(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { width: 800, height: 400, padding: 40, chartWidth: 720, chartHeight: 320 };

    const rect = canvas.getBoundingClientRect();
    const padding = 40;
    
    return {
      width: rect.width,
      height: rect.height,
      padding,
      chartWidth: rect.width - (padding * 2),
      chartHeight: rect.height - (padding * 2),
    };
  }, []);

  // Data processing and scaling
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return { points: [], xScale: 1, yScale: 1, minY: 0, maxY: 100 };

    // Calculate scales
    const minY = Math.min(...data.flatMap(d => [d.cpu, d.memory]));
    const maxY = Math.max(...data.flatMap(d => [d.cpu, d.memory]));
    const padding = (maxY - minY) * 0.1;
    const yMin = Math.max(0, minY - padding);
    const yMax = Math.min(100, maxY + padding);

    const xScale = chartDimensions.chartWidth / Math.max(data.length - 1, 1);
    const yScale = chartDimensions.chartHeight / (yMax - yMin);

    // Convert data to canvas coordinates
    const points = data.map((point, index) => ({
      x: chartDimensions.padding + (index * xScale),
      cpuY: chartDimensions.padding + chartDimensions.chartHeight - ((point.cpu - yMin) * yScale),
      memoryY: chartDimensions.padding + chartDimensions.chartHeight - ((point.memory - yMin) * yScale),
      time: point.time,
      cpu: point.cpu,
      memory: point.memory,
    }));

    return { points, xScale, yScale, minY: yMin, maxY: yMax };
  }, [data, chartDimensions]);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const startTime = performance.now();

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set up styles
    ctx.strokeStyle = config.theme.colors.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // Draw grid
    const { padding, chartWidth, chartHeight } = chartDimensions;
    
    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = padding + (i * chartWidth / 10);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, padding + chartHeight);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let i = 0; i <= 10; i++) {
      const y = padding + (i * chartHeight / 10);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + chartWidth, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Draw threshold lines if enabled
    if (config.features.thresholdLines) {
      const warningY = padding + chartHeight - ((70 - processedData.minY) * processedData.yScale);
      const criticalY = padding + chartHeight - ((90 - processedData.minY) * processedData.yScale);

      // Warning line
      ctx.strokeStyle = config.theme.colors.warning;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding, warningY);
      ctx.lineTo(padding + chartWidth, warningY);
      ctx.stroke();

      // Critical line
      ctx.strokeStyle = config.theme.colors.critical;
      ctx.beginPath();
      ctx.moveTo(padding, criticalY);
      ctx.lineTo(padding + chartWidth, criticalY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Labels
      ctx.fillStyle = config.theme.colors.warning;
      ctx.font = '12px sans-serif';
      ctx.fillText('Warning', padding + chartWidth - 60, warningY - 5);
      
      ctx.fillStyle = config.theme.colors.critical;
      ctx.fillText('Critical', padding + chartWidth - 60, criticalY - 5);
    }

    // Draw data lines
    if (processedData.points.length > 1) {
      // CPU line
      ctx.strokeStyle = config.theme.colors.cpu;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(processedData.points[0].x, processedData.points[0].cpuY);
      
      for (let i = 1; i < processedData.points.length; i++) {
        ctx.lineTo(processedData.points[i].x, processedData.points[i].cpuY);
      }
      ctx.stroke();

      // Memory line
      ctx.strokeStyle = config.theme.colors.memory;
      ctx.beginPath();
      ctx.moveTo(processedData.points[0].x, processedData.points[0].memoryY);
      
      for (let i = 1; i < processedData.points.length; i++) {
        ctx.lineTo(processedData.points[i].x, processedData.points[i].memoryY);
      }
      ctx.stroke();

      // Draw gradient fills if enabled
      if (config.theme.gradients) {
        // CPU gradient
        const cpuGradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
        cpuGradient.addColorStop(0, config.theme.colors.cpu + '40');
        cpuGradient.addColorStop(1, config.theme.colors.cpu + '10');
        
        ctx.fillStyle = cpuGradient;
        ctx.beginPath();
        ctx.moveTo(processedData.points[0].x, processedData.points[0].cpuY);
        
        for (let i = 1; i < processedData.points.length; i++) {
          ctx.lineTo(processedData.points[i].x, processedData.points[i].cpuY);
        }
        
        ctx.lineTo(processedData.points[processedData.points.length - 1].x, padding + chartHeight);
        ctx.lineTo(processedData.points[0].x, padding + chartHeight);
        ctx.closePath();
        ctx.fill();

        // Memory gradient  
        const memoryGradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
        memoryGradient.addColorStop(0, config.theme.colors.memory + '40');
        memoryGradient.addColorStop(1, config.theme.colors.memory + '10');
        
        ctx.fillStyle = memoryGradient;
        ctx.beginPath();
        ctx.moveTo(processedData.points[0].x, processedData.points[0].memoryY);
        
        for (let i = 1; i < processedData.points.length; i++) {
          ctx.lineTo(processedData.points[i].x, processedData.points[i].memoryY);
        }
        
        ctx.lineTo(processedData.points[processedData.points.length - 1].x, padding + chartHeight);
        ctx.lineTo(processedData.points[0].x, padding + chartHeight);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Draw axes
    ctx.strokeStyle = theme.palette.text.secondary;
    ctx.lineWidth = 1;
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + chartHeight);
    ctx.stroke();
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding, padding + chartHeight);
    ctx.lineTo(padding + chartWidth, padding + chartHeight);
    ctx.stroke();

    // Draw labels
    ctx.fillStyle = theme.palette.text.secondary;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    // Y-axis labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 10; i++) {
      const value = processedData.minY + ((processedData.maxY - processedData.minY) * (10 - i) / 10);
      const y = padding + (i * chartHeight / 10);
      ctx.fillText(`${value.toFixed(0)}%`, padding - 10, y + 4);
    }

    // X-axis labels (show every few points to avoid crowding)
    ctx.textAlign = 'center';
    const labelStep = Math.max(1, Math.floor(processedData.points.length / 8));
    for (let i = 0; i < processedData.points.length; i += labelStep) {
      const point = processedData.points[i];
      const label = config.time.includeSeconds ? point.time : point.time.split(':').slice(0, 2).join(':');
      ctx.fillText(label, point.x, padding + chartHeight + 20);
    }

    // Title
    ctx.fillStyle = theme.palette.text.primary;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Live Resource Usage', chartWidth / 2 + padding, 25);

    // Legend
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    
    // CPU legend
    ctx.fillStyle = config.theme.colors.cpu;
    ctx.fillRect(padding, padding + chartHeight + 35, 15, 3);
    ctx.fillText('CPU %', padding + 20, padding + chartHeight + 45);
    
    // Memory legend
    ctx.fillStyle = config.theme.colors.memory;
    ctx.fillRect(padding + 80, padding + chartHeight + 35, 15, 3);
    ctx.fillText('Memory %', padding + 100, padding + chartHeight + 45);

    const renderTime = performance.now() - startTime;
    lastRenderTime.current = renderTime;

    // Update performance metrics
    const metrics = {
      renderTime,
      memoryUsage: 0,
      dataPoints: data.length,
      fps: renderTime > 0 ? Math.round(1000 / renderTime) : 0,
      lastUpdate: Date.now(),
      engine: 'canvas' as const,
    };
    onPerformanceUpdate?.(metrics);

  }, [data, config, theme, chartDimensions, processedData, onPerformanceUpdate]);

  // Render when data changes
  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        minHeight: '300px'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </div>
  );
};

export default CanvasEngine; 