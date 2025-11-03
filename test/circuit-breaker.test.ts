import { describe, expect, it, beforeEach } from 'bun:test'
import { CircuitBreaker, CircuitBreakerError } from '../circuit-breaker'
import { CircuitState } from '../types'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    breaker = new CircuitBreaker('test-breaker', {
      failureThreshold: 3,
      resetTimeout: 100,
      timeout: 50,
    })
  })

  describe('CLOSED state', () => {
    it('should execute function successfully', async () => {
      const result = await breaker.execute(async () => 'success')
      expect(result).toBe('success')
      expect(breaker.getState()).toBe(CircuitState.CLOSED)
    })

    it('should track failures', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('fail')
        })
      } catch {
        // Expected error
      }

      const stats = breaker.getStats()
      expect(stats.failures).toBe(1)
      expect(stats.state).toBe(CircuitState.CLOSED)
    })

    it('should open circuit after threshold failures', async () => {
      const failingFn = async () => {
        throw new Error('fail')
      }

      // Execute 3 times to reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn)
        } catch {
          // Expected error
        }
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN)
    })
  })

  describe('OPEN state', () => {
    beforeEach(async () => {
      // Force circuit to open
      const failingFn = async () => {
        throw new Error('fail')
      }
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn)
        } catch {
          // Expected error
        }
      }
    })

    it('should reject calls immediately', async () => {
      try {
        await breaker.execute(async () => 'success')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerError)
        expect((error as CircuitBreakerError).circuitName).toBe('test-breaker')
      }
    })

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Next call should transition to HALF_OPEN
      await breaker.execute(async () => 'success')
      expect(breaker.getState()).toBe(CircuitState.CLOSED)
    })
  })

  describe('HALF_OPEN state', () => {
    beforeEach(async () => {
      // Force circuit to open
      const failingFn = async () => {
        throw new Error('fail')
      }
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn)
        } catch {
          // Expected error
        }
      }
      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150))
    })

    it('should close circuit on successful call', async () => {
      const result = await breaker.execute(async () => 'success')
      expect(result).toBe('success')
      expect(breaker.getState()).toBe(CircuitState.CLOSED)
    })

    it('should reopen circuit on failed call', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('fail')
        })
      } catch {
        // Expected error
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN)
    })
  })

  describe('timeout', () => {
    it('should timeout slow operations', async () => {
      try {
        await breaker.execute(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return 'too slow'
        })
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('timeout')
      }
    })
  })

  describe('statistics', () => {
    it('should track statistics correctly', async () => {
      await breaker.execute(async () => 'success')
      await breaker.execute(async () => 'success')

      try {
        await breaker.execute(async () => {
          throw new Error('fail')
        })
      } catch {
        // Expected error
      }

      const stats = breaker.getStats()
      expect(stats.successes).toBe(2)
      expect(stats.failures).toBe(1)
      expect(stats.totalCalls).toBe(3)
      expect(stats.lastSuccessTime).toBeDefined()
      expect(stats.lastFailureTime).toBeDefined()
    })
  })

  describe('reset', () => {
    it('should reset circuit to closed state', async () => {
      // Force circuit to open
      const failingFn = async () => {
        throw new Error('fail')
      }
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn)
        } catch {
          // Expected error
        }
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN)

      breaker.reset()
      expect(breaker.getState()).toBe(CircuitState.CLOSED)
      expect(breaker.getStats().failures).toBe(0)
    })
  })

  describe('callbacks', () => {
    it('should call onOpen callback', async () => {
      let called = false
      const breakerWithCallback = new CircuitBreaker('test', {
        failureThreshold: 2,
        onOpen: (name) => {
          called = true
          expect(name).toBe('test')
        },
      })

      const failingFn = async () => {
        throw new Error('fail')
      }

      for (let i = 0; i < 2; i++) {
        try {
          await breakerWithCallback.execute(failingFn)
        } catch {
          // Expected error
        }
      }

      expect(called).toBe(true)
    })

    it('should call onClose callback', async () => {
      let called = false
      const breakerWithCallback = new CircuitBreaker('test', {
        failureThreshold: 2,
        resetTimeout: 50,
        onClose: (name) => {
          called = true
          expect(name).toBe('test')
        },
      })

      // Open the circuit
      const failingFn = async () => {
        throw new Error('fail')
      }
      for (let i = 0; i < 2; i++) {
        try {
          await breakerWithCallback.execute(failingFn)
        } catch {
          // Expected error
        }
      }

      // Wait and execute success to close
      await new Promise((resolve) => setTimeout(resolve, 100))
      await breakerWithCallback.execute(async () => 'success')

      expect(called).toBe(true)
    })

    it('should call onHalfOpen callback', async () => {
      let called = false
      const breakerWithCallback = new CircuitBreaker('test', {
        failureThreshold: 2,
        resetTimeout: 50,
        onHalfOpen: (name) => {
          called = true
          expect(name).toBe('test')
        },
      })

      // Open the circuit
      const failingFn = async () => {
        throw new Error('fail')
      }
      for (let i = 0; i < 2; i++) {
        try {
          await breakerWithCallback.execute(failingFn)
        } catch {
          // Expected error
        }
      }

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 100))

      // This should trigger half-open
      await breakerWithCallback.execute(async () => 'success')

      expect(called).toBe(true)
    })
  })
})
