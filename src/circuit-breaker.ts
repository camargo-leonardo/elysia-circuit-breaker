import {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStats,
} from "./types";

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly state: CircuitState
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private totalCalls = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private resetTimer?: ReturnType<typeof setTimeout>;

  private readonly config: Required<
    Omit<CircuitBreakerConfig, "onOpen" | "onClose" | "onHalfOpen">
  > & {
    onOpen?: (name: string) => void;
    onClose?: (name: string) => void;
    onHalfOpen?: (name: string) => void;
  };

  constructor(
    private readonly name: string,
    config: CircuitBreakerConfig = {}
  ) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeout: config.resetTimeout ?? 60000,
      timeout: config.timeout ?? 30000,
      onOpen: config.onOpen,
      onClose: config.onClose,
      onHalfOpen: config.onHalfOpen,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        throw new CircuitBreakerError(
          `Circuit breaker "${this.name}" is OPEN`,
          this.name,
          this.state
        );
      }
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  /**
   * Manually reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.clearResetTimer();
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error(`Request timeout after ${this.config.timeout}ms`)),
          this.config.timeout
        )
      ),
    ]);
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToClosed();
    }

    this.failures = 0;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
    } else if (this.failures >= this.config.failureThreshold) {
      this.transitionToOpen();
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime >= this.config.resetTimeout;
  }

  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.config.onOpen?.(this.name);
    this.scheduleReset();
  }

  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.config.onClose?.(this.name);
    this.clearResetTimer();
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.config.onHalfOpen?.(this.name);
  }

  private scheduleReset(): void {
    this.clearResetTimer();
    this.resetTimer = setTimeout(() => {
      if (this.state === CircuitState.OPEN) {
        this.transitionToHalfOpen();
      }
    }, this.config.resetTimeout);
  }

  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }
}
