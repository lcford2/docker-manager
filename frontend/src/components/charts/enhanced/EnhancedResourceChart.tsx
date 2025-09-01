import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Paper, Alert, CircularProgress, Typography, IconButton, Tooltip } from '@mui/material';
import { PlayArrow, Pause, Fullscreen, GetApp } from '@mui/icons-material';
import { ChartDataManager } from '../core/ChartDataManager';
import { ChartEngineManager, EngineDetection } from '../core/ChartEngine';
import { PerformanceMonitor } from '../optimization/PerformanceMonitor';
import RechartsEngine from '../engines/RechartsEngine';
import ChartJsEngine from '../engines/ChartJsEngine';
import CanvasEngine from '../engines/CanvasEngine';
import TimeRangeSelector from '../features/TimeRangeSelector';
import { 
  EnhancedChartConfig, 
  DEFAULT_CHART_CONFIG,
  ChartPerformanceMetrics,
  EnhancedChartDataPoint,
  TimeRange,
  ChartState 
} from '../core/ChartTypes';

export interface EnhancedResourceChartProps {
  // Data props
  data?: EnhancedChartDataPoint[];
  onDataUpdate?: (cpu: number, memory: number) => void;
  
  // Configuration
  config?: Partial<EnhancedChartConfig>;
  
  // Callbacks
  onPerformanceUpdate?: (metrics: ChartPerformanceMetrics) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: ChartState) => void;
  
  // Display options
  title?: string;
  height?: number;
  width?: number;
  showControls?: boolean;
  showTimeSelector?: boolean;
  showPerformanceMetrics?: boolean;
  
  // Feature flags
  enableLiveUpdates?: boolean;
  enableExport?: boolean;
  enableFullscreen?: boolean;
}

