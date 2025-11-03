import { describe, expect, it, beforeEach } from "bun:test";
import { CircuitBreakerManager } from "../src/manager";
import { CircuitState } from "../src/types";

describe("CircuitBreakerManager", () => {
  let manager: CircuitBreakerManager;

  beforeEach(() => {
    manager = new CircuitBreakerManager();
  });

  describe("get", () => {
    it("should create a new circuit breaker if not exists", () => {
      const breaker = manager.get("test-breaker");
      expect(breaker).toBeDefined();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("should return existing circuit breaker", () => {
      const breaker1 = manager.get("test-breaker");
      const breaker2 = manager.get("test-breaker");
      expect(breaker1).toBe(breaker2);
    });

    it("should create circuit breaker with custom config", () => {
      const breaker = manager.get("test-breaker", {
        failureThreshold: 10,
      });
      expect(breaker).toBeDefined();
    });
  });

  describe("execute", () => {
    it("should execute function with circuit breaker protection", async () => {
      const result = await manager.execute(
        "test-breaker",
        async () => "success"
      );
      expect(result).toBe("success");
    });

    it("should create breaker on first execute", async () => {
      expect(manager.has("test-breaker")).toBe(false);
      await manager.execute("test-breaker", async () => "success");
      expect(manager.has("test-breaker")).toBe(true);
    });

    it("should use custom config", async () => {
      const failingFn = async () => {
        throw new Error("fail");
      };

      // Should open after 2 failures with custom config
      for (let i = 0; i < 2; i++) {
        try {
          await manager.execute("test-breaker", failingFn, {
            failureThreshold: 2,
          });
        } catch {
          // Expected error
        }
      }

      const stats = manager.getStats("test-breaker");
      expect(stats?.state).toBe(CircuitState.OPEN);
    });
  });

  describe("getStats", () => {
    it("should return stats for existing breaker", async () => {
      await manager.execute("test-breaker", async () => "success");
      const stats = manager.getStats("test-breaker");
      expect(stats).toBeDefined();
      expect(stats?.successes).toBe(1);
    });

    it("should return undefined for non-existing breaker", () => {
      const stats = manager.getStats("non-existing");
      expect(stats).toBeUndefined();
    });
  });

  describe("getAllStats", () => {
    it("should return stats for all breakers", async () => {
      await manager.execute("breaker1", async () => "success");
      await manager.execute("breaker2", async () => "success");

      const allStats = manager.getAllStats();
      expect(Object.keys(allStats)).toHaveLength(2);
      expect(allStats["breaker1"]).toBeDefined();
      expect(allStats["breaker2"]).toBeDefined();
    });

    it("should return empty object when no breakers exist", () => {
      const allStats = manager.getAllStats();
      expect(allStats).toEqual({});
    });
  });

  describe("reset", () => {
    it("should reset specific circuit breaker", async () => {
      const failingFn = async () => {
        throw new Error("fail");
      };

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute("test-breaker", failingFn, {
            failureThreshold: 3,
          });
        } catch {
          // Expected error
        }
      }

      const breaker = manager.get("test-breaker");
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      manager.reset("test-breaker");
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe("resetAll", () => {
    it("should reset all circuit breakers", async () => {
      const failingFn = async () => {
        throw new Error("fail");
      };

      // Open multiple circuits
      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute("breaker1", failingFn, { failureThreshold: 3 });
        } catch {
          // Expected error
        }
      }
      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute("breaker2", failingFn, { failureThreshold: 3 });
        } catch {
          // Expected error
        }
      }

      manager.resetAll();

      const breaker1 = manager.get("breaker1");
      const breaker2 = manager.get("breaker2");
      expect(breaker1.getState()).toBe(CircuitState.CLOSED);
      expect(breaker2.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe("remove", () => {
    it("should remove circuit breaker", async () => {
      await manager.execute("test-breaker", async () => "success");
      expect(manager.has("test-breaker")).toBe(true);

      const removed = manager.remove("test-breaker");
      expect(removed).toBe(true);
      expect(manager.has("test-breaker")).toBe(false);
    });

    it("should return false for non-existing breaker", () => {
      const removed = manager.remove("non-existing");
      expect(removed).toBe(false);
    });
  });

  describe("clear", () => {
    it("should clear all circuit breakers", async () => {
      await manager.execute("breaker1", async () => "success");
      await manager.execute("breaker2", async () => "success");

      expect(manager.has("breaker1")).toBe(true);
      expect(manager.has("breaker2")).toBe(true);

      manager.clear();

      expect(manager.has("breaker1")).toBe(false);
      expect(manager.has("breaker2")).toBe(false);
    });
  });

  describe("has", () => {
    it("should return true for existing breaker", async () => {
      await manager.execute("test-breaker", async () => "success");
      expect(manager.has("test-breaker")).toBe(true);
    });

    it("should return false for non-existing breaker", () => {
      expect(manager.has("non-existing")).toBe(false);
    });
  });
});
