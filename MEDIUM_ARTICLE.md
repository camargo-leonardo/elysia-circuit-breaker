# Circuit Breaker para ElysiaJS: Construindo APIs Resilientes em JavaScript

## Por que decidi criar este plugin?

Após anos trabalhando com arquiteturas de microserviços e APIs distribuídas, me deparei repetidamente com o mesmo problema: **falhas em cascata**. Você sabe aquele cenário onde um serviço externo começa a falhar e, em questão de minutos, toda a sua aplicação fica inutilizável? Pois é, isso acontece com mais frequência do que gostaríamos de admitir.

Como analista de software sênior especializado em JavaScript, sempre admirei a simplicidade e performance do **ElysiaJS** — um framework web moderno construído sobre o Bun que promete ser um dos mais rápidos do mercado. No entanto, notei a falta de um plugin nativo que implementasse o padrão Circuit Breaker de forma elegante e type-safe. Foi assim que nasceu o **elysia-circuit-breaker**.

## O Problema: Quando Tudo Começa a Desmoronar

Imagine o seguinte cenário: você construiu uma API de e-commerce que depende de três serviços externos:
- Um serviço de pagamento
- Uma API de consulta de CEP
- Um sistema de gestão de estoque

Tudo funciona perfeitamente até que, em um belo dia, o serviço de pagamento começa a responder lentamente ou simplesmente para de responder. O que acontece?

1. **Requisições se acumulam**: Cada tentativa de processar um pagamento fica esperando até o timeout
2. **Recursos se esgotam**: Threads, conexões e memória começam a se esgotar
3. **Efeito dominó**: Outros serviços começam a falhar porque a aplicação está sobrecarregada
4. **Sistema inteiro cai**: Em questão de minutos, sua API inteira está indisponível

Este é o clássico exemplo de **falha em cascata**, e é exatamente o que o padrão Circuit Breaker foi projetado para prevenir.

## A Solução: O Padrão Circuit Breaker

O Circuit Breaker funciona exatamente como um disjuntor elétrico na sua casa. Quando detecta problemas (sobrecarga), ele "abre o circuito" e impede que mais requisições sejam feitas para o serviço problemático, protegendo assim toda a aplicação.

### Os Três Estados do Circuit Breaker

#### 🟢 CLOSED (Fechado - Normal)
- **O que significa**: O circuito está fechado, tudo funcionando normalmente
- **Comportamento**: Todas as requisições são processadas normalmente
- **Transição**: Se o número de falhas atingir o threshold configurado, vai para OPEN

#### 🔴 OPEN (Aberto - Circuito Aberto)
- **O que significa**: Detectamos um problema, circuito está aberto
- **Comportamento**: Requisições falham imediatamente sem executar a função (fail-fast)
- **Benefício**: Evita sobrecarregar o serviço que já está com problemas
- **Transição**: Após um tempo configurável (resetTimeout), vai para HALF-OPEN

#### 🟡 HALF-OPEN (Meio-Aberto - Teste)
- **O que significa**: Vamos tentar novamente para ver se o serviço recuperou
- **Comportamento**: Permite uma única tentativa de execução
- **Transição**: 
  - Se sucesso → volta para CLOSED (serviço recuperou!)
  - Se falha → volta para OPEN (ainda com problemas)

## Como Funciona na Prática: Exemplos Reais

### Instalação

```bash
bun add elysia-circuit-breaker
```

### Exemplo 1: Proteção Básica de API Externa

```typescript
import { Elysia } from "elysia";
import { circuitBreaker } from "elysia-circuit-breaker";

const app = new Elysia()
  .use(circuitBreaker())
  .get("/weather/:city", async ({ breaker, params }) => {
    try {
      const weather = await breaker.execute("weather-api", async () => {
        const response = await fetch(
          `https://api.weather.com/data/${params.city}`
        );
        return response.json();
      });
      
      return { 
        success: true, 
        data: weather 
      };
    } catch (error) {
      // O circuito está aberto ou houve erro real
      return { 
        success: false, 
        error: "Serviço de clima temporariamente indisponível",
        useCache: true // Poderia retornar dados em cache aqui
      };
    }
  })
  .listen(3000);