const EnhancedResourceChart: React.FC<EnhancedResourceChartProps> = ({
  data = [],
  onDataUpdate,
  config = {},
  onPerformanceUpdate,
  onError,
  onStateChange,
  title = "Live Resource Usage",
  height = 400,
  width,
  showControls = true,
  showTimeSelector = true,
  showPerformanceMetrics = false,
  enableLiveUpdates = true,
  enableExport = true,
  enableFullscreen = true,
}) => {
  // Merge default config with provided config
  const chartConfig = useMemo(() => ({
    ...DEFAULT_CHART_CONFIG,
    ...config,
  }), [config]);

  // State management
  const [chartState, setChartState] = useState<ChartState>({
    isLoading: false,
    isPaused: false,
    error: null,
    selectedTimeRange: {
      start: Date.now() - 5 * 60 * 1000, // Last 5 minutes
      end: Date.now(),
      preset: '5m',
    },
    zoomLevel: 1,
    panOffset: { x: 0, y: 0 },
    connectionStatus: 'connected',
  });

  const [currentMetrics, setCurrentMetrics] = useState<ChartPerformanceMetrics | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs for managers
  const dataManagerRef = useRef<ChartDataManager | null>(null);
  const engineManagerRef = useRef<ChartEngineManager | null>(null);
  const performanceMonitorRef = useRef<PerformanceMonitor | null>(null);

  // Initialize managers
  useEffect(() => {
    // Initialize data manager
    dataManagerRef.current = new ChartDataManager(
      chartConfig.data,
      chartConfig.time
    );

    // Initialize performance monitor
    performanceMonitorRef.current = new PerformanceMonitor(chartConfig.performance);

    // Initialize engine manager
    engineManagerRef.current = new ChartEngineManager(chartConfig.engine);

    // Register available engines
    const rechartsEngine = new RechartsEngine(chartConfig);
    const chartjsEngine = new ChartJsEngine(chartConfig);
    const canvasEngine = new CanvasEngine(chartConfig);

    engineManagerRef.current.registerEngine(rechartsEngine);
    engineManagerRef.current.registerEngine(chartjsEngine);
    engineManagerRef.current.registerEngine(canvasEngine);

    // Auto-select best engine
    const availableEngines = EngineDetection.detectAvailableEngines();
    const recommendedEngine = EngineDetection.getRecommendedEngine(50); // Use fixed value to prevent dependency
    
    if (availableEngines.includes(recommendedEngine)) {
      engineManagerRef.current.selectEngine(50, [], recommendedEngine);
    } else {
      engineManagerRef.current.selectEngine(50);
    }

    return () => {
      engineManagerRef.current?.destroy();
      performanceMonitorRef.current?.clear();
    };
  }, [chartConfig]); // Include chartConfig dependency as required

  // Processed chart data with performance optimization
  const processedData = useMemo(() => {
    if (!dataManagerRef.current) return [];
    
    // Get raw data and limit to reduce computation
    const rawData = dataManagerRef.current.getDataInRange(
      chartState.selectedTimeRange.start,
      chartState.selectedTimeRange.end
    );
    
    // If we have too much data, downsample for performance
    if (rawData.length > 50) {
      const step = Math.ceil(rawData.length / 25); // Keep only 25 points max (matching config)
      return rawData.filter((_, index) => index % step === 0);
    }
    
    return rawData;
  }, [chartState.selectedTimeRange]);



  // Add external data - use ref to track processed data to prevent infinite loops
  const processedDataRef = useRef<Set<number>>(new Set());
  
  useEffect(() => {
    if (!dataManagerRef.current) return;

    // Batch process data points to reduce overhead
    const newPoints = data.filter(point => !processedDataRef.current.has(point.timestamp));
    
    if (newPoints.length > 0) {
      newPoints.forEach(point => {
        dataManagerRef.current!.addDataPoint(point.cpu, point.memory, point.metadata?.source);
        processedDataRef.current.add(point.timestamp);
      });
      
      // Clean up old processed timestamps to prevent memory leaks
      if (processedDataRef.current.size > 200) {
        const timestampsArray = Array.from(processedDataRef.current);
        const oldTimestamps = timestampsArray.slice(0, timestampsArray.length - 100);
        oldTimestamps.forEach(ts => processedDataRef.current.delete(ts));
      }
    }
  }, [data]);

  // Performance monitoring with throttling and automatic optimization
  const lastPerformanceUpdate = useRef<number>(0);
  const poorPerformanceCount = useRef<number>(0);
  
  const handlePerformanceUpdate = useCallback((metrics: ChartPerformanceMetrics) => {
    const now = Date.now();
    // Throttle performance updates to max once per 200ms for better performance
    if (now - lastPerformanceUpdate.current < 200) {
      return;
    }
    lastPerformanceUpdate.current = now;

    setCurrentMetrics(metrics);
    onPerformanceUpdate?.(metrics);
    
    // Remove duplicate performance monitoring - engines already handle this
    // The PerformanceMonitor.endProfiling was causing duplicate memory alerts

    // Track poor performance and auto-optimize
    if (metrics.renderTime > 50 || metrics.fps < 15) {
      poorPerformanceCount.current++;
      
      // After 3 consecutive poor performance measurements, switch to simpler engine
      if (poorPerformanceCount.current >= 3 && engineManagerRef.current) {
        console.warn('Poor chart performance detected, switching to canvas engine');
        engineManagerRef.current.selectEngine(metrics.dataPoints, [], 'canvas');
        poorPerformanceCount.current = 0; // Reset counter
      }
    } else {
      poorPerformanceCount.current = 0; // Reset counter on good performance
    }

    // Auto-switch engine if performance is poor
    if (engineManagerRef.current && chartConfig.engine.autoSwitch) {
      engineManagerRef.current.updatePerformanceMetrics(metrics);
    }
  }, [onPerformanceUpdate, chartConfig.engine.autoSwitch]);

  // Control handlers
  const handlePlayPause = useCallback(() => {
    setChartState(prev => ({
      ...prev,
      isPaused: !prev.isPaused,
    }));
  }, []);

  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setChartState(prev => ({
      ...prev,
      selectedTimeRange: range,
    }));
  }, []);

  const handleExport = useCallback(() => {
    if (!dataManagerRef.current) return;

    const csvData = dataManagerRef.current.exportData('csv');
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resource-usage-${new Date().toISOString().slice(0, 19)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Error handling
  const handleError = useCallback((error: string) => {
    setChartState(prev => ({
      ...prev,
      error,
    }));
    onError?.(error);
  }, [onError]);

  // State change callback
  useEffect(() => {
    onStateChange?.(chartState);
  }, [chartState, onStateChange]);

  // Get current engine
  const currentEngine = engineManagerRef.current?.getCurrentEngine();

  // Render chart
  const renderChart = () => {
    if (!currentEngine) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress />
        </Box>
      );
    }

    return currentEngine.render({
      data: processedData,
      config: chartConfig,
      onPerformanceUpdate: handlePerformanceUpdate,
      onError: handleError,
      width,
      height,
    });
  };

  return (
    <Paper
      sx={{
        width: width || '100%',
        height: isFullscreen ? '100vh' : height,
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 'auto',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header with controls */}
      {(showControls || showTimeSelector) && (
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          {/* Title and Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
            
            {/* Connection Status */}
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: chartState.connectionStatus === 'connected' ? 'success.main' : 'error.main',
              }}
            />
          </Box>

          {/* Time Range Selector */}
          {showTimeSelector && (
            <TimeRangeSelector
              selectedRange={chartState.selectedTimeRange}
              onRangeChange={handleTimeRangeChange}
              disabled={chartState.isLoading}
            />
          )}

          {/* Control Buttons */}
          {showControls && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Play/Pause */}
              {enableLiveUpdates && (
                <Tooltip title={chartState.isPaused ? 'Resume' : 'Pause'}>
                  <IconButton onClick={handlePlayPause} size="small">
                    {chartState.isPaused ? <PlayArrow /> : <Pause />}
                  </IconButton>
                </Tooltip>
              )}

              {/* Export */}
              {enableExport && (
                <Tooltip title="Export Data">
                  <IconButton onClick={handleExport} size="small">
                    <GetApp />
                  </IconButton>
                </Tooltip>
              )}

              {/* Fullscreen */}
              {enableFullscreen && (
                <Tooltip title="Toggle Fullscreen">
                  <IconButton onClick={handleFullscreen} size="small">
                    <Fullscreen />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Error Display */}
      {chartState.error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {chartState.error}
        </Alert>
      )}

      {/* Chart Container */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {chartState.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          renderChart()
        )}
      </Box>

      {/* Performance Metrics Footer */}
      {showPerformanceMetrics && currentMetrics && (
        <Box
          sx={{
            p: 1,
            borderTop: 1,
            borderColor: 'divider',
            backgroundColor: 'background.default',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Engine: {currentMetrics.engine} | 
            Render: {currentMetrics.renderTime.toFixed(1)}ms | 
            FPS: {currentMetrics.fps} | 
            Points: {currentMetrics.dataPoints} |
            Memory: {currentMetrics.memoryUsage.toFixed(1)}MB
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default EnhancedResourceChart; 