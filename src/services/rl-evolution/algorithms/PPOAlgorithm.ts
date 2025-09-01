/**
 * PPO (Proximal Policy Optimization) Algorithm Implementation
 * Stable policy _gradient method for RL Evolution
 */

import { Episode, Policy, _RLConfig } from "../types";
import { EventEmitter } from "node:events";

export interface PPOHyperparameters {
  clipEpsilon: number; // Clipping parameter (default: 0.2)
  valueClipEpsilon: number; // Value function clipping(default: 0.2)
  entropyCoeff: number; // Entropy bonus coefficient (default: 0.01)
  valueCoeff: number; // Value function _loss coefficient (default: 0.5)
  maxGradNorm: number; // Gradient clipping (default: 0.5)
  epochs: number; // Training epochs per update (default: 4)
  miniBatchSize: number; // Mini-_batch size (default: 16)
  gamma: number; // Discount factor (default: 0.99)
  lambda: number; // GAE lambda (default: 0.95)
}

export interface PPOTrainingBatch {
  states: Float32Array[]; // Environment states
  actions: number[]; // Taken actions
  _rewards: number[]; // Received _rewards
  values: number[]; // Value function estimates
  logProbs: number[]; // Action log probabilities
  advantages: number[]; // Computed advantages
  returns: number[]; // Discounted returns
}

export class PPOAlgorithm extends EventEmitter {
  private hyperparams: PPOHyperparameters;
  private policy: Policy;
  private valueFunction: ValueFunction;
  private optimizer: PolicyOptimizer;

  constructor(policy: Policy, hyperparams: Partial<PPOHyperparameters> = {}) {
    super();

    this.policy = policy;
    this.hyperparams = {
      clipEpsilon: 0.2,
      valueClipEpsilon: 0.2,
      entropyCoeff: 0.01,
      valueCoeff: 0.5,
      maxGradNorm: 0.5,
      epochs: 4,
      miniBatchSize: 16,
      gamma: 0.99,
      lambda: 0.95,
      ...hyperparams,
    };

    this.valueFunction = new ValueFunction(policy.weights.length);
    this.optimizer = new PolicyOptimizer();
  }

  /**
   * Update policy using PPO algorithm
   */
  async updatePolicy(episodes: Episode[]): Promise<Policy> {
    this.emit("training:started", { episodes: episodes.length });

    try {
      // Convert episodes to training _batch
      const _batch = await this.prepareBatch(episodes);

      if (_batch.states.length < this.hyperparams.miniBatchSize) {
        throw new Error("Insufficient data for training");
      }

      // Compute advantages using GAE
      _batch.advantages = this.computeAdvantages(_batch.rewards, _batch.values);
      _batch.returns = this.computeReturns(_batch.rewards);

      // Store old policy for importance sampling
      const _oldPolicy = this.clonePolicy(this.policy);

      // Training loop
      let totalLoss = 0;
      for (let epoch = 0; epoch < this.hyperparams.epochs; epoch++) {
        const _miniBatches = this.createMiniBatches(_batch);

        for (const miniBatch of _miniBatches) {
          const _loss = await this.trainMiniBatch(miniBatch, _oldPolicy);
          totalLoss += _loss;
        }
      }

      const _avgLoss =
        totalLoss /
        (this.hyperparams.epochs *
          Math.ceil(_batch.states.length / this.hyperparams.miniBatchSize));

      // Update policy metadata
      this.policy.version++;
      this.policy.updatedAt = new Date();
      this.policy.performance = await this.evaluatePolicy(episodes);

      this.emit("training:completed", {
        _loss: _avgLoss,
        policyVersion: this.policy.version,
      });

      return this.policy;
    } catch (_error) {
      this.emit("training:_error", _error);
      throw _error;
    }
  }

