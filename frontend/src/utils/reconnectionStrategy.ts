export interface ReconnectionConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitterRange: number;
}

export interface ReconnectionState {
  attempt: number;
  nextDelay: number;
  isReconnecting: boolean;
}

export class ReconnectionStrategy {
  private config: ReconnectionConfig;
  private state: ReconnectionState;

  constructor(config: Partial<ReconnectionConfig> = {}) {
    this.config = {
      maxAttempts: 10,
      baseDelay: 2000, // 2 seconds
      maxDelay: 120000, // 120 seconds
      jitterRange: 1000, // 1 second
      ...config,
    };

    this.state = {
      attempt: 0,
      nextDelay: 0,
      isReconnecting: false,
    };
  }

  /**
   * Calculate the next reconnection delay with exponential backoff and jitter
   */
  getNextDelay(): number {
    if (this.state.attempt === 0) {
      return 0; // Immediate retry for first attempt
    }

    // Exponential backoff: baseDelay * 2^(attempt-1)
    const exponentialDelay =
      this.config.baseDelay * Math.pow(2, this.state.attempt - 1);

    // Add random jitter to prevent thundering herd
    const jitter = Math.random() * this.config.jitterRange;

    // Cap at maximum delay
    const delay = Math.min(exponentialDelay + jitter, this.config.maxDelay);

    return Math.round(delay);
  }

  /**
   * Start a reconnection attempt
   */
  startReconnection(): boolean {
    if (this.state.isReconnecting) {
      return false; // Already reconnecting
    }

    if (this.state.attempt >= this.config.maxAttempts) {
      return false; // Max attempts reached
    }

    this.state.isReconnecting = true;
    this.state.attempt++;
    this.state.nextDelay = this.getNextDelay();

    return true;
  }

  /**
   * Mark reconnection as successful
   */
  onReconnectionSuccess(): void {
    this.state.isReconnecting = false;
    this.state.attempt = 0;
    this.state.nextDelay = 0;
  }

  /**
   * Mark reconnection as failed
   */
  onReconnectionFailure(): void {
    this.state.isReconnecting = false;
  }

  /**
   * Check if we should attempt reconnection
   */
  shouldAttemptReconnection(): boolean {
    return this.state.attempt < this.config.maxAttempts;
  }

  /**
   * Get current reconnection state
   */
  getState(): ReconnectionState {
    return { ...this.state };
  }

  /**
   * Reset reconnection state
   */
  reset(): void {
    this.state = {
      attempt: 0,
      nextDelay: 0,
      isReconnecting: false,
    };
  }

  /**
   * Get formatted delay string for display
   */
  getDelayString(): string {
    if (this.state.nextDelay === 0) {
      return "immediate";
    }

    if (this.state.nextDelay < 1000) {
      return `${this.state.nextDelay}ms`;
    }

    if (this.state.nextDelay < 60000) {
      return `${Math.round(this.state.nextDelay / 1000)}s`;
    }

    return `${Math.round(this.state.nextDelay / 60000)}m`;
  }

  /**
   * Get progress percentage (0-100)
   */
  getProgressPercentage(): number {
    return Math.min((this.state.attempt / this.config.maxAttempts) * 100, 100);
  }
}