```

**O que acontece aqui?**

1. Primeira requisição falha → contador de falhas incrementa
2. Segunda requisição falha → contador incrementa novamente
3. Terceira requisição falha → contador incrementa
4. Quarta requisição falha → contador incrementa
5. Quinta requisição falha → **BOOM!** Circuito abre automaticamente
6. Sexta requisição → Falha imediatamente, sem nem tentar (economizando recursos!)
7. Após 60 segundos → Tenta novamente (estado HALF-OPEN)

### Exemplo 2: Configuração Personalizada

```typescript
const app = new Elysia()
  .use(
    circuitBreaker({
      defaultConfig: {
        failureThreshold: 3,      // Abre após 3 falhas
        resetTimeout: 30000,       // Tenta de novo após 30s
        timeout: 5000,             // Timeout de 5s por requisição
        onOpen: (name) => {
          console.log(`🔴 Circuito ${name} aberto!`);
          // Aqui você pode enviar alerta para seu sistema de monitoramento
          sendAlert(`Circuit ${name} is OPEN`);
        },
        onClose: (name) => {
          console.log(`🟢 Circuito ${name} recuperado!`);
        },
        onHalfOpen: (name) => {
          console.log(`🟡 Testando circuito ${name}...`);
        }
      },
      // Configurações específicas para serviços críticos
      breakers: {
        "payment-api": {
          failureThreshold: 2,    // Mais sensível para pagamentos
          resetTimeout: 60000,     // Espera mais antes de tentar
        },
        "analytics-api": {
          failureThreshold: 10,   // Menos sensível para analytics
          resetTimeout: 15000,    // Tenta mais rápido
        }
      }
    })
  );
```

### Exemplo 3: Múltiplos Serviços com Fallback

```typescript
app.get("/dashboard", async ({ breaker }) => {
  // Chama múltiplos serviços em paralelo, cada um com sua proteção
  const [users, orders, metrics] = await Promise.allSettled([
    breaker.execute("users-service", () => fetchUsers()),
    breaker.execute("orders-service", () => fetchOrders()),
    breaker.execute("metrics-service", () => fetchMetrics())
  ]);

  return {
    users: users.status === "fulfilled" 
      ? users.value 
      : [], // Fallback: array vazio
    orders: orders.status === "fulfilled" 
      ? orders.value 
      : [],
    metrics: metrics.status === "fulfilled" 
      ? metrics.value 
      : { visits: 0, sales: 0 }, // Fallback: valores padrão
    warnings: [
      users.status === "rejected" && "Serviço de usuários indisponível",
      orders.status === "rejected" && "Serviço de pedidos indisponível",
      metrics.status === "rejected" && "Serviço de métricas indisponível"
    ].filter(Boolean)
  };
});
```

**Por que isso é poderoso?**

Se um dos serviços falhar, o dashboard ainda funciona com os outros dados! O usuário recebe uma experiência degradada, mas não uma tela branca de erro.

### Exemplo 4: Monitoramento e Observabilidade

```typescript
app.get("/health", ({ breaker }) => {
  const allStats = breaker.getAllStats();
  
  const services = Object.entries(allStats).map(([name, stats]) => {
    const successRate = stats.totalCalls > 0 
      ? (stats.successes / stats.totalCalls) * 100 
      : 100;
    
    return {
      name,
      healthy: stats.state === "closed",
      state: stats.state,
      successRate: successRate.toFixed(2) + "%",
      totalCalls: stats.totalCalls,
      failures: stats.failures,
      successes: stats.successes,
      lastFailure: stats.lastFailureTime 
        ? new Date(stats.lastFailureTime).toISOString() 
        : null
    };
  });

  const systemHealthy = services.every(s => s.healthy);

  return {
    status: systemHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    services
  };
});
```

Este endpoint te dá uma visão completa do estado da sua aplicação:

```json
{
  "status": "degraded",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": [
    {
      "name": "payment-api",
      "healthy": false,
      "state": "open",
      "successRate": "60.00%",
      "totalCalls": 100,
      "failures": 40,
      "successes": 60,
      "lastFailure": "2024-01-15T10:29:45.000Z"
    },
    {
      "name": "users-api",
      "healthy": true,
      "state": "closed",
      "successRate": "99.50%",
      "totalCalls": 200,
      "failures": 1,
      "successes": 199,
      "lastFailure": "2024-01-15T09:15:30.000Z"
    }
  ]
}
```

### Exemplo 5: Proteção de Banco de Dados

```typescript
app.get("/products", async ({ breaker }) => {
  try {
    const products = await breaker.execute(
      "database",
      async () => {
        return await db.query("SELECT * FROM products WHERE active = true");
      },
      {
        timeout: 3000,          // Queries não devem demorar mais que 3s
        failureThreshold: 5     // Mais tolerante com banco
      }
    );
    
    return { products };
  } catch (error) {
    // Poderia retornar dados do cache Redis aqui
    return {
      products: await getProductsFromCache(),
      warning: "Dados podem estar desatualizados"
    };
  }
});
```

## Por Que Criei Este Plugin?

### 1. **Type Safety é Fundamental**
Como desenvolvedor TypeScript, não consigo mais trabalhar sem type safety. O plugin é totalmente tipado, oferecendo autocomplete e validação em tempo de desenvolvimento.

### 2. **ElysiaJS Merecia um Circuit Breaker de Qualidade**
ElysiaJS é incrivelmente rápido, mas faltava uma solução nativa para resiliência. Este plugin preenche essa lacuna de forma elegante.

### 3. **API Simples e Intuitiva**
Cansei de bibliotecas complicadas. Quis criar algo que qualquer desenvolvedor pudesse entender e usar em minutos:

```typescript
// É literalmente isso!
await breaker.execute("meu-servico", async () => {
  return await minhaFuncao();
});
```

### 4. **Observabilidade Built-in**
Em produção, você precisa saber o que está acontecendo. O plugin oferece estatísticas detalhadas out-of-the-box.

### 5. **Zero Dependencies**
Apenas Elysia como peer dependency. Nada de trazer meio npm junto.

## Quando Usar o Circuit Breaker?

### ✅ Use quando:
- Integrar com APIs externas (pagamento, CEP, clima, etc.)
- Consultar serviços de terceiros
- Acessar microserviços
- Executar operações que podem falhar temporariamente
- Proteger recursos compartilhados (banco de dados, cache, etc.)

### ❌ Não use quando:
- Operações que devem sempre executar (autenticação, por exemplo)
- Lógica de negócio interna que não depende de recursos externos
- Operações já protegidas por outros mecanismos

## Arquitetura e Design Decisions

### Gerenciamento de Estado
Cada circuit breaker mantém seu próprio estado independente, permitindo que você proteja múltiplos serviços simultaneamente sem interferência.

### Thread Safety
O plugin é seguro para uso concorrente — múltiplas requisições podem usar o mesmo circuit breaker simultaneamente.

### Memory Footprint
Cada circuit breaker tem um overhead mínimo: apenas alguns números e timestamps. Pode criar centenas deles sem preocupação.

## Boas Práticas

### 1. Configure Thresholds Adequados
```typescript
// Serviço crítico → threshold baixo
"payment-api": { failureThreshold: 3 }

