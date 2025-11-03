import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { circuitBreaker } from '../index'
import { CircuitState } from '../types'

describe('Elysia Circuit Breaker Plugin', () => {
  describe('plugin integration', () => {
    it('should register plugin with Elysia', () => {
      const app = new Elysia().use(circuitBreaker())
      expect(app).toBeDefined()
    })

    it('should expose breaker in context', async () => {
      const app = new Elysia()
        .use(circuitBreaker())
        .get('/', ({ breaker }) => {
          expect(breaker).toBeDefined()
          expect(breaker.execute).toBeDefined()
          return 'ok'
        })

      await app.handle(new Request('http://localhost/'))
    })
  })

  describe('breaker.execute', () => {
    it('should execute function with circuit breaker', async () => {
      const app = new Elysia()
        .use(circuitBreaker())
        .get('/test', async ({ breaker }) => {
          const result = await breaker.execute('api-call', async () => {
            return { data: 'success' }
          })
          return result
        })

      const response = await app.handle(new Request('http://localhost/test'))
      const data = await response.json()
      expect(data).toEqual({ data: 'success' })
    })

    it('should handle failures', async () => {
      const app = new Elysia()
        .use(circuitBreaker())
        .get('/test', async ({ breaker }) => {
          try {
            await breaker.execute('failing-api', async () => {
              throw new Error('API failed')
            })
          } catch (error) {
            return { error: (error as Error).message }
          }
        })

      const response = await app.handle(new Request('http://localhost/test'))
      const data = await response.json()
      expect(data.error).toBe('API failed')
    })
  })

  describe('breaker.get', () => {
    it('should get circuit breaker instance', async () => {
      const app = new Elysia()
        .use(circuitBreaker())
        .get('/test', ({ breaker }) => {
          const cb = breaker.get('test-breaker')
          expect(cb).toBeDefined()
          expect(cb.getState()).toBe(CircuitState.CLOSED)
          return 'ok'
        })

      await app.handle(new Request('http://localhost/test'))
    })
  })

  describe('breaker.getStats', () => {
    it('should return stats for circuit breaker', async () => {
      const app = new Elysia()
        .use(circuitBreaker())
        .get('/call', async ({ breaker }) => {
          await breaker.execute('test-api', async () => 'success')
          return 'ok'
        })
        .get('/stats', ({ breaker }) => {
          const stats = breaker.getStats('test-api')
          return stats
        })

      await app.handle(new Request('http://localhost/call'))
      const response = await app.handle(new Request('http://localhost/stats'))
      const stats = await response.json()

      expect(stats).toBeDefined()
      expect(stats.successes).toBe(1)
    })
  })

  describe('breaker.getAllStats', () => {
    it('should return stats for all circuit breakers', async () => {
      const app = new Elysia()
        .use(circuitBreaker())
        .get('/call1', async ({ breaker }) => {
          await breaker.execute('api1', async () => 'success')
          return 'ok'
        })
        .get('/call2', async ({ breaker }) => {
          await breaker.execute('api2', async () => 'success')
          return 'ok'
        })
        .get('/stats', ({ breaker }) => {
          return breaker.getAllStats()
        })

      await app.handle(new Request('http://localhost/call1'))
      await app.handle(new Request('http://localhost/call2'))
      const response = await app.handle(new Request('http://localhost/stats'))
      const stats = await response.json()

      expect(Object.keys(stats)).toHaveLength(2)
      expect(stats.api1).toBeDefined()
      expect(stats.api2).toBeDefined()
    })
  })

  describe('default configuration', () => {
    it('should apply default config to all breakers', async () => {
      const app = new Elysia()
        .use(
          circuitBreaker({
            defaultConfig: {
              failureThreshold: 2,
            },
          }),
        )
        .get('/test', async ({ breaker }) => {
          const failingFn = async () => {
            throw new Error('fail')
          }

          // Should open after 2 failures
          for (let i = 0; i < 2; i++) {
            try {
              await breaker.execute('api', failingFn)
            } catch {
              // Expected error
            }
          }

          const stats = breaker.getStats('api')
          return { state: stats?.state }
        })

      const response = await app.handle(new Request('http://localhost/test'))
      const data = await response.json()
      expect(data.state).toBe(CircuitState.OPEN)
    })
  })

  describe('pre-configured breakers', () => {
    it('should pre-configure named breakers', async () => {
      const app = new Elysia()
        .use(
          circuitBreaker({
            breakers: {
              'external-api': {
                failureThreshold: 5,
                resetTimeout: 30000,
              },
            },
          }),
        )
        .get('/test', ({ breaker }) => {
          expect(breaker.has('external-api')).toBe(true)
          return 'ok'
        })

      await app.handle(new Request('http://localhost/test'))
    })
  })

  describe('breaker.reset', () => {
    it('should reset circuit breaker', async () => {
      const app = new Elysia()
        .use(circuitBreaker())
        .get('/test', async ({ breaker }) => {
          // Open the circuit
          const failingFn = async () => {
            throw new Error('fail')
          }
          for (let i = 0; i < 5; i++) {
            try {
              await breaker.execute('api', failingFn)
            } catch {
              // Expected error
            }
          }

          const statsBeforeReset = breaker.getStats('api')
          expect(statsBeforeReset?.state).toBe(CircuitState.OPEN)

          breaker.reset('api')

          const statsAfterReset = breaker.getStats('api')
          expect(statsAfterReset?.state).toBe(CircuitState.CLOSED)
          expect(statsAfterReset?.failures).toBe(0)

          return 'ok'
        })

      await app.handle(new Request('http://localhost/test'))
    })
  })

  describe('breaker.resetAll', () => {
    it('should reset all circuit breakers', async () => {
      const app = new Elysia()
        .use(circuitBreaker())
        .get('/test', async ({ breaker }) => {
          // Open multiple circuits
          const failingFn = async () => {
            throw new Error('fail')
          }
          for (let i = 0; i < 5; i++) {
            try {
              await breaker.execute('api1', failingFn)
            } catch {
              // Expected error
            }
          }
          for (let i = 0; i < 5; i++) {
            try {
              await breaker.execute('api2', failingFn)
            } catch {
              // Expected error
            }
          }

          breaker.resetAll()

          const stats1 = breaker.getStats('api1')
          const stats2 = breaker.getStats('api2')

          expect(stats1?.state).toBe(CircuitState.CLOSED)
          expect(stats2?.state).toBe(CircuitState.CLOSED)

          return 'ok'
        })

      await app.handle(new Request('http://localhost/test'))
    })
  })
})
