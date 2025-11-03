import { Elysia } from 'elysia'
import { circuitBreaker } from '../index'

// Simulate an external API call
async function callExternalAPI(shouldFail = false): Promise<{ data: string }> {
  await new Promise((resolve) => setTimeout(resolve, 100))
  if (shouldFail) {
    throw new Error('External API is down')
  }
  return { data: 'Success from external API' }
}

// Create Elysia app with circuit breaker plugin
const app = new Elysia()
  .use(
    circuitBreaker({
      // Default configuration for all circuit breakers
      defaultConfig: {
        failureThreshold: 3,
        resetTimeout: 5000, // 5 seconds
        timeout: 3000, // 3 seconds
        onOpen: (name) => console.log(`🔴 Circuit breaker "${name}" is now OPEN`),
        onClose: (name) =>
          console.log(`🟢 Circuit breaker "${name}" is now CLOSED`),
        onHalfOpen: (name) =>
          console.log(`🟡 Circuit breaker "${name}" is now HALF-OPEN`),
      },
      // Pre-configure specific circuit breakers
      breakers: {
        'payment-api': {
          failureThreshold: 5,
          resetTimeout: 10000,
        },
      },
    }),
  )
  // Example 1: Protected API call
  .get('/api/users', async ({ breaker }) => {
    try {
      const result = await breaker.execute('users-api', async () => {
        return callExternalAPI()
      })
      return result
    } catch (error) {
      return {
        error: (error as Error).message,
        message: 'Service temporarily unavailable',
      }
    }
  })
  // Example 2: Simulate failures
  .get('/api/users/fail', async ({ breaker }) => {
    try {
      const result = await breaker.execute('users-api', async () => {
        return callExternalAPI(true)
      })
      return result
    } catch (error) {
      return {
        error: (error as Error).message,
        message: 'Service temporarily unavailable',
      }
    }
  })
  // Example 3: Get circuit breaker statistics
  .get('/api/stats', ({ breaker }) => {
    return breaker.getAllStats()
  })
  // Example 4: Get specific circuit breaker stats
  .get('/api/stats/:name', ({ breaker, params: { name } }) => {
    const stats = breaker.getStats(name)
    if (!stats) {
      return { error: 'Circuit breaker not found' }
    }
    return stats
  })
  // Example 5: Reset circuit breaker
  .post('/api/reset/:name', ({ breaker, params: { name } }) => {
    breaker.reset(name)
    return { message: `Circuit breaker "${name}" has been reset` }
  })
  // Example 6: Reset all circuit breakers
  .post('/api/reset', ({ breaker }) => {
    breaker.resetAll()
    return { message: 'All circuit breakers have been reset' }
  })
  // Example 7: Database call with circuit breaker
  .get('/api/orders', async ({ breaker }) => {
    try {
      const result = await breaker.execute(
        'database',
        async () => {
          // Simulate database call
          await new Promise((resolve) => setTimeout(resolve, 50))
          return [
            { id: 1, product: 'Laptop', price: 1200 },
            { id: 2, product: 'Mouse', price: 25 },
          ]
        },
        {
          failureThreshold: 3,
          timeout: 1000,
        },
      )
      return { orders: result }
    } catch (error) {
      return {
        error: (error as Error).message,
        orders: [],
      }
    }
  })
  // Example 8: Payment API with pre-configured circuit breaker
  .post('/api/payment', async ({ breaker, body }) => {
    try {
      const result = await breaker.execute('payment-api', async () => {
        // Simulate payment processing
        await new Promise((resolve) => setTimeout(resolve, 200))
        return { transactionId: '123456', status: 'approved' }
      })
      return result
    } catch (error) {
      return {
        error: (error as Error).message,
        status: 'failed',
      }
    }
  })
  .listen(3000)

console.log(`
🚀 Circuit Breaker Example Server is running at ${app.server?.hostname}:${app.server?.port}

Try these endpoints:

📍 GET  /api/users          - Protected API call (success)
📍 GET  /api/users/fail     - Protected API call (fails to test circuit breaker)
📍 GET  /api/orders         - Database call with circuit breaker
📍 POST /api/payment        - Payment API with pre-configured circuit breaker
📍 GET  /api/stats          - Get all circuit breaker statistics
📍 GET  /api/stats/:name    - Get specific circuit breaker stats
📍 POST /api/reset/:name    - Reset specific circuit breaker
📍 POST /api/reset          - Reset all circuit breakers

Tips:
- Call /api/users/fail 3 times to open the circuit
- Then try /api/users to see the circuit breaker in action
- Check /api/stats to see current state
- Wait 5 seconds or call /api/reset/users-api to close the circuit
`)
