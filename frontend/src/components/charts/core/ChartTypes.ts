export interface EnhancedChartDataPoint {
  timestamp: number; // Unix timestamp in milliseconds for precision
  time: string; // Formatted time string for display
  cpu: number;
  memory: number;
  metadata?: {
    source: "websocket" | "rest" | "cached";
    quality: "high" | "medium" | "low";
    interpolated?: boolean;
  };
}

export interface ChartTimeConfig {
  precision: "second" | "minute" | "hour";
  format: string;
  timezone?: string;
  includeSeconds: boolean;
}

export interface ChartDataBufferConfig {
  maxDataPoints: number;
  aggregationWindow: number; // milliseconds
  deduplicationThreshold: number; // milliseconds
  compressionEnabled: boolean;
}

export interface ChartPerformanceConfig {
  renderBudget: number; // milliseconds
  memoryLimit: number; // MB
  enableProfiling: boolean;
  throttleUpdates: boolean;
  throttleDelay: number; // milliseconds
}

export interface ChartEngineCapabilities {
  supportsAnimation: boolean;
  supportsInteraction: boolean;
  supportsWebGL: boolean;
  maxDataPoints: number;
  performanceScore: number;
}

export interface ChartEngineConfig {
  preferred: ChartEngineType;
  fallbackOrder: ChartEngineType[];
  autoSwitch: boolean;
  performanceThreshold: number;
}

export type ChartEngineType = "recharts" | "chartjs" | "canvas" | "webgl";

export interface ChartThemeConfig {
  name: string;
  colors: {
    cpu: string;
    memory: string;
    cpuFill: string;
    memoryFill: string;
    grid: string;
    background: string;
    text: string;
    warning: string;
    critical: string;
  };
  gradients: {
    cpu: string[];
    memory: string[];
  };
  animations: {
    enabled: boolean;
    duration: number;
    easing: string;
  };
}

export interface ChartInteractionConfig {
  zoom: {
    enabled: boolean;
    wheel: boolean;
    pinch: boolean;
    drag: boolean;
  };
  pan: {
    enabled: boolean;
    mouse: boolean;
    touch: boolean;
  };
  export: {
    formats: ("png" | "svg" | "csv" | "json")[];
    includeMetadata: boolean;
  };
}

export interface ChartResponsiveConfig {
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  adaptiveFeatures: {
    simplifyOnMobile: boolean;
    hideLabelsOnSmall: boolean;
    progressiveLoading: boolean;
  };
}

export interface EnhancedChartConfig {
  time: ChartTimeConfig;
  data: ChartDataBufferConfig;
  performance: ChartPerformanceConfig;
  engine: ChartEngineConfig;
  theme: ChartThemeConfig;
  interaction: ChartInteractionConfig;
  responsive: ChartResponsiveConfig;
  features: {
    liveUpdates: boolean;
    timeSelector: boolean;
    thresholdLines: boolean;
    connectionStatus: boolean;
    performanceMetrics: boolean;
  };
}

export interface ChartPerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  dataPoints: number;
  fps: number;
  lastUpdate: number;
  engine: ChartEngineType;
}

export interface ChartState {
  isLoading: boolean;
  isPaused: boolean;
  error: string | null;
  selectedTimeRange: TimeRange;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  connectionStatus: "connected" | "disconnected" | "reconnecting" | "error";
}

export interface TimeRange {
  start: number;
  end: number;
  preset?: "5m" | "1h" | "6h" | "24h" | "custom";
}

export interface ChartDataAggregation {
  method: "average" | "max" | "min" | "sum";
  windowSize: number;
  overlap: number;
}

export interface WebSocketEnhancedMessage {
  type: string;
  data: any;
  timestamp: number;
  compression?: "gzip" | "lz4" | "none";
  batch?: boolean;
  sequence?: number;
}

// Default configurations
export const DEFAULT_CHART_CONFIG: EnhancedChartConfig = {
  time: {
    precision: "second",
    format: "HH:mm:ss",
    includeSeconds: true,
  },
  // Data management - heavily reduced for better performance
  data: {
    maxDataPoints: 50, // Increased for better data visibility // Further reduced from 50 to 25
    aggregationWindow: 5000, // 5 second windows
    deduplicationThreshold: 1000, // 1 second threshold
    compressionEnabled: true,
  },

  // Performance configuration
  performance: {
    renderBudget: 16, // 16ms budget for 60fps
    memoryLimit: 100, // 100MB limit
    enableProfiling: false, // Disable profiling to reduce overhead
    throttleUpdates: true,
    throttleDelay: 200, // Reduced for more responsive updates // Increased throttling to 500ms
  },
  // Engine configuration
  engine: {
    preferred: "recharts" as ChartEngineType, // Changed back to recharts for consistency // Changed from 'recharts' to 'canvas' for better performance
    fallbackOrder: ["canvas", "recharts", "chartjs"],
    autoSwitch: false, // Disabled for stability
    performanceThreshold: 30,
  },
  theme: {
    name: "default",
    colors: {
      cpu: "#1976d2",
      memory: "#dc004e",
      cpuFill: "rgba(37, 99, 235, 0.8)",
      memoryFill: "rgba(220, 38, 38, 0.8)",
      grid: "#e0e0e0",
      background: "#ffffff",
      text: "#333333",
      warning: "#ff9800",
      critical: "#f44336",
    },
    gradients: {
      cpu: ["#1976d2", "#42a5f5"],
      memory: ["#dc004e", "#e91e63"],
    },
    animations: {
      enabled: false, // Disable animations for better performance
      duration: 150, // Reduced duration when enabled
      easing: "ease-in-out",
    },
  },
  interaction: {
    zoom: {
      enabled: true,
      wheel: true,
      pinch: true,
      drag: false,
    },
    pan: {
      enabled: true,
      mouse: true,
      touch: true,
    },
    export: {
      formats: ["png", "csv"],
      includeMetadata: true,
    },
  },
  responsive: {
    breakpoints: {
      mobile: 768,
      tablet: 1024,
      desktop: 1200,
    },
    adaptiveFeatures: {
      simplifyOnMobile: true,
      hideLabelsOnSmall: true,
      progressiveLoading: false,
    },
  },
  features: {
    liveUpdates: true,
    timeSelector: false, // Disable for better performance
    thresholdLines: false, // Disable for better performance
    connectionStatus: true,
    performanceMetrics: false,
  },
};
