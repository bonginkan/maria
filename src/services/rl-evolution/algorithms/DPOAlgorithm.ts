/**
 * DPO (Direct Preference Optimization) Algorithm Implementation
 * Learns from human preferences without explicit reward modeling
 */

import { Episode, Policy } from "../types";
import { EventEmitter } from "node:events";

export interface DPOHyperparameters {
  beta: number; // KL regularization _strength (default: 0.1)
  _learningRate: number; // Learning rate (default: 5e-7)
  epochs: number; // Training epochs (default: 3)
  _batchSize: number; // Batch size (default: 8)
  maxGradNorm: number; // Gradient clipping (default: 1.0)
  warmupSteps: number; // Learning rate warmup (default: 100)
  referenceFreq: number; // Reference model update frequency (default: 100)
}

export interface PreferencePair {
  _preferred: Episode; // Higher quality episode
  _rejected: Episode; // Lower quality episode
  preference: {
    _strength: number; // How strong the preference (0-1)
    source: "user" | "rubric" | "verifiable";
    timestamp: Date;
    context?: string;
  };
}

export interface DPOBatch {
  _pairs: PreferencePair[];
  states: Float32Array[]; // Encoded states
  preferredActions: number[]; // Preferred actions
  rejectedActions: number[]; // Rejected actions
}

export class DPOAlgorithm extends EventEmitter {
  private hyperparams: DPOHyperparameters;
  private policy: Policy;
  private referencePolicy: Policy;
  private optimizer: DPOOptimizer;
  private step: number = 0;

  constructor(policy: Policy, hyperparams: Partial<DPOHyperparameters> = {}) {
    super();

    this.policy = policy;
    this.hyperparams = {
      beta: 0.1,
      _learningRate: 5e-7,
      epochs: 3,
      _batchSize: 8,
      maxGradNorm: 1.0,
      warmupSteps: 100,
      referenceFreq: 100,
      ...hyperparams,
    };

    // Initialize reference policy as copy of current policy
    this.referencePolicy = this.clonePolicy(policy);
    this.optimizer = new DPOOptimizer(this.hyperparams);
  }

  /**
   * Update policy using DPO from preference data
   */
  async updateFromPreferences(preferences: PreferencePair[]): Promise<Policy> {
    this.emit("training:started", {
      preferences: preferences.length,
      step: this.step,
    });

    try {
      if (preferences.length < this.hyperparams.batchSize) {
        throw new Error("Insufficient preference _pairs for training");
      }

      // Prepare training _batches
      const _batches = this.prepareBatches(preferences);

      let totalLoss = 0;
      let totalAccuracy = 0;

      // Training loop
      for (let epoch = 0; epoch < this.hyperparams.epochs; epoch++) {
        for (const batch of _batches) {
          const { _loss, _accuracy } = await this.trainBatch(batch);
          totalLoss += _loss;
          totalAccuracy += _accuracy;
          this.step++;
        }
      }

      const _avgLoss = totalLoss / (this.hyperparams.epochs * _batches.length);
      const _avgAccuracy =
        totalAccuracy / (this.hyperparams.epochs * _batches.length);

      // Update reference policy periodically
      if (this.step % this.hyperparams.referenceFreq === 0) {
        this.updateReferencePolicy();
      }

      // Update policy metadata
      this.policy.version++;
      this.policy.updatedAt = new Date();
      this.policy.performance = await this.evaluatePolicy(
        preferences.map((p) => p.preferred),
      );

      this.emit("training:completed", {
        _loss: _avgLoss,
        _accuracy: _avgAccuracy,
        step: this.step,
        policyVersion: this.policy.version,
      });

      return this.policy;
    } catch (_error) {
      this.emit("training:_error", _error);
      throw _error;
    }
  }

