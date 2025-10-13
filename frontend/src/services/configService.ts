/**
 * Configuration Service
 * Fetches and manages application configuration from the backend
 */

export interface WebSocketConfig {
  broadcastInterval: number;
  pingInterval: number;
  staleTimeout: number;
  maxReconnectAttempts: number;
  // Derived values (calculated from base config)
  containerBroadcastInterval: number;
  systemBroadcastInterval: number;
  staleCheckInterval: number;
  reconnectBaseDelay: number;
  reconnectMaxDelay: number;
  reconnectJitter: number;
  statusUpdateInterval: number;
}

export interface CacheConfig {
  defaultTtl: number;
  slowResourceTtl: number;
  retryAttempts: number;
  // Derived values (calculated from base config)
  containersTtl: number;
  systemInfoTtl: number;
  metricsTtl: number;
  volumesTtl: number;
  imagesTtl: number;
  networksTtl: number;
  cleanupInterval: number;
  retryContainers: number;
  retrySystemInfo: number;
  retryMetrics: number;
  retryVolumes: number;
  retryImages: number;
  retryNetworks: number;
}

export interface UIConfig {
  maxChartDataPoints: number;
  drawerWidth: number;
}

export interface AppConfig {
  websocket: WebSocketConfig;
  cache: CacheConfig;
  ui: UIConfig;
}

class ConfigService {
  private config: AppConfig | null = null;
  private loading: Promise<AppConfig> | null = null;

  /**
   * Load configuration from backend
   * Uses a promise to ensure only one fetch happens even with concurrent calls
   */
  async loadConfig(): Promise<AppConfig> {
    // Return cached config if available
    if (this.config) {
      return this.config;
    }

    // Return in-progress load if one exists
    if (this.loading) {
      return this.loading;
    }

    // Start new load
    this.loading = this.fetchConfig();

    try {
      this.config = await this.loading;
      return this.config;
    } finally {
      this.loading = null;
    }
  }

  /**
   * Fetch configuration from backend API
   */
  private async fetchConfig(): Promise<AppConfig> {
    try {
      const response = await fetch("/api/config");

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }

      const config = await response.json();
      console.log("Configuration loaded:", config);
      return config;
    } catch (error) {
      console.error("Failed to load configuration:", error);

      // Return defaults if fetch fails
      console.warn("Using default configuration values");
      return this.getDefaults();
    }
  }

  /**
   * Get current configuration
   * Throws error if config hasn't been loaded
   */
  getConfig(): AppConfig {
    if (!this.config) {
      throw new Error("Config not loaded. Call loadConfig() first.");
    }
    return this.config;
  }

  /**
   * Check if config is loaded
   */
  isLoaded(): boolean {
    return this.config !== null;
  }

  /**
   * Get default configuration values
   * Used as fallback if backend fetch fails
   */
  private getDefaults(): AppConfig {
    const broadcastInterval = 3;
    const defaultTtl = 5000;
    const slowResourceTtl = 20000;
    const retryAttempts = 3;

    return {
      websocket: {
        broadcastInterval,
        pingInterval: 30000,
        staleTimeout: 60000,
        maxReconnectAttempts: 10,
        // Derived values
        containerBroadcastInterval: broadcastInterval,
        systemBroadcastInterval: Math.round(broadcastInterval * 1.5),
        staleCheckInterval: 60000,
        reconnectBaseDelay: 2000,
        reconnectMaxDelay: 120000,
        reconnectJitter: 1000,
        statusUpdateInterval: 1000,
      },
      cache: {
        defaultTtl,
        slowResourceTtl,
        retryAttempts,
        // Derived values
        containersTtl: defaultTtl,
        systemInfoTtl: defaultTtl,
        metricsTtl: defaultTtl,
        networksTtl: defaultTtl,
        volumesTtl: slowResourceTtl,
        imagesTtl: slowResourceTtl,
        cleanupInterval: defaultTtl * 6,
        retryContainers: retryAttempts,
        retrySystemInfo: retryAttempts,
        retryMetrics: retryAttempts,
        retryVolumes: retryAttempts,
        retryImages: retryAttempts,
        retryNetworks: retryAttempts,
      },
      ui: {
        maxChartDataPoints: 60,
        drawerWidth: 240,
      },
    };
  }

  /**
   * Clear cached configuration
   * Useful for testing or forcing a reload
   */
  clearCache(): void {
    this.config = null;
  }
}

export const configService = new ConfigService();
