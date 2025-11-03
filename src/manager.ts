import { CircuitBreaker } from "./circuit-breaker";
import { CircuitBreakerConfig, CircuitBreakerStats } from "./types";

export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker with the given name
   */
  get(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    name: string,
    fn: () => Promise<T>,
    config?: CircuitBreakerConfig
  ): Promise<T> {
    const breaker = this.get(name, config);
    return breaker.execute(fn);
  }

  /**
   * Get statistics for a specific circuit breaker
   */
  getStats(name: string): CircuitBreakerStats | undefined {
    return this.breakers.get(name)?.getStats();
  }

  /**
   * Get statistics for all circuit breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset a specific circuit breaker
   */
  reset(name: string): void {
    this.breakers.get(name)?.reset();
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Remove a circuit breaker
   */
  remove(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * Clear all circuit breakers
   */
  clear(): void {
    this.breakers.clear();
  }

  /**
   * Check if a circuit breaker exists
   */
  has(name: string): boolean {
    return this.breakers.has(name);
  }
}
