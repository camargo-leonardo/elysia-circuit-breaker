import { Elysia } from "elysia";
import { CircuitBreakerManager } from "./manager";
import { CircuitBreakerConfig } from "./types";

export interface CircuitBreakerPluginConfig {
  /**
   * Default configuration for all circuit breakers
   */
  defaultConfig?: CircuitBreakerConfig;

  /**
   * Named circuit breakers with specific configurations
   */
  breakers?: Record<string, CircuitBreakerConfig>;
}

export const circuitBreaker = (config: CircuitBreakerPluginConfig = {}) => {
  const manager = new CircuitBreakerManager();

  if (config.breakers) {
    for (const [name, breakerConfig] of Object.entries(config.breakers)) {
      manager.get(name, { ...config.defaultConfig, ...breakerConfig });
    }
  }

  return new Elysia({ name: "elysia-circuit-breaker" }).decorate({
    breaker: {
      /**
       * Execute a function with circuit breaker protection
       */
      execute: async <T>(
        name: string,
        fn: () => Promise<T>,
        breakerConfig?: CircuitBreakerConfig
      ): Promise<T> => {
        return manager.execute(name, fn, {
          ...config.defaultConfig,
          ...breakerConfig,
        });
      },

      /**
       * Get a circuit breaker instance
       */
      get: (name: string, breakerConfig?: CircuitBreakerConfig) => {
        return manager.get(name, {
          ...config.defaultConfig,
          ...breakerConfig,
        });
      },

      /**
       * Get statistics for a specific circuit breaker
       */
      getStats: (name: string) => manager.getStats(name),

      /**
       * Get statistics for all circuit breakers
       */
      getAllStats: () => manager.getAllStats(),

      /**
       * Reset a specific circuit breaker
       */
      reset: (name: string) => manager.reset(name),

      /**
       * Reset all circuit breakers
       */
      resetAll: () => manager.resetAll(),

      /**
       * Check if a circuit breaker exists
       */
      has: (name: string) => manager.has(name),

      /**
       * Remove a circuit breaker
       */
      remove: (name: string) => manager.remove(name),
    },
  });
};

export * from "./circuit-breaker";
export * from "./manager";
export * from "./types";