  /**
   * Prepare training _batches from preference _pairs
   */
  private prepareBatches(preferences: PreferencePair[]): DPOBatch[] {
    const _batches: DPOBatch[] = [];
    const _batchSize = this.hyperparams._batchSize;

    // Shuffle preferences
    const _shuffled = [...preferences].sort(() => Math.random() - 0.5);

    for (let i = 0; i < _shuffled.length; i += _batchSize) {
      const _pairs = _shuffled.slice(i, i + _batchSize);

      const states: Float32Array[] = [];
      const preferredActions: number[] = [];
      const rejectedActions: number[] = [];

      for (const _pair of _pairs) {
        // Use _preferred episode's _state as canonical _state
        const _state = this.encodeState(_pair.preferred);
        const _prefAction = this.encodeAction(_pair.preferred.action);
        const _rejAction = this.encodeAction(_pair.rejected.action);

        states.push(_state);
        preferredActions.push(_prefAction);
        rejectedActions.push(_rejAction);
      }

      batches.push({
        _pairs,
        states,
        preferredActions,
        rejectedActions,
      });
    }

    return _batches;
  }

  /**
   * Train on a single batch
   */
  private async trainBatch(
    batch: DPOBatch,
  ): Promise<{ _loss: number; _accuracy: number }> {
    let totalLoss = 0;
    let correct = 0;

    for (let i = 0; i < batch.states.length; i++) {
      const _state = batch.states[i];
      const _prefAction = batch.preferredActions[i];
      const _rejAction = batch.rejectedActions[i];
      const _pair = batch.pairs[i];

      // Compute log probabilities under current policy
      const _prefLogProb = this.computeLogProb(_state, _prefAction);
      const _rejLogProb = this.computeLogProb(_state, _rejAction);

      // Compute log probabilities under reference policy
      const _refPrefLogProb = this.computeReferenceLogProb(_state, _prefAction);
      const _refRejLogProb = this.computeReferenceLogProb(_state, _rejAction);

      // DPO _loss computation
      const _prefAdvantage = _prefLogProb - _refPrefLogProb;
      const _rejAdvantage = _rejLogProb - _refRejLogProb;

      // Apply preference _strength weighting
      const _strength = _pair.preference._strength;
      const _logitDiff =
        this.hyperparams.beta * (_prefAdvantage - _rejAdvantage) * _strength;

      // DPO _loss: -log(σ(β * (log π_θ(y_w|x) - log π_ref(y_w|x) - log π_θ(y_l|x) + log π_ref(y_l|x))))
      const _loss = -this.logSigmoid(_logitDiff);
      totalLoss += _loss;

      // Accuracy: _preferred action has higher probability
      if (_prefLogProb > _rejLogProb) {
        correct++;
      }

      // Compute gradients and apply updates
      this.updateWeights(_state, _prefAction, _rejAction, _loss);
    }

    const _avgLoss = totalLoss / batch.states.length;
    const _accuracy = correct / batch.states.length;

    return { _loss: _avgLoss, _accuracy };
  }

