import { 
  EnhancedChartDataPoint, 
  ChartEngineType, 
  ChartEngineCapabilities,
  ChartEngineConfig,
  EnhancedChartConfig,
  ChartPerformanceMetrics 
} from './ChartTypes';

export interface ChartEngineProps {
  data: EnhancedChartDataPoint[];
  config: EnhancedChartConfig;
  onPerformanceUpdate?: (metrics: ChartPerformanceMetrics) => void;
  onError?: (error: string) => void;
  width?: number;
  height?: number;
}

export abstract class ChartEngine {
  protected config: EnhancedChartConfig;
  protected performanceMetrics: ChartPerformanceMetrics;
  protected mounted: boolean = false;

  constructor(config: EnhancedChartConfig) {
    this.config = config;
    this.performanceMetrics = {
      renderTime: 0,
      memoryUsage: 0,
      dataPoints: 0,
      fps: 0,
      lastUpdate: Date.now(),
      engine: this.getEngineType(),
    };
  }

  abstract getEngineType(): ChartEngineType;
  abstract getCapabilities(): ChartEngineCapabilities;
  abstract render(props: ChartEngineProps): React.ReactElement;
  abstract destroy(): void;
  abstract updateData(data: EnhancedChartDataPoint[]): void;
  abstract resize(width: number, height: number): void;

  /**
   * Check if engine can handle the current data load
   */
  canHandle(dataPoints: number, features: string[]): boolean {
    const capabilities = this.getCapabilities();
    return dataPoints <= capabilities.maxDataPoints;
  }

  /**
   * Get performance score for engine selection
   */
  getPerformanceScore(dataPoints: number, features: string[]): number {
    const capabilities = this.getCapabilities();
    let score = capabilities.performanceScore;

    // Penalize if approaching data limits
    const dataRatio = dataPoints / capabilities.maxDataPoints;
    if (dataRatio > 0.8) {
      score *= (1 - dataRatio);
    }

    // Adjust for feature support
    if (features.includes('animation') && !capabilities.supportsAnimation) {
      score *= 0.7;
    }
    if (features.includes('interaction') && !capabilities.supportsInteraction) {
      score *= 0.8;
    }

    return score;
  }

  /**
   * Update performance metrics
   */
  protected updatePerformanceMetrics(renderTime: number, dataPoints: number): void {
    this.performanceMetrics = {
      ...this.performanceMetrics,
      renderTime,
      dataPoints,
      lastUpdate: Date.now(),
      fps: renderTime > 0 ? Math.round(1000 / renderTime) : 0,
    };
  }

  /**
   * Estimate memory usage
   */
  protected estimateMemoryUsage(): number {
    // Base estimation in MB
    return this.performanceMetrics.dataPoints * 0.001;
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): ChartPerformanceMetrics {
    return { ...this.performanceMetrics };
  }
}

export class ChartEngineManager {
  private engines: Map<ChartEngineType, ChartEngine> = new Map();
  private currentEngine: ChartEngine | null = null;
  private config: ChartEngineConfig;
  private performanceHistory: ChartPerformanceMetrics[] = [];

  constructor(config: ChartEngineConfig) {
    this.config = config;
  }

  /**
   * Register a chart engine
   */
  registerEngine(engine: ChartEngine): void {
    this.engines.set(engine.getEngineType(), engine);
  }

  /**
   * Select the best engine for current requirements
   */
  selectEngine(
    dataPoints: number, 
    features: string[] = [],
    forceEngine?: ChartEngineType
  ): ChartEngine | null {
    if (forceEngine && this.engines.has(forceEngine)) {
      const engine = this.engines.get(forceEngine)!;
      if (engine.canHandle(dataPoints, features)) {
        this.currentEngine = engine;
        return engine;
      }
    }

    // Auto-select based on performance and capabilities
    let bestEngine: ChartEngine | null = null;
    let bestScore = 0;

    // First try preferred engine
    if (this.engines.has(this.config.preferred)) {
      const preferred = this.engines.get(this.config.preferred)!;
      if (preferred.canHandle(dataPoints, features)) {
        bestEngine = preferred;
        bestScore = preferred.getPerformanceScore(dataPoints, features);
      }
    }

    // Try fallback engines if preferred doesn't work or auto-switch is enabled
    if (!bestEngine || (this.config.autoSwitch && bestScore < this.config.performanceThreshold)) {
      for (const engineType of this.config.fallbackOrder) {
        const engine = this.engines.get(engineType);
        if (engine && engine.canHandle(dataPoints, features)) {
          const score = engine.getPerformanceScore(dataPoints, features);
          if (score > bestScore) {
            bestEngine = engine;
            bestScore = score;
          }
        }
      }
    }

    if (bestEngine && bestEngine !== this.currentEngine) {
      this.switchEngine(bestEngine);
    }

    return bestEngine;
  }