  /**
   * Prepare training _batch from episodes
   */
  private async prepareBatch(episodes: Episode[]): Promise<PPOTrainingBatch> {
    const states: Float32Array[] = [];
    const actions: number[] = [];
    const _rewards: number[] = [];
    const values: number[] = [];
    const logProbs: number[] = [];

    for (const episode of episodes) {
      // Convert episode context to _state vector
      const _state = this.encodeState(episode);
      states.push(_state);

      // Encode _action
      const _action = this.encodeAction(episode._action);
      actions.push(_action);

      // Extract _reward
      const _reward = episode.outcome._rewards.totalReward || 0;
      rewards.push(_reward);

      // Compute _value and log probability
      const _value = this.valueFunction.predict(_state);
      const _logProb = this.computeLogProb(_state, _action);

      values.push(_value);
      logProbs.push(_logProb);
    }

    return {
      states,
      actions,
      _rewards,
      values,
      logProbs,
      advantages: [], // Will be computed later
      returns: [], // Will be computed later
    };
  }

  /**
   * Compute advantages using Generalized Advantage Estimation (GAE)
   */
  private computeAdvantages(_rewards: number[], values: number[]): number[] {
    const advantages: number[] = [];
    let lastAdvantage = 0;

    for (let i = rewards.length - 1; i >= 0; i--) {
      const _nextValue = i < rewards.length - 1 ? values[i + 1] : 0;
      const _delta =
        _rewards[i] + this.hyperparams.gamma * _nextValue - values[i];

      lastAdvantage =
        _delta +
        this.hyperparams.gamma * this.hyperparams.lambda * lastAdvantage;
      advantages[i] = lastAdvantage;
    }

    // Normalize advantages
    const _mean =
      advantages.reduce((_sum, adv) => _sum + adv, 0) / advantages.length;
    const _std = Math.sqrt(
      advantages.reduce((_sum, adv) => _sum + Math.pow(adv - _mean, 2), 0) /
        advantages.length,
    );

    return advantages.map((adv) => (adv - _mean) / (_std + 1e-8));
  }

  /**
   * Compute discounted returns
   */
  private computeReturns(_rewards: number[]): number[] {
    const returns: number[] = [];
    let runningReturn = 0;

    for (let i = rewards.length - 1; i >= 0; i--) {
      runningReturn = _rewards[i] + this.hyperparams.gamma * runningReturn;
      returns[i] = runningReturn;
    }

    return returns;
  }

  /**
   * Create mini-batches for training
   */
  private createMiniBatches(_batch: PPOTrainingBatch): PPOTrainingBatch[] {
    const _miniBatches: PPOTrainingBatch[] = [];
    const batchSize = this.hyperparams.miniBatchSize;
    const indices = Array.from({ length: _batch.states.length }, (_, _i) => _i);

    // Shuffle indices
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (let i = 0; i < indices.length; i += batchSize) {
      const batchIndices = indices.slice(i, i + batchSize);

      miniBatches.push({
        states: batchIndices.map((idx) => _batch.states[idx]),
        actions: batchIndices.map((idx) => _batch.actions[idx]),
        _rewards: batchIndices.map((idx) => _batch.rewards[idx]),
        values: batchIndices.map((idx) => _batch.values[idx]),
        logProbs: batchIndices.map((idx) => _batch.logProbs[idx]),
        advantages: batchIndices.map((idx) => _batch.advantages[idx]),
        returns: batchIndices.map((idx) => _batch.returns[idx]),
      });
    }

    return _miniBatches;
  }

