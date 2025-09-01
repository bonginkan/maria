# 🧠 RL Evolution System - Phase 1 Implementation

The MARIA RL Evolution System introduces reinforcement learning capabilities that allow the system to learn and improve from real usage patterns, errors, and user feedback.

## 📋 Overview

This is the **Phase 1: Foundation** implementation of the MARIA v2.2.0 RL Evolution system. The system learns from actual usage to continuously optimize code generation, command execution, and user experience.

## 🏗️ Architecture

### Core Components

1. **RLEvolutionEngine** - Main orchestration engine
2. **RewardBuilder** - Aggregates and normalizes reward signals  
3. **ExperienceReplayBuffer** - Stores and manages episodes for learning
4. **MemoryIntegration** - Connects with MARIA's dual-memory system

### Reward System

The system uses multiple reward signals:

- **Verifiable Rewards (40%)**: Test results, build success, type checking
- **Rubric Scores (30%)**: Code quality, documentation, user satisfaction  
- **User Signals (20%)**: Thumbs up/down, acceptance rate, modifications
- **Performance (10%)**: Execution time, memory usage, bundle size

### Learning Modes

- `CODE_RLVR`: Code generation optimization using verifiable rewards
- `RUBRIC_RL`: Subjective quality improvement using rubric scores
- `ERROR_RECOVERY`: Learning from failure patterns
- `PERFORMANCE_TUNING`: Execution speed and efficiency optimization
- `USER_ADAPTATION`: Personalization based on user preferences

## 🚀 Usage

### Basic Commands

```bash
# Check system status
/evolve status

# Analyze learning opportunities
/evolve analyze

# Trigger learning cycle
/evolve learn

# Optimize specific tasks
/evolve optimize code-generation
/evolve optimize documentation
/evolve optimize performance

# View evolution report
/evolve report

# Rollback if needed
/evolve rollback
```

### Example Usage

```typescript
import { RLEvolutionEngine } from './services/rl-evolution/RLEvolutionEngine';
import { RLEvolutionMode } from './services/rl-evolution/types';

// Initialize engine
const rlEngine = new RLEvolutionEngine({
  learningRate: 0.001,
  batchSize: 32,
  replayBufferSize: 10000,
});

// Record an episode
await rlEngine.recordEpisode(context, action, outcome);

// Trigger learning
const report = await rlEngine.learn();

// Set specific mode
rlEngine.setMode(RLEvolutionMode.CODE_RLVR);
```

## 📊 Episode Structure

Each learning episode contains:

```typescript
interface Episode {
  id: string;
  timestamp: Date;
  context: {
    userQuery: string;
    systemState: SystemState;
    projectInfo?: ProjectInfo;
  };
  action: {
    command: string;
    generatedCode?: string;
    executionPath: string[];
  };
  outcome: {
    rewards: RewardSignals;
    errors: Error[];
    userFeedback?: UserFeedback;
  };
  metadata: EpisodeMetadata;
}
```

## 🎯 Reward Calculation

Total reward is calculated as:

```
reward = (verifiable × 0.4) + (rubric × 0.3) + (user × 0.2) + (performance × 0.1) - penalties
```

### Verifiable Rewards
- Test pass rate: 0-40 points
- Build success: +20 points (or -10 for failure)
- Type checking: +15 points (or -5 for failure)
- Lint errors: -2 points per error (max -20)

### Rubric Scores
- Code quality: 30% weight
- Documentation: 20% weight  
- User satisfaction: 25% weight
- Innovativeness: 15% weight
- Efficiency: 10% weight

## 🔄 Learning Pipeline

1. **Episode Recording**: Real-time capture of user interactions
2. **Reward Calculation**: Multi-signal reward aggregation
3. **Experience Storage**: Prioritized replay buffer
4. **Pattern Recognition**: Failure clustering and success pattern extraction
5. **Policy Update**: Gradient-based learning (PPO/DPO)
6. **Safety Validation**: Regression prevention and rollback
7. **Memory Integration**: Long-term pattern storage

## 🛡️ Safety Features

- **Regression Detection**: Automatic rollback if performance degrades
- **Validation Gates**: Safety checks before policy deployment
- **Incremental Learning**: Conservative update approach
- **Backup Policies**: Previous versions maintained for rollback

## 📈 Performance Metrics

Phase 1 targets:
- **Learning Convergence**: <1000 episodes for stable policy
- **Reward Accuracy**: 95%+ correlation with actual performance
- **Safety**: <5% regression rate
- **Response Time**: <100ms for reward calculation
- **Memory Efficiency**: <50MB for 10K episodes

## 🔧 Configuration

```json
{
  "evolution": {
    "enabled": true,
    "learningRate": 0.001,
    "batchSize": 32,
    "replayBufferSize": 10000,
    "updateFrequency": "on-demand",
    "safetyThresholds": {
      "maxRegressionRate": 0.05,
      "minTestPassRate": 0.90,
      "rollbackThreshold": 0.80
    }
  }
}
```

## 📁 File Structure

```
src/services/rl-evolution/
├── types.ts                    # Type definitions
├── RLEvolutionEngine.ts        # Main engine
├── RewardBuilder.ts            # Reward calculation
├── ExperienceReplayBuffer.ts   # Episode storage
├── MemoryIntegration.ts        # Memory system interface
├── __tests__/                  # Unit tests
│   ├── RewardBuilder.test.ts
│   └── ExperienceReplayBuffer.test.ts
└── README.md                   # This file

src/slash-commands/categories/evolution/
└── EvolveCommand.ts            # /evolve command handler
```

## 🎓 Example Scenarios

### Scenario 1: Learning from Test Failures
```bash
# User runs failing tests
npm test  # 5 tests fail

# System records episode with low verifiable reward
# Trigger learning to improve code generation
/evolve learn

# Next code generation incorporates learned patterns
/code create-user-service  # Higher success rate
```

### Scenario 2: Improving Documentation Quality
```bash
# User gives thumbs down on documentation
/doc explain-api  # User rates 2/5 stars

# System records low rubric scores
# Optimize documentation generation
/evolve optimize documentation

# Future documentation improved
/doc explain-api  # Better clarity and examples
```

## 🚀 Next Steps (Phase 2)

Phase 2 will add:
- **PPO/DPO Implementation**: Full reinforcement learning algorithms
- **Advanced Rubric System**: Configurable quality metrics
- **Multi-Agent Learning**: Specialized agents for different tasks
- **A/B Testing**: Policy comparison framework
- **Real-time Adaptation**: Live learning during conversations

## 🧪 Testing

Run the test suite:

```bash
# Unit tests
pnpm test src/services/rl-evolution/__tests__/

# Demo script
node examples/rl-evolution-demo.ts

# Integration test
/evolve status
/evolve analyze
```

## 📚 References

- **RLVR**: Reinforcement Learning from Verifiable Rewards
- **Rubric RL**: Quality assessment using structured rubrics
- **PPO**: Proximal Policy Optimization for stable learning
- **DPO**: Direct Preference Optimization from user feedback

---

**MARIA RL Evolution System** - Learning from every interaction to become a better AI assistant.

© 2025 Bonginkan Inc. All rights reserved.