  /**
   * Switch to a different engine
   */
  private switchEngine(newEngine: ChartEngine): void {
    if (this.currentEngine) {
      this.currentEngine.destroy();
    }
    this.currentEngine = newEngine;
    console.log(`Switched to ${newEngine.getEngineType()} chart engine`);
  }

  /**
   * Get current active engine
   */
  getCurrentEngine(): ChartEngine | null {
    return this.currentEngine;
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(metrics: ChartPerformanceMetrics): void {
    this.performanceHistory.push(metrics);
    
    // Keep only last 100 measurements
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100);
    }

    // Check if engine switch is needed
    if (this.config.autoSwitch && this.shouldSwitchEngine(metrics)) {
      const features = this.extractFeatures();
      this.selectEngine(metrics.dataPoints, features);
    }
  }

  /**
   * Determine if engine switch is needed based on performance
   */
  private shouldSwitchEngine(metrics: ChartPerformanceMetrics): boolean {
    if (this.performanceHistory.length < 10) return false;

    const recentMetrics = this.performanceHistory.slice(-10);
    const avgRenderTime = recentMetrics.reduce((sum, m) => sum + m.renderTime, 0) / recentMetrics.length;
    const avgFps = recentMetrics.reduce((sum, m) => sum + m.fps, 0) / recentMetrics.length;

    // Switch if performance is consistently poor
    return avgRenderTime > 50 || avgFps < 20;
  }

  /**
   * Extract features from current configuration
   */
  private extractFeatures(): string[] {
    const features: string[] = [];
    
    if (this.config.autoSwitch) features.push('autoSwitch');
    // Add more feature detection based on config
    
    return features;
  }

  /**
   * Get available engines
   */
  getAvailableEngines(): ChartEngineType[] {
    return Array.from(this.engines.keys());
  }

  /**
   * Get engine capabilities
   */
  getEngineCapabilities(engineType: ChartEngineType): ChartEngineCapabilities | null {
    const engine = this.engines.get(engineType);
    return engine ? engine.getCapabilities() : null;
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(): ChartPerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  /**
   * Destroy all engines
   */
  destroy(): void {
    this.engines.forEach(engine => engine.destroy());
    this.engines.clear();
    this.currentEngine = null;
    this.performanceHistory = [];
  }
}

// Engine detection utilities
export class EngineDetection {
  /**
   * Detect available chart engines in the environment
   */
  static detectAvailableEngines(): ChartEngineType[] {
    const available: ChartEngineType[] = [];

    // Check for Recharts
    try {
      require('recharts');
      available.push('recharts');
    } catch (e) {
      // Recharts not available
    }

    // Check for Chart.js
    try {
      require('chart.js');
      available.push('chartjs');
    } catch (e) {
      // Chart.js not available
    }

    // Canvas is always available in browser
    if (typeof HTMLCanvasElement !== 'undefined') {
      available.push('canvas');
    }

    // WebGL detection
    if (this.isWebGLAvailable()) {
      available.push('webgl');
    }

    return available;
  }

  /**
   * Check if WebGL is available
   */
  static isWebGLAvailable(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl !== null;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get device performance characteristics
   */
  static getDeviceCapabilities(): { 
    memory: number; 
    cores: number; 
    isMobile: boolean; 
    supportsWebGL: boolean;
  } {
    const nav = navigator as any;
    
    return {
      memory: nav.deviceMemory || 4, // GB, default to 4GB if unknown
      cores: nav.hardwareConcurrency || 4,
      isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      supportsWebGL: this.isWebGLAvailable(),
    };
  }

  /**
   * Get recommended engine based on device capabilities
   */
  static getRecommendedEngine(dataPoints: number): ChartEngineType {
    const capabilities = this.getDeviceCapabilities();
    const available = this.detectAvailableEngines();

    // High-end devices with lots of data
    if (capabilities.memory >= 8 && dataPoints > 1000 && available.includes('webgl')) {
      return 'webgl';
    }

    // Medium data loads
    if (dataPoints > 500 && available.includes('chartjs')) {
      return 'chartjs';
    }

    // Default to Recharts for smaller data sets
    if (available.includes('recharts')) {
      return 'recharts';
    }

    // Fallback to canvas
    return 'canvas';
  }
} 