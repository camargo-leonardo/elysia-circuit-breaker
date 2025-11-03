# Elysia Circuit Breaker Plugin

Plugin for the ElysiaJS framework that implements the **Circuit Breaker Pattern**, offering protection against cascading failures and ensuring resilience in external calls.

## 📦 Installation

```bash
bun add elysia-circuit-breaker
```

## 🎯 Features

- ✅ Complete Circuit Breaker Pattern implementation
- ✅ Three states: `CLOSED`, `OPEN`, `HALF-OPEN`
- ✅ Global and per-instance configuration
- ✅ Support for multiple circuit breakers
- ✅ Custom callbacks for state changes
- ✅ Configurable timeout for operations
- ✅ Real-time statistics
- ✅ Simple and intuitive API
- ✅ TypeScript with complete types

## 🚀 Basic Usage

```typescript
import { Elysia } from "elysia";
import { circuitBreaker } from "elysia-circuit-breaker";

const app = new Elysia()
  .use(circuitBreaker())
  .get("/api/users", async ({ breaker }) => {
    try {
      const result = await breaker.execute("users-api", async () => {
        // Your external call here
        return await fetch("https://api.example.com/users");
      });
      return result;
    } catch (error) {
      return { error: "Service unavailable" };
    }
  })
  .listen(3000);
```

## ⚙️ Configuration

### Global Configuration

```typescript
const app = new Elysia().use(
  circuitBreaker({
    defaultConfig: {
      failureThreshold: 5, // Number of failures to open the circuit
      resetTimeout: 60000, // Time in ms before attempting to close (1 minute)
      timeout: 30000, // Timeout for operations (30 seconds)
      onOpen: (name) => console.log(`Circuit ${name} opened`),
      onClose: (name) => console.log(`Circuit ${name} closed`),
      onHalfOpen: (name) => console.log(`Circuit ${name} half-open`),
    },
  })
);
```

### Pre-configured Circuit Breakers

```typescript
const app = new Elysia().use(
  circuitBreaker({
    breakers: {
      "payment-api": {
        failureThreshold: 3,
        resetTimeout: 30000,
      },
      "external-api": {
        failureThreshold: 10,
        resetTimeout: 120000,
      },
    },
  })
);
```

## 📊 Circuit Breaker States

### CLOSED

- Normal operation state
- All requests are processed
- Failures are counted
- When it reaches `failureThreshold`, transitions to OPEN

### OPEN

- Circuit is open
- Requests fail immediately without executing the function
- After `resetTimeout`, transitions to HALF-OPEN

### HALF-OPEN

- Testing state
- Allows only one attempt
- If successful, returns to CLOSED
- If it fails, returns to OPEN

## 🔧 API

### breaker.execute(name, fn, config?)

Executes a function with circuit breaker protection.

```typescript
app.get("/api/data", async ({ breaker }) => {
  const result = await breaker.execute(
    "my-api",
    async () => {
      return await fetchData();
    },
    {
      failureThreshold: 3,
      timeout: 5000,
    }
  );
  return result;
});
```

### breaker.get(name, config?)

Gets a circuit breaker instance.

```typescript
app.get("/api/data", async ({ breaker }) => {
  const cb = breaker.get("my-api", { failureThreshold: 5 });
  const result = await cb.execute(async () => fetchData());
  return result;
});
```

### breaker.getStats(name)

Returns statistics for a specific circuit breaker.

```typescript
app.get("/stats/:name", ({ breaker, params }) => {
  return breaker.getStats(params.name);
});

// Response:
// {
//   state: "closed",
//   failures: 0,
//   successes: 10,
//   totalCalls: 10,
//   lastFailureTime: undefined,
//   lastSuccessTime: 1699012345678
// }
```

### breaker.getAllStats()

Returns statistics for all circuit breakers.

```typescript
app.get("/stats", ({ breaker }) => {
  return breaker.getAllStats();
});
```

### breaker.reset(name)

Resets a specific circuit breaker to the CLOSED state.

```typescript
app.post("/reset/:name", ({ breaker, params }) => {
  breaker.reset(params.name);
  return { message: "Circuit breaker reset" };
});
```

### breaker.resetAll()

Resets all circuit breakers.

```typescript
app.post("/reset-all", ({ breaker }) => {
  breaker.resetAll();
  return { message: "All circuit breakers reset" };
});
```

### breaker.has(name)

Checks if a circuit breaker exists.

```typescript
app.get("/check/:name", ({ breaker, params }) => {
  return { exists: breaker.has(params.name) };
});
```

### breaker.remove(name)

Removes a circuit breaker.

```typescript
app.delete("/breaker/:name", ({ breaker, params }) => {
  const removed = breaker.remove(params.name);
  return { removed };
});
```

## 💡 Practical Examples

### External API Protection

```typescript
app.get("/weather/:city", async ({ breaker, params }) => {
  try {
    const weather = await breaker.execute("weather-api", async () => {
      const response = await fetch(
        `https://api.weather.com/data/${params.city}`
      );
      return response.json();
    });
    return weather;
  } catch (error) {
    return { error: "Weather service unavailable", city: params.city };
  }
});
```

### Database Protection

```typescript
app.get("/products", async ({ breaker }) => {
  try {
    const products = await breaker.execute(
      "database",
      async () => {
        return await db.query("SELECT * FROM products");
      },
      {
        timeout: 5000,
        failureThreshold: 3,
      }
    );
    return { products };
  } catch (error) {
    return { error: "Database unavailable", products: [] };
  }
});
```

### Multiple Services

```typescript
app.get("/dashboard", async ({ breaker }) => {
  const [users, orders, stats] = await Promise.allSettled([
    breaker.execute("users-service", () => fetchUsers()),
    breaker.execute("orders-service", () => fetchOrders()),
    breaker.execute("stats-service", () => fetchStats()),
  ]);

  return {
    users: users.status === "fulfilled" ? users.value : [],
    orders: orders.status === "fulfilled" ? orders.value : [],
    stats: stats.status === "fulfilled" ? stats.value : {},
  };
});
```

### Monitoring

```typescript
app.get("/health", ({ breaker }) => {
  const stats = breaker.getAllStats();
  const healthStatus = Object.entries(stats).map(([name, stat]) => ({
    service: name,
    healthy: stat.state === "closed",
    state: stat.state,
    successRate:
      stat.totalCalls > 0 ? (stat.successes / stat.totalCalls) * 100 : 100,
  }));

  const allHealthy = healthStatus.every((s) => s.healthy);

  return {
    status: allHealthy ? "healthy" : "degraded",
    services: healthStatus,
  };
});
```

## 🧪 Tests

Run the tests:

```bash
bun test circuit-breaker/test
```

## 📚 Additional Resources

- [Circuit Breaker Pattern (Martin Fowler)](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Elysia Documentation](https://elysiajs.com)

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please open an issue or pull request in the repository.