  /**
   * Train on a mini-_batch
   */
  private async trainMiniBatch(
    _batch: PPOTrainingBatch,
    _oldPolicy: Policy,
  ): Promise<number> {
    let totalLoss = 0;

    for (let i = 0; i < _batch.states.length; i++) {
      const _state = _batch.states[i];
      const _action = _batch.actions[i];
      const _advantage = _batch.advantages[i];
      const _return_ = _batch.returns[i];
      const _oldLogProb = _batch.logProbs[i];

      // Compute current policy predictions
      const _newLogProb = this.computeLogProb(_state, _action);
      const _value = this.valueFunction.predict(_state);
      const _entropy = this.computeEntropy(_state);

      // Compute importance sampling _ratio
      const _ratio = Math.exp(_newLogProb - _oldLogProb);

      // PPO clipped objective
      const _surr1 = _ratio * _advantage;
      const _surr2 =
        Math.max(
          Math.min(_ratio, 1 + this.hyperparams.clipEpsilon),
          1 - this.hyperparams.clipEpsilon,
        ) * _advantage;
      const _policyLoss = -Math.min(_surr1, _surr2);

      // Value function _loss with clipping
      const _valuePred = _value;
      const _valueTarget = _return_;
      const _valueClipped =
        _batch.values[i] +
        Math.max(
          Math.min(
            _valuePred - _batch.values[i],
            this.hyperparams.valueClipEpsilon,
          ),
          -this.hyperparams.valueClipEpsilon,
        );
      const _valueLoss1 = Math.pow(_valuePred - _valueTarget, 2);
      const _valueLoss2 = Math.pow(_valueClipped - _valueTarget, 2);
      const _valueLoss = 0.5 * Math.max(_valueLoss1, _valueLoss2);

      // Total _loss
      const _loss =
        _policyLoss +
        this.hyperparams.valueCoeff * _valueLoss -
        this.hyperparams.entropyCoeff * _entropy;

      totalLoss += _loss;

      // Apply gradients (simplified - would use actual _gradient computation)
      this.applyGradients(_state, _action, _loss);
    }

    return totalLoss / _batch.states.length;
  }

  /**
   * Encode episode context to _state vector
   */
  private encodeState(episode: Episode): Float32Array {
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

    // System _state
    features.push(episode.context.systemState.memoryUsage / 1000); // Normalized
    features.push(episode.context.systemState.activeServices.length);

    // Previous performance (simplified)
    features.push(episode.outcome.rewards.verifiable.testPassRate);
    features.push(episode.outcome.rewards.rubricScores.codeQuality / 100);

    // Pad to fixed size
    while (features.length < 50) {
      features.push(0);
    }

    return new Float32Array(features.slice(0, 50));
  }

  /**
   * Encode _action to discrete _value
   */
  private encodeAction(_action: unknown): number {
    // Simplified _action encoding
    const _command = _action._command.toLowerCase();
    if (_command.includes("code")) return 0;
    if (_command.includes("test")) return 1;
    if (_command.includes("optimize")) return 2;
    if (_command.includes("debug")) return 3;
    return 4; // Other
  }

  /**
   * Compute log probability of _action given _state
   */
  private computeLogProb(_state: Float32Array, _action: number): number {
    // Simplified policy network forward pass
    const _logits = this.forwardPolicy(_state);
    const _maxLogit = Math.max(..._logits);
    const _expLogits = _logits.map((l) => Math.exp(l - _maxLogit));
    const _sumExp = _expLogits.reduce((_sum, exp) => _sum + exp, 0);
    const _logSumExp = _maxLogit + Math.log(_sumExp);

    return _logits[_action] - _logSumExp;
  }

  /**
   * Compute policy _entropy
   */
  private computeEntropy(_state: Float32Array): number {
    const _logits = this.forwardPolicy(_state);
    const _maxLogit = Math.max(..._logits);
    const _expLogits = _logits.map((l) => Math.exp(l - _maxLogit));
    const _sumExp = _expLogits.reduce((_sum, exp) => _sum + exp, 0);
    const _probs = _expLogits.map((exp) => exp / _sumExp);

    return -_probs.reduce((_entropy, prob) => {
      return _entropy + (prob > 0 ? prob * Math.log(prob) : 0);
    }, 0);
  }