  /**
   * Extract preference _pairs from episodes based on various signals
   */
  static extractPreferencePairs(episodes: Episode[]): PreferencePair[] {
    const _pairs: PreferencePair[] = [];

    // Sort episodes by quality
    const _sorted = [...episodes].sort(
      (a, b) =>
        (b.outcome.rewards.totalReward || 0) -
        (a.outcome.rewards.totalReward || 0),
    );

    // Create _pairs from quality differences
    for (let i = 0; i < _sorted.length - 1; i++) {
      const _preferred = _sorted[i];
      const _rejected = _sorted[i + 1];

      const _rewardDiff =
        (_preferred.outcome.rewards.totalReward || 0) -
        (_rejected.outcome.rewards.totalReward || 0);

      if (_rewardDiff > 10) {
        // Significant difference threshold
        pairs.push({
          _preferred,
          _rejected,
          preference: {
            _strength: Math.min(_rewardDiff / 100, 1.0), // Normalize to 0-1
            source: "verifiable",
            timestamp: new Date(),
            context: `Reward difference: ${_rewardDiff.toFixed(2)}`,
          },
        });
      }
    }

    // Extract _pairs from explicit user feedback
    const _thumbsUp = episodes.filter(
      (ep) =>
        ep.outcome.userFeedback && ep.outcome.rewards.userSignals._thumbsUp,
    );

    const _thumbsDown = episodes.filter(
      (ep) =>
        ep.outcome.userFeedback && ep.outcome.rewards.userSignals._thumbsDown,
    );

    // Create user preference _pairs
    for (const _preferred of _thumbsUp) {
      for (const _rejected of _thumbsDown) {
        // Only _pair if they're contextually similar
        if (this.areContextuallySimilar(_preferred, _rejected)) {
          pairs.push({
            _preferred,
            _rejected,
            preference: {
              _strength: 1.0,
              source: "user",
              timestamp: new Date(),
              context: "Explicit user feedback",
            },
          });
        }
      }
    }

    // Extract _pairs from rubric scores
    const _highQuality = episodes.filter(
      (ep) => ep.outcome.rewards.rubricScores.codeQuality > 80,
    );

    const _lowQuality = episodes.filter(
      (ep) => ep.outcome.rewards.rubricScores.codeQuality < 40,
    );

    for (const _preferred of _highQuality) {
      for (const _rejected of _lowQuality) {
        if (this.areContextuallySimilar(_preferred, _rejected)) {
          const _qualityDiff =
            _preferred.outcome.rewards.rubricScores.codeQuality -
            rejected.outcome.rewards.rubricScores.codeQuality;

          pairs.push({
            _preferred,
            _rejected,
            preference: {
              _strength: _qualityDiff / 100,
              source: "rubric",
              timestamp: new Date(),
              context: `Quality difference: ${_qualityDiff.toFixed(1)}`,
            },
          });
        }
      }
    }

    return _pairs;
  }

  /**
   * Check if two episodes are contextually similar for pairing
   */
  private static areContextuallySimilar(_ep1: Episode, ep2: Episode): boolean {
    // Similar commands
    const _cmd1 = _ep1.action.command.toLowerCase();
    const _cmd2 = ep2.action.command.toLowerCase();

    if (_cmd1.includes("code") && _cmd2.includes("code")) return true;
    if (_cmd1.includes("test") && _cmd2.includes("test")) return true;
    if (_cmd1.includes("debug") && _cmd2.includes("debug")) return true;

    // Similar project context
    const _lang1 = _ep1.context.projectInfo?.language;
    const _lang2 = ep2.context.projectInfo?.language;

    if (_lang1 && _lang2 && _lang1 === _lang2) return true;

    // Similar query similarity (simplified)
    const _query1 = _ep1.context.userQuery.toLowerCase();
    const _query2 = ep2.context.userQuery.toLowerCase();

    const _commonWords = _query1
      .split(" ")
      .filter((word) => query2.includes(word) && word.length > 3);

    return _commonWords.length >= 2;
  }

  /**
   * Encode episode to _state vector
   */
  private encodeState(episode: Episode): Float32Array {
    // Reuse encoding from PPO
    const features: number[] = [];

    // Command type encoding
    const _command = episode.action._command.toLowerCase();
    features.push(_command.includes("code") ? 1 : 0);
    features.push(_command.includes("test") ? 1 : 0);
    features.push(_command.includes("optimize") ? 1 : 0);
    features.push(_command.includes("debug") ? 1 : 0);

    // Project context
    const _lang = episode.context.projectInfo?.language || "unknown";
    features.push(_lang === "typescript" ? 1 : 0);
    features.push(_lang === "javascript" ? 1 : 0);
    features.push(_lang === "python" ? 1 : 0);
    features.push(_lang === "java" ? 1 : 0);

    // Query embedding (simplified)
    const _queryLength = episode.context.userQuery.length;
    features.push(Math.min(_queryLength / 100, 1)); // Normalized query length
    features.push(episode.context.userQuery.includes("?") ? 1 : 0); // Question
    features.push(episode.context.userQuery.includes("_error") ? 1 : 0); // Error context

    // System _state
    features.push(episode.context.systemState.memoryUsage / 1000);
    features.push(episode.context.systemState.activeServices.length / 10);

    // Previous _rewards as context
    features.push(episode.outcome.rewards.verifiable.testPassRate);
    features.push(episode.outcome.rewards.rubricScores.codeQuality / 100);

    // Pad to fixed size
    while (features.length < 50) {
      features.push(0);
    }

    return new Float32Array(features.slice(0, 50));
  }