// Serviço não-crítico → threshold alto
"analytics-api": { failureThreshold: 10 }
```

### 2. Use Callbacks para Observabilidade
```typescript
onOpen: (name) => {
  logger.error(`Circuit ${name} opened`);
  metrics.increment(`circuit.${name}.open`);
  sendAlertToSlack(`⚠️ Circuit ${name} is OPEN`);
}
```

### 3. Implemente Fallbacks Inteligentes
```typescript
try {
  return await breaker.execute("cache", () => getFromCache());
} catch {
  // Fallback: buscar do banco
  return await breaker.execute("database", () => getFromDB());
}
```

### 4. Monitore Suas Métricas
Crie um endpoint de health check que exponha o estado de todos os circuit breakers.

### 5. Nomeie Seus Circuit Breakers de Forma Descritiva
```typescript
// ❌ Ruim
breaker.execute("api1", ...)

// ✅ Bom
breaker.execute("payment-gateway-api", ...)
```

## Roadmap e Melhorias Futuras

Algumas funcionalidades que estou considerando adicionar:

- **Sliding Window**: Em vez de contador simples, usar janela deslizante
- **Métricas Prometheus**: Exportar métricas no formato Prometheus
- **Rate Limiting**: Integração com rate limiting
- **Adaptive Thresholds**: Ajustar thresholds automaticamente baseado em patterns
- **Circuit Breaker Groups**: Agrupar múltiplos breakers com políticas compartilhadas

## Conclusão

Construir sistemas distribuídos resilientes não é trivial, mas ter as ferramentas certas facilita muito. O **elysia-circuit-breaker** nasceu da necessidade real de proteger aplicações Elysia contra falhas em cascata, e espero que ele seja útil para a comunidade.

O código é open source, está disponível no [GitHub](https://github.com/camargo-leonardo/elysia-circuit-breaker) e no [npm](https://www.npmjs.com/package/elysia-circuit-breaker). Contribuições são mais que bem-vindas!

Se você está construindo APIs com ElysiaJS, considere adicionar este plugin ao seu arsenal. Seus serviços (e seus usuários) vão agradecer quando aquela API externa inevitavelmente falhar em um sábado à noite.

## Recursos Adicionais

- **GitHub**: https://github.com/camargo-leonardo/elysia-circuit-breaker
- **NPM**: https://www.npmjs.com/package/elysia-circuit-breaker
- **Documentação ElysiaJS**: https://elysiajs.com
- **Circuit Breaker Pattern**: [Martin Fowler's Article](https://martinfowler.com/bliki/CircuitBreaker.html)

---

**Leonardo Camargo**  
Senior Software Analyst | JavaScript/TypeScript Specialist

*Se este artigo foi útil, deixe um 👏 e compartilhe com sua equipe!*
