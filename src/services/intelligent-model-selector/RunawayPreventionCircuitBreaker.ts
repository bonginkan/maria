/**
 * Runaway Prevention Circuit Breaker - Prevents cascading failures and oscillation
 * Implements circuit breaker pattern with runaway prevention mechanisms
 */

import { EventEmitter } from 'events';

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitStateInfo {
  status: CircuitBreakerState;
  failureCount: number;
  lastFailureTime: number;
  consecutiveSuccesses: number;
  minStayDurationMs: number;
  enteredStateAt: number;
  lastTransitionReason: string;
}

export interface RunawayPreventionConfig {
  /** Maximum consecutive failures before opening circuit */
  maxFailures: number;
  /** Minimum time to stay in open state before transitioning to half-open */
  minOpenDurationMs: number;
  /** Maximum time in half-open state before forcing a decision */
  maxHalfOpenDurationMs: number;
  /** Number of successful requests needed in half-open to transition to closed */
  halfOpenSuccessThreshold: number;
  /** Time window for counting failures */
  failureWindowMs: number;
  /** Prevents same model from being retried too quickly */
  modelCooldownMs: number;
  /** Maximum failures across all models before global circuit breaker */
  globalFailureThreshold: number;
  /** Anti-oscillation: minimum time between state transitions */
  antiOscillationDelayMs: number;
}

export interface ModelCandidate {
  model: {
    id: string;
    providerId: string;
    [key: string]: any;
  };
  available: boolean;
  selectionScore: number;
  reasons?: string[];
}

export interface RunawayPreventionMetrics {
  totalCircuits: number;
  openCircuits: number;
  halfOpenCircuits: number;
  closedCircuits: number;
  totalFailures: number;
  totalSuccesses: number;
  globalCircuitOpen: boolean;
  runawayPreventionTriggers: number;
  oscillationPrevented: number;
}

export class RunawayPreventionCircuitBreaker extends EventEmitter {
  private readonly modelStates = new Map<string, CircuitStateInfo>();
  private readonly recentAttempts = new Map<string, number[]>(); // traceId -> modelIds attempted
  private readonly metricsCollector: RunawayPreventionMetrics;
  private globalCircuitOpen = false;
  private lastGlobalTransition = 0;
  
  constructor(
    private readonly config: RunawayPreventionConfig = {
      maxFailures: 5,
      minOpenDurationMs: 30000, // 30 seconds
      maxHalfOpenDurationMs: 60000, // 1 minute
      halfOpenSuccessThreshold: 3,
      failureWindowMs: 300000, // 5 minutes
      modelCooldownMs: 10000, // 10 seconds
      globalFailureThreshold: 50,
      antiOscillationDelayMs: 15000 // 15 seconds
    }
  ) {
    super();
    
    this.metricsCollector = {
      totalCircuits: 0,
      openCircuits: 0,
      halfOpenCircuits: 0,
      closedCircuits: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      globalCircuitOpen: false,
      runawayPreventionTriggers: 0,
      oscillationPrevented: 0
    };
    
    // Start periodic cleanup and state management
    setInterval(() => this.performMaintenance(), 60000); // Every minute
  }

