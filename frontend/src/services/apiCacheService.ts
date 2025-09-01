export interface APIConfig {
  endpoint: string;
  cacheTimeout: number; // milliseconds
  retryAttempts: number;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
}

export class APICacheService {
  private cache = new Map<string, CacheEntry>();
  private hitCount = 0;
  private missCount = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Default API configurations with per-endpoint timeouts
  private static readonly DEFAULT_CONFIGS: Record<string, APIConfig> = {
    containers: {
      endpoint: "/api/containers",
      cacheTimeout: 5000,
      retryAttempts: 3,
    },
    systemInfo: {
      endpoint: "/api/system/info",
      cacheTimeout: 10000,
      retryAttempts: 2,
    },
    containerMetrics: {
      endpoint: "/api/containers/metrics",
      cacheTimeout: 2000,
      retryAttempts: 3,
    },
    volumes: {
      endpoint: "/api/volumes",
      cacheTimeout: 15000,
      retryAttempts: 2,
    },
    images: { endpoint: "/api/images", cacheTimeout: 30000, retryAttempts: 2 },
    networks: {
      endpoint: "/api/networks",
      cacheTimeout: 20000,
      retryAttempts: 2,
    },
  };

  constructor() {
    // Start cleanup interval to remove expired entries
    this.startCleanupInterval();
  }

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      // Entry expired, remove it
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return entry.data;
  }

  /**
   * Set data in cache with specified timeout
   */
  set<T>(key: string, data: T, timeoutMs: number): void {
    const now = Date.now();
    const expiresAt = now + timeoutMs;

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
    });
  }

  /**
   * Set data using predefined API config
   */
  setWithConfig<T>(key: string, data: T, configKey: string): void {
    const config = APICacheService.DEFAULT_CONFIGS[configKey];
    if (config) {
      this.set(key, data, config.cacheTimeout);
    } else {
      // Fallback to 5 second timeout
      this.set(key, data, 5000);
    }
  }

  /**
   * Check if data exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove specific entry from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;
    const missRate = totalRequests > 0 ? this.missCount / totalRequests : 0;

    return {
      totalEntries: this.cache.size,
      totalSize: this.cache.size,
      hitRate,
      missRate,
    };
  }

  /**
   * Get all available API configurations
   */
  getAPIConfigs(): Record<string, APIConfig> {
    return { ...APICacheService.DEFAULT_CONFIGS };
  }

  /**
   * Update API configuration for a specific endpoint
   */
  updateAPIConfig(configKey: string, updates: Partial<APIConfig>): void {
    if (APICacheService.DEFAULT_CONFIGS[configKey]) {
      APICacheService.DEFAULT_CONFIGS[configKey] = {
        ...APICacheService.DEFAULT_CONFIGS[configKey],
        ...updates,
      };
    }
  }

  /**
   * Add new API configuration
   */
  addAPIConfig(configKey: string, config: APIConfig): void {
    APICacheService.DEFAULT_CONFIGS[configKey] = config;
  }

  /**
   * Remove expired entries from cache
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach((key) => this.cache.delete(key));
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    // Clean up expired entries every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30000);
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if cache is empty
   */
  isEmpty(): boolean {
    return this.cache.size === 0;
  }
}

// Export singleton instance
export const apiCacheService = new APICacheService();