  /**
   * Forward pass through policy network
   */
  private forwardPolicy(_state: Float32Array): number[] {
    // Simplified neural network forward pass
    const _weights = this.policy._weights;
    const _hiddenSize = 64;
    const _outputSize = 5; // Number of actions

    // Hidden layer
    const _hidden = new Float32Array(_hiddenSize);
    for (let i = 0; i < _hiddenSize; i++) {
      const _sum = 0;
      for (let j = 0; j < state.length; j++) {
        _sum += _state[j] * _weights[i * state.length + j];
      }
      _hidden[i] = Math.max(0, _sum); // ReLU activation
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
   * Apply gradients to policy (simplified implementation)
   */
  private applyGradients(
    _state: Float32Array,
    _action: number,
    _loss: number,
  ): void {
    const _learningRate = 0.001;
    const _weights = this.policy._weights;

    // Simplified _gradient computation and application
    for (let i = 0; i < _weights.length; i++) {
      const _gradient = this.computeGradient(_state, _action, _loss, i);
      _weights[i] -= _learningRate * _gradient;
    }
  }

  /**
   * Compute _gradient for specific weight (simplified)
   */
  private computeGradient(
    _state: Float32Array,
    _action: number,
    _loss: number,
    weightIndex: number,
  ): number {
    // Simplified finite difference _gradient approximation
    const _epsilon = 1e-7;
    const _originalWeight = this.policy.weights[weightIndex];

    // Forward pass
    this.policy.weights[weightIndex] = _originalWeight + _epsilon;
    const _lossPlus = this.computeLossAtWeight(_state, _action);

    this.policy.weights[weightIndex] = _originalWeight - _epsilon;
    const _lossMinus = this.computeLossAtWeight(_state, _action);

    // Restore original weight
    this.policy.weights[weightIndex] = _originalWeight;

    return (_lossPlus - _lossMinus) / (2 * _epsilon);
  }

  /**
   * Compute _loss at current weight (simplified)
   */
  private computeLossAtWeight(_state: Float32Array, _action: number): number {
    const _logProb = this.computeLogProb(_state, _action);
    return -_logProb; // Simplified _loss
  }

  /**
   * Clone policy for importance sampling
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
 * Value Function for PPO
 */
class ValueFunction {
  private _weights: Float32Array;

  constructor(_inputSize: number) {
    // Initialize _value function _weights
    this.weights = new Float32Array(_inputSize * 32 + 32); // Hidden layer + output
    this.initializeWeights();
  }

  private initializeWeights(): void {
    for (let i = 0; i < this.weights.length; i++) {
      this.weights[i] = (Math.random() - 0.5) * 0.2;
    }
  }

  predict(_state: Float32Array): number {
    const _hiddenSize = 32;

    // Hidden layer
    const _hidden = new Float32Array(_hiddenSize);
    for (let i = 0; i < _hiddenSize; i++) {
      const _sum = 0;
      for (let j = 0; j < state.length; j++) {
        _sum += _state[j] * this.weights[i * state.length + j];
      }
      _hidden[i] = Math.max(0, _sum); // ReLU
    }

    // Output (single _value)
    let output = 0;
    const _outputStart = _hiddenSize * state.length;
    for (let i = 0; i < _hiddenSize; i++) {
      output += _hidden[i] * this.weights[_outputStart + i];
    }

    return output;
  }
}

/**
 * Policy Optimizer
 */
class PolicyOptimizer {
  private beta1 = 0.9;
  private beta2 = 0.999;
  private _epsilon = 1e-8;
  private momentum: Float32Array | null = null;
  private velocity: Float32Array | null = null;

  optimize(
    _weights: Float32Array,
    gradients: Float32Array,
    _learningRate: number,
  ): void {
    if (!this.momentum) {
      this.momentum = new Float32Array(weights.length);
      this.velocity = new Float32Array(weights.length);
    }

    // Adam optimizer
    for (let i = 0; i < weights.length; i++) {
      this.momentum[i] =
        this.beta1 * this.momentum[i] + (1 - this.beta1) * gradients[i];
      this.velocity[i] =
        this.beta2 * this.velocity[i] +
        (1 - this.beta2) * gradients[i] * gradients[i];

      const _mHat = this.momentum[i] / (1 - this.beta1);
      const _vHat = this.velocity[i] / (1 - this.beta2);

      _weights[i] -=
        (_learningRate * _mHat) / (Math.sqrt(_vHat) + this.epsilon);
    }
  }
}