  /**
   * Select model with runaway prevention
   * Prevents repeated attempts to failed models and cascading failures
   */
  async selectWithRunawayPrevention(
    candidates: ModelCandidate[],
    traceId: string,
    previousAttempts: string[] = []
  ): Promise<ModelCandidate> {
    
    // Check global circuit breaker first
    if (this.globalCircuitOpen) {
      this.metricsCollector.runawayPreventionTriggers++;
      throw new Error('Global circuit breaker active - all model selection suspended');
    }

    // Get previous attempts for this trace to prevent immediate retry
    const existingAttempts = this.recentAttempts.get(traceId) || [];
    const allPreviousAttempts = [...new Set([...previousAttempts, ...existingAttempts])];
    
    // Filter candidates based on circuit breaker states and previous attempts
    const availableCandidates = candidates.filter(candidate => {
      const modelId = candidate.model.id;
      
      // Skip if already attempted in this trace (same traceId)
      if (allPreviousAttempts.includes(modelId)) {
        return false;
      }
      
      const state = this.getOrCreateState(modelId);
      
      // Handle different circuit breaker states
      switch (state.status) {
        case 'closed':
          return true;
          
        case 'half-open':
          // Allow limited attempts in half-open state
          const halfOpenDuration = Date.now() - state.enteredStateAt;
          if (halfOpenDuration > this.config.maxHalfOpenDurationMs) {
            // Force to open if half-open too long
            this.transitionTo(modelId, 'open', 'Half-open timeout exceeded');
            return false;
          }
          // Allow with probability to test recovery
          return Math.random() < 0.1; // 10% chance
          
        case 'open':
          // Check if minimum open duration has passed
          const timeSinceOpen = Date.now() - state.enteredStateAt;
          if (timeSinceOpen >= this.config.minOpenDurationMs) {
            // Transition to half-open
            this.transitionTo(modelId, 'half-open', 'Minimum open duration satisfied');
            return Math.random() < 0.1; // 10% chance for half-open
          }
          return false;
          
        default:
          return false;
      }
    });

    if (availableCandidates.length === 0) {
      this.metricsCollector.runawayPreventionTriggers++;
      
      // Emergency fallback - check if we can use any models despite circuit breaker
      const emergencyCandidate = this.selectEmergencyCandidate(candidates, allPreviousAttempts);
      if (emergencyCandidate) {
        this.emit('emergencyFallback', {
          traceId,
          selectedModel: emergencyCandidate.model.id,
          reason: 'All normal circuits open, using emergency fallback'
        });
        return emergencyCandidate;
      }
      
      throw new Error(`No available models after runaway prevention filter. Attempted: ${allPreviousAttempts.join(', ')}`);
    }

    // Sort by selection score and circuit breaker confidence
    const sortedCandidates = availableCandidates.sort((a, b) => {
      const stateA = this.getOrCreateState(a.model.id);
      const stateB = this.getOrCreateState(b.model.id);
      
      // Prefer closed circuits over half-open
      const stateScoreA = stateA.status === 'closed' ? 1.0 : 0.5;
      const stateScoreB = stateB.status === 'closed' ? 1.0 : 0.5;
      
      const finalScoreA = a.selectionScore * stateScoreA;
      const finalScoreB = b.selectionScore * stateScoreB;
      
      return finalScoreB - finalScoreA;
    });

    const selectedCandidate = sortedCandidates[0];
    
    // Record this attempt
    this.recordAttempt(traceId, selectedCandidate.model.id);
    
    this.emit('modelSelected', {
      traceId,
      selectedModel: selectedCandidate.model.id,
      availableCandidatesCount: availableCandidates.length,
      circuitBreakerStates: this.getCircuitBreakerSummary()
    });

    return selectedCandidate;
  }

  /**
   * Record a successful operation
   */
  recordSuccess(modelId: string, traceId?: string): void {
    const state = this.getOrCreateState(modelId);
    state.consecutiveSuccesses++;
    
    // Reset failure count on success (optional, depending on strategy)
    if (state.status === 'half-open') {
      // Transition to closed if enough consecutive successes in half-open
      if (state.consecutiveSuccesses >= this.config.halfOpenSuccessThreshold) {
        this.transitionTo(modelId, 'closed', `${state.consecutiveSuccesses} consecutive successes`);
      }
    }

    this.metricsCollector.totalSuccesses++;
    
    this.emit('operationSuccess', {
      modelId,
      traceId,
      consecutiveSuccesses: state.consecutiveSuccesses,
      status: state.status
    });
  }

  /**
   * Record a failed operation
   */
  recordFailure(modelId: string, reason: string, traceId?: string): void {
    const state = this.getOrCreateState(modelId);
    state.failureCount++;
    state.lastFailureTime = Date.now();
    state.consecutiveSuccesses = 0;
    
    // Check if we should transition to open
    if (state.status === 'closed' && state.failureCount >= this.config.maxFailures) {
      this.transitionTo(modelId, 'open', `Failure threshold exceeded (${state.failureCount}/${this.config.maxFailures}): ${reason}`);
    } else if (state.status === 'half-open') {
      // Any failure in half-open transitions back to open
      this.transitionTo(modelId, 'open', `Failure in half-open state: ${reason}`);
    }

    this.metricsCollector.totalFailures++;
    
    // Check global circuit breaker
    this.checkGlobalCircuitBreaker();
    
    this.emit('operationFailure', {
      modelId,
      traceId,
      reason,
      failureCount: state.failureCount,
      status: state.status
    });
  }