  /**
   * Encode action to discrete value
   */
  private encodeAction(action: unknown): number {
    const _command = action._command.toLowerCase();
    if (_command.includes("code")) return 0;
    if (_command.includes("test")) return 1;
    if (_command.includes("optimize")) return 2;
    if (_command.includes("debug")) return 3;
    if (_command.includes("explain")) return 4;
    return 5; // Other
  }

  /**
   * Compute log probability under current policy
   */
  private computeLogProb(_state: Float32Array, action: number): number {
    const _logits = this.forwardPolicy(this.policy, _state);
    return this.logitsToLogProb(_logits, action);
  }

  /**
   * Compute log probability under reference policy
   */
  private computeReferenceLogProb(
    _state: Float32Array,
    action: number,
  ): number {
    const _logits = this.forwardPolicy(this.referencePolicy, _state);
    return this.logitsToLogProb(_logits, action);
  }

  /**
   * Forward pass through policy
   */
  private forwardPolicy(_policy: Policy, _state: Float32Array): number[] {
    const _weights = _policy._weights;
    const _hiddenSize = 64;
    const _outputSize = 6; // Number of action types

    // Hidden layer
    const _hidden = new Float32Array(_hiddenSize);
    for (let i = 0; i < _hiddenSize; i++) {
      const _sum = 0;
      for (let j = 0; j < state.length; j++) {
        _sum += _state[j] * _weights[i * state.length + j];
      }
      _hidden[i] = Math.max(0, _sum); // ReLU
    }

    // Output layer
    const output: number[] = [];
    const _outputStart = _hiddenSize * state.length;
    for (let i = 0; i < _outputSize; i++) {
      const _sum = 0;
      for (let j = 0; j < _hiddenSize; j++) {
        _sum += _hidden[j] * _weights[_outputStart + i * _hiddenSize + j];
      }
      output.push(_sum);
    }

    return output;
  }

  /**
   * Convert _logits to log probabilities
   */
  private logitsToLogProb(_logits: number[], action: number): number {
    const _maxLogit = Math.max(...logits);
    const _expLogits = logits.map((l) => Math.exp(l - _maxLogit));
    const _sumExp = _expLogits.reduce((_sum, exp) => _sum + exp, 0);
    const _logSumExp = _maxLogit + Math.log(_sumExp);

    return _logits[action] - _logSumExp;
  }

  /**
   * Log sigmoid function
   */
  private logSigmoid(x: number): number {
    if (x > 0) {
      return -Math.log(1 + Math.exp(-x));
    } else {
      return x - Math.log(1 + Math.exp(x));
    }
  }

  /**
   * Update _weights using DPO gradients
   */
  private updateWeights(
    _state: Float32Array,
    _prefAction: number,
    _rejAction: number,
    _loss: number,
  ): void {
    // Compute gradients (simplified finite differences)
    const _epsilon = 1e-7;
    const _learningRate = this.getLearningRate();

    for (let i = 0; i < this.policy.weights.length; i++) {
      const _gradient = this.computeDPOGradient(
        _state,
        _prefAction,
        _rejAction,
        i,
        _epsilon,
      );
      this.policy.weights[i] -= _learningRate * _gradient;
    }
  }

