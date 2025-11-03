export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open',
}

export interface CircuitBreakerConfig {
  /**
   * Number of consecutive failures before opening the circuit
   * @default 5
   */
  failureThreshold?: number

  /**
   * Time in milliseconds to wait before attempting to close the circuit again
   * @default 60000 (1 minute)
   */
  resetTimeout?: number

  /**
   * Time in milliseconds to wait for a request to complete before considering it a failure
   * @default 30000 (30 seconds)
   */
  timeout?: number

  /**
   * Custom error handler called when circuit is open
   */
  onOpen?: (name: string) => void

  /**
   * Custom handler called when circuit closes
   */
  onClose?: (name: string) => void

  /**
   * Custom handler called when circuit enters half-open state
   */
  onHalfOpen?: (name: string) => void
}

export interface CircuitBreakerStats {
  state: CircuitState
  failures: number
  successes: number
  totalCalls: number
  lastFailureTime?: number
  lastSuccessTime?: number
}