  /**
   * Get current circuit breaker state for a model
   */
  getCircuitState(modelId: string): CircuitStateInfo {
    return { ...this.getOrCreateState(modelId) };
  }

  /**
   * Get summary of all circuit breaker states
   */
  getCircuitBreakerSummary(): RunawayPreventionMetrics {
    // Update metrics
    this.metricsCollector.totalCircuits = this.modelStates.size;
    this.metricsCollector.openCircuits = Array.from(this.modelStates.values()).filter(s => s.status === 'open').length;
    this.metricsCollector.halfOpenCircuits = Array.from(this.modelStates.values()).filter(s => s.status === 'half-open').length;
    this.metricsCollector.closedCircuits = Array.from(this.modelStates.values()).filter(s => s.status === 'closed').length;
    this.metricsCollector.globalCircuitOpen = this.globalCircuitOpen;
    
    return { ...this.metricsCollector };
  }

  /**
   * Force circuit state (for testing/emergency)
   */
  forceCircuitState(modelId: string, newState: CircuitBreakerState, reason: string): void {
    this.transitionTo(modelId, newState, `Forced transition: ${reason}`);
    
    this.emit('forcedTransition', {
      modelId,
      newState,
      reason,
      forced: true
    });
  }

  /**
   * Reset circuit breaker (emergency recovery)
   */
  resetCircuitBreaker(modelId?: string): void {
    if (modelId) {
      // Reset specific model
      const state = this.getOrCreateState(modelId);
      state.status = 'closed';
      state.failureCount = 0;
      state.consecutiveSuccesses = 0;
      state.enteredStateAt = Date.now();
      state.lastTransitionReason = 'Manual reset';
      
      this.emit('circuitReset', { modelId });
    } else {
      // Reset all circuits
      this.modelStates.clear();
      this.globalCircuitOpen = false;
      this.recentAttempts.clear();
      
      // Reset metrics counters
      this.metricsCollector.runawayPreventionTriggers = 0;
      this.metricsCollector.oscillationPrevented = 0;
      this.metricsCollector.totalFailures = 0;
      this.metricsCollector.totalSuccesses = 0;
      
      this.emit('allCircuitsReset');
    }
  }

  /**
   * Check if a model should be considered for retry
   */
  canRetryModel(modelId: string, traceId: string): boolean {
    const previousAttempts = this.recentAttempts.get(traceId) || [];
    const alreadyAttempted = previousAttempts.includes(modelId);
    
    if (alreadyAttempted) {
      return false;
    }
    
    const state = this.getOrCreateState(modelId);
    const cooldownRemaining = this.getRemainingCooldown(state);
    
    return cooldownRemaining <= 0;
  }

  /**
   * Private methods
   */

  private getOrCreateState(modelId: string): CircuitStateInfo {
    if (!this.modelStates.has(modelId)) {
      this.modelStates.set(modelId, {
        status: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        consecutiveSuccesses: 0,
        minStayDurationMs: this.config.antiOscillationDelayMs,
        enteredStateAt: Date.now(),
        lastTransitionReason: 'Initial state'
      });
    }
    return this.modelStates.get(modelId)!;
  }