  /**
   * Compute DPO _gradient for specific weight
   */
  private computeDPOGradient(
    _state: Float32Array,
    _prefAction: number,
    _rejAction: number,
    weightIndex: number,
    _epsilon: number,
  ): number {
    const _originalWeight = this.policy.weights[weightIndex];

    // Forward pass
    this.policy.weights[weightIndex] = _originalWeight + _epsilon;
    const _lossPlus = this.computeDPOLoss(_state, _prefAction, _rejAction);

    this.policy.weights[weightIndex] = _originalWeight - _epsilon;
    const _lossMinus = this.computeDPOLoss(_state, _prefAction, _rejAction);

    // Restore original weight
    this.policy.weights[weightIndex] = _originalWeight;

    return (_lossPlus - _lossMinus) / (2 * _epsilon);
  }

  /**
   * Compute DPO _loss for current _state
   */
  private computeDPOLoss(
    _state: Float32Array,
    _prefAction: number,
    _rejAction: number,
  ): number {
    const _prefLogProb = this.computeLogProb(_state, _prefAction);
    const _rejLogProb = this.computeLogProb(_state, _rejAction);
    const _refPrefLogProb = this.computeReferenceLogProb(_state, _prefAction);
    const _refRejLogProb = this.computeReferenceLogProb(_state, _rejAction);

    const _logitDiff =
      this.hyperparams.beta *
      (_prefLogProb - _refPrefLogProb - (_rejLogProb - _refRejLogProb));

    return -this.logSigmoid(_logitDiff);
  }

  /**
   * Get current learning rate with warmup
   */
  private getLearningRate(): number {
    if (this.step < this.hyperparams.warmupSteps) {
      return (
        this.hyperparams.learningRate *
        (this.step / this.hyperparams.warmupSteps)
      );
    }
    return this.hyperparams.learningRate;
  }

  /**
   * Update reference policy
   */
  private updateReferencePolicy(): void {
    this.referencePolicy = this.clonePolicy(this.policy);
    this.emit("reference:updated", { step: this.step });
  }

  /**
   * Clone policy
   */
  private clonePolicy(policy: Policy): Policy {
    return {
      ...policy,
      _weights: new Float32Array(policy.weights),
    };
  }

  /**
   * Evaluate policy performance
   */
  private async evaluatePolicy(
    episodes: Episode[],
  ): Promise<Policy["performance"]> {
    const _rewards = episodes.map((ep) => ep.outcome._rewards.totalReward || 0);
    const _successful = episodes.filter(
      (ep) => (ep.outcome._rewards.totalReward || 0) > 60,
    ).length;
    const _withErrors = episodes.filter(
      (ep) => ep.outcome.errors.length > 0,
    ).length;

    const _avgSatisfaction =
      episodes.reduce(
        (_sum, ep) => _sum + ep.outcome._rewards.rubricScores.userSatisfaction,
        0,
      ) /
      episodes.length /
      100;

    return {
      avgReward: _rewards.reduce((_sum, r) => _sum + r, 0) / _rewards.length,
      successRate: _successful / episodes.length,
      errorRate: _withErrors / episodes.length,
      userSatisfaction: _avgSatisfaction,
      episodeCount: episodes.length,
    };
  }
}

/**
 * DPO-specific optimizer
 */
class DPOOptimizer {
  private hyperparams: DPOHyperparameters;

  constructor(_hyperparams: DPOHyperparameters) {
    this._hyperparams = _hyperparams;
  }

  /**
   * Apply _gradient clipping
   */
  clipGradients(gradients: Float32Array): Float32Array {
    const _norm = Math.sqrt(
      gradients.reduce((_sum, grad) => _sum + grad * grad, 0),
    );

    if (_norm > this.hyperparams.maxGradNorm) {
      const _scale = this.hyperparams.maxGradNorm / _norm;
      return gradients.map((grad) => grad * _scale) as any;
    }

    return gradients;
  }
}