  private transitionTo(modelId: string, newStatus: CircuitBreakerState, reason: string): void {
    const state = this.getOrCreateState(modelId);
    const previousStatus = state.status;
    
    // Check anti-oscillation
    const timeSinceLastTransition = Date.now() - state.enteredStateAt;
    if (timeSinceLastTransition < state.minStayDurationMs) {
      this.metricsCollector.oscillationPrevented++;
      this.emit('oscillationPrevented', {
        modelId,
        attemptedTransition: `${previousStatus} -> ${newStatus}`,
        reason: 'Anti-oscillation delay not satisfied',
        remainingDelayMs: state.minStayDurationMs - timeSinceLastTransition
      });
      return;
    }
    
    state.status = newStatus;
    state.enteredStateAt = Date.now();
    state.lastTransitionReason = reason;
    
    // Set state-specific parameters
    switch (newStatus) {
      case 'open':
        state.minStayDurationMs = this.config.minOpenDurationMs;
        break;
      case 'half-open':
        state.minStayDurationMs = this.config.antiOscillationDelayMs;
        state.consecutiveSuccesses = 0; // Reset for fresh count
        break;
      case 'closed':
        state.minStayDurationMs = this.config.antiOscillationDelayMs;
        state.failureCount = 0; // Reset failure count
        break;
    }
    
    this.emit('circuitTransition', {
      modelId,
      from: previousStatus,
      to: newStatus,
      reason,
      timestamp: new Date(),
      minStayDurationMs: state.minStayDurationMs
    });
  }

  private recordAttempt(traceId: string, modelId: string): void {
    const attempts = this.recentAttempts.get(traceId) || [];
    attempts.push(modelId);
    this.recentAttempts.set(traceId, attempts);
    
    // Limit tracking to prevent memory leaks
    if (attempts.length > 10) {
      attempts.shift();
    }
  }

  private selectEmergencyCandidate(
    candidates: ModelCandidate[], 
    excludeModels: string[]
  ): ModelCandidate | null {
    // Try to find the least recently failed model
    const availableForEmergency = candidates.filter(
      c => !excludeModels.includes(c.model.id)
    );
    
    if (availableForEmergency.length === 0) {
      return null;
    }
    
    // Sort by last failure time (oldest failure first)
    availableForEmergency.sort((a, b) => {
      const stateA = this.modelStates.get(a.model.id);
      const stateB = this.modelStates.get(b.model.id);
      
      const lastFailureA = stateA?.lastFailureTime || 0;
      const lastFailureB = stateB?.lastFailureTime || 0;
      
      return lastFailureA - lastFailureB;
    });
    
    return availableForEmergency[0];
  }

  private checkGlobalCircuitBreaker(): void {
    const totalFailures = Array.from(this.modelStates.values())
      .reduce((sum, state) => sum + state.failureCount, 0);
    
    if (totalFailures >= this.config.globalFailureThreshold && !this.globalCircuitOpen) {
      this.globalCircuitOpen = true;
      this.lastGlobalTransition = Date.now();
      
      this.emit('globalCircuitOpened', {
        totalFailures,
        threshold: this.config.globalFailureThreshold,
        timestamp: new Date()
      });
      
      // Auto-recovery after 5 minutes
      setTimeout(() => {
        this.globalCircuitOpen = false;
        this.emit('globalCircuitClosed', { timestamp: new Date() });
      }, 300000);
    }
  }

  private getRemainingCooldown(state: CircuitStateInfo): number {
    if (state.lastFailureTime === 0) return 0;
    
    const elapsed = Date.now() - state.lastFailureTime;
    return Math.max(0, this.config.modelCooldownMs - elapsed);
  }

  private performMaintenance(): void {
    // Clean up old trace attempts (older than 1 hour)
    const oneHourAgo = Date.now() - 3600000;
    
    // Remove old failure counts outside the failure window
    const cutoffTime = Date.now() - this.config.failureWindowMs;
    
    for (const [modelId, state] of this.modelStates.entries()) {
      if (state.lastFailureTime > 0 && state.lastFailureTime < cutoffTime) {
        // Reset failure count if outside window
        state.failureCount = 0;
      }
      
      // Remove completely stale states
      if (state.enteredStateAt < cutoffTime && state.status === 'closed') {
        this.modelStates.delete(modelId);
      }
    }
    
    // Clean up old trace attempts
    for (const [traceId, attempts] of this.recentAttempts.entries()) {
      // Remove traces older than 1 hour (rough heuristic)
      if (attempts.length === 0) {
        this.recentAttempts.delete(traceId);
      }
    }
    
    this.emit('maintenanceCompleted', {
      totalCircuits: this.modelStates.size,
      totalTraces: this.recentAttempts.size,
      timestamp: new Date()
    });
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    this.modelStates.clear();
    this.recentAttempts.clear();
    this.emit('cleanup');
  }
}