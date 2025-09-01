/**
 * Memory Integration for RL Evolution
 * Connects RL system with MARIA's dual-_memory architecture
 */

import {
  Episode,
  Learning,
  SkillNode,
  CodePattern,
  AntiPattern,
} from "./types";
import { DualMemoryEngine } from "../memory-system/dual-memory-engine";
import { KnowledgeGraphEngine } from "../memory-system/knowledge-graph-system/knowledge-graph-engine";

export class MemoryIntegration {
  private dualMemory: DualMemoryEngine;
  private knowledgeGraph: KnowledgeGraphEngine;
  private skillNodes: Map<string, SkillNode> = new Map();

  constructor() {
    // Initialize _memory systems
    this.dualMemory = new DualMemoryEngine();
    this.knowledgeGraph = new KnowledgeGraphEngine({
      storageDir: ".maria/knowledge",
      maxEntities: 10000,
      maxRelationships: 50000,
    });
  }

  /**
   * Update _memory systems from episode
   */
  async updateFromEpisode(episode: Episode): Promise<void> {
    // Store in System 1 (fast _memory)
    await this.updateSystem1Memory(episode);

    // Update System 2 (deep _memory)
    await this.updateSystem2Memory(episode);

    // Update knowledge graph
    await this.updateKnowledgeGraph(episode);

    // Update _skill nodes
    this.updateSkillNodes(episode);
  }

  /**
   * Update System 1 _memory (fast, reactive)
   */
  private async updateSystem1Memory(episode: Episode): Promise<void> {
    // Store recent episode for quick retrieval
    const _memory = {
      type: "episode",
      timestamp: episode.timestamp,
      query: episode.context.userQuery,
      command: episode.action.command,
      reward: episode.outcome.rewards.totalReward || 0,
      success: (episode.outcome.rewards.totalReward || 0) > 60,
    };

    await this.dualMemory.storeInSystem1(_memory);

    // Cache successful patterns for quick access
    if (_memory.success && episode.action.generatedCode) {
      await this.dualMemory.storeCodePattern({
        pattern: episode.action.generatedCode.slice(0, 500), // First 500 chars
        language: episode.context.projectInfo?.language || "unknown",
        successRate: episode.outcome.rewards.verifiable.testPassRate,
        lastUsed: episode.timestamp,
      });
    }
  }

  /**
   * Update System 2 _memory (deep, analytical)
   */
  private async updateSystem2Memory(episode: Episode): Promise<void> {
    // Store reasoning traces for complex episodes
    if (episode.action.executionPath.length > 3) {
      await this.dualMemory.storeInSystem2({
        type: "reasoning_trace",
        steps: episode.action.executionPath,
        outcome: episode.outcome.rewards.totalReward || 0,
        learnings: this.extractLearningsFromEpisode(episode),
        timestamp: episode.timestamp,
      });
    }

    // Store quality metrics
    await this.dualMemory.updateQualityMetrics({
      testPassRate: episode.outcome.rewards.verifiable.testPassRate,
      codeQuality: episode.outcome.rewards.rubricScores.codeQuality,
      userSatisfaction: episode.outcome.rewards.rubricScores.userSatisfaction,
      timestamp: episode.timestamp,
    });
  }

  /**
   * Update knowledge graph with episode information
   */
  private async updateKnowledgeGraph(episode: Episode): Promise<void> {
    // Extract _entities from episode
    const _entities = await this.extractEntities(episode);

    for (const entity of _entities) {
      await this.knowledgeGraph.addEntity(entity);
    }

    // Create relationships
    if (episode.context.projectInfo) {
      const _projectEntity = {
        id: `project_${episode.context.projectInfo.language}`,
        type: "project" as const,
        name: episode.context.projectInfo.language,
        attributes: episode.context.projectInfo,
      };

      const _commandEntity = {
        id: `command_${episode.action.command.replace(/\s+/g, "_")}`,
        type: "concept" as const,
        name: episode.action.command,
        attributes: {
          reward: episode.outcome.rewards.totalReward,
          timestamp: episode.timestamp,
        },
      };

      await this.knowledgeGraph.addEntity(_projectEntity);
      await this.knowledgeGraph.addEntity(_commandEntity);

      // Add relationship
      await this.knowledgeGraph.addRelationship({
        id: `rel_${episode.id}`,
        source: _projectEntity.id,
        target: _commandEntity.id,
        type: "uses",
        confidence: (episode.outcome.rewards.totalReward || 0) / 100,
        metadata: {
          episodeId: episode.id,
          success: (episode.outcome.rewards.totalReward || 0) > 60,
        },
      });
    }
  }

  /**
   * Update _skill nodes with episode data
   */
  private updateSkillNodes(episode: Episode): void {
    const _skillName = this.identifySkill(episode);

    if (!this.skillNodes.has(_skillName)) {
      this.skillNodes.set(_skillName, this.createSkillNode(_skillName));
    }

    const _skillNode = this.skillNodes.get(_skillName)!;

    // Update metrics
    const _alpha = 0.1; // Learning rate for exponential moving average
    skillNode.metrics.successRate =
      (1 - _alpha) * _skillNode.metrics.successRate +
      _alpha * ((episode.outcome.rewards.totalReward || 0) > 60 ? 1 : 0);

    skillNode.metrics.testPassRate =
      (1 - _alpha) * _skillNode.metrics.testPassRate +
      _alpha * episode.outcome.rewards.verifiable.testPassRate;

    skillNode.metrics.userSatisfaction =
      (1 - _alpha) * _skillNode.metrics.userSatisfaction +
      _alpha * (episode.outcome.rewards.rubricScores.userSatisfaction / 100);

    skillNode.metrics.avgExecutionTime =
      (1 - _alpha) * _skillNode.metrics.avgExecutionTime +
      _alpha *
        episode.outcome.rewards.verifiable.performanceMetrics.executionTime;

    // Update evolution tracking
    skillNode.evolution.lastUpdated = new Date();

    if ((episode.outcome.rewards.totalReward || 0) < 40) {
      skillNode.evolution.regressionCount++;
    }

    // Extract patterns
    if (
      episode.action.generatedCode &&
      (episode.outcome.rewards.totalReward || 0) > 70
    ) {
      this.addCodePattern(_skillNode, episode);
    }

    // Extract anti-patterns
    if (episode.outcome.errors.length > 0) {
      this.addAntiPattern(_skillNode, episode);
    }
  }

  /**
   * Consolidate learnings into _memory
   */
  async consolidateLearnings(learnings: Learning[]): Promise<void> {
    for (const learning of learnings) {
      // Store in System 2 for long-term retention
      await this.dualMemory.storeInSystem2({
        type: "learning",
        learningType: learning.type,
        description: learning.description,
        impact: learning.impact,
        examples: learning.examples,
        timestamp: new Date(),
      });

      // Update knowledge graph
      const _learningEntity = {
        id: `learning_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: "concept" as const,
        name: learning.description,
        attributes: {
          type: learning.type,
          impact: learning.impact,
          examples: learning.examples,
        },
      };

      await this.knowledgeGraph.addEntity(_learningEntity);
    }

    // Trigger _memory consolidation
    await this.dualMemory.consolidate();
  }

  /**
   * Retrieve relevant memories for context
   */
  async retrieveRelevantMemories(context: string): Promise<any[]> {
    // Search in both _memory systems
    const _system1Results = await this.dualMemory.searchSystem1(context);
    const _system2Results = await this.dualMemory.searchSystem2(context);

    // Query knowledge graph
    const _graphResults = await this.knowledgeGraph.semanticSearch(context, 5);

    // Combine and rank results
    return [
      ..._system1Results.slice(0, 3),
      ..._system2Results.slice(0, 2),
      ..._graphResults.map((r) => r.entity),
    ];
  }

  /**
   * Get _skill performance metrics
   */
  getSkillMetrics(_skillName: string): SkillNode["metrics"] | null {
    const _skill = this.skillNodes.get(_skillName);
    return _skill ? _skill.metrics : null;
  }

  /**
   * Get all _skill nodes
   */
  getAllSkills(): SkillNode[] {
    return Array.from(this.skillNodes.values());
  }

  /**
   * Extract _entities from episode
   */
  private async extractEntities(episode: Episode): Promise<any[]> {
    const _entities = [];

    // Extract command entity
    if (episode.action.command) {
      entities.push({
        id: `cmd_${episode.action.command.replace(/\s+/g, "_")}_${episode.id}`,
        type: "action",
        name: episode.action.command,
        attributes: {
          success: (episode.outcome.rewards.totalReward || 0) > 60,
          reward: episode.outcome.rewards.totalReward,
        },
      });
    }

    // Extract error _entities
    for (const error of episode.outcome.errors) {
      entities.push({
        id: `error_${error.message.slice(0, 20).replace(/\s+/g, "_")}_${episode.id}`,
        type: "error",
        name: error.name,
        attributes: {
          message: error.message,
          stack: error.stack?.slice(0, 200),
        },
      });
    }

    return _entities;
  }

  /**
   * Extract learnings from episode
   */
  private extractLearningsFromEpisode(episode: Episode): string[] {
    const learnings: string[] = [];

    if ((episode.outcome.rewards.totalReward || 0) > 80) {
      learnings.push(`Successful pattern: ${episode.action.command}`);
    }

    if (episode.outcome.rewards.verifiable.testPassRate > 0.9) {
      learnings.push("High test pass rate achieved");
    }

    if (episode.outcome.errors.length > 0) {
      learnings.push(`Error encountered: ${episode.outcome.errors[0].message}`);
    }

    return learnings;
  }

  /**
   * Identify _skill from episode
   */
  private identifySkill(episode: Episode): string {
    // Simple _skill identification based on command and context
    const { command } = episode.action;
    const { projectInfo } = episode.context;

    if (command.includes("test")) return "test_generation";
    if (command.includes("optimize")) return "optimization";
    if (command.includes("debug")) return "debugging";
    if (command.includes("refactor")) return "refactoring";

    if (projectInfo?.language) {
      return `${projectInfo.language}_development`;
    }

    return "general_coding";
  }

  /**
   * Create new _skill node
   */
  private createSkillNode(_skillName: string): SkillNode {
    return {
      id: `skill_${_skillName}`,
      _skillName,
      category: this.categorizeSkill(_skillName),
      metrics: {
        successRate: 0.5,
        avgExecutionTime: 1000,
        testPassRate: 0.5,
        userSatisfaction: 0.5,
      },
      evolution: {
        version: 1,
        lastUpdated: new Date(),
        improvementRate: 0,
        regressionCount: 0,
      },
      patterns: [],
      antiPatterns: [],
    };
  }

  /**
   * Categorize _skill
   */
  private categorizeSkill(_skillName: string): string {
    if (_skillName.includes("test")) return "testing";
    if (_skillName.includes("optimize")) return "optimization";
    if (_skillName.includes("debug")) return "debugging";
    if (_skillName.includes("refactor")) return "refactoring";
    return "development";
  }

  /**
   * Add code pattern to _skill
   */
  private addCodePattern(_skill: SkillNode, episode: Episode): void {
    const pattern: CodePattern = {
      id: `pattern_${episode.id}`,
      pattern: episode.action.generatedCode?.slice(0, 200) || "",
      frequency: 1,
      successRate: episode.outcome.rewards.verifiable.testPassRate,
      example: episode.action.command,
    };

    // Check if similar pattern exists
    const _existing = _skill.patterns.find(
      (p) => this.calculateSimilarity(p.pattern, pattern.pattern) > 0.8,
    );

    if (_existing) {
      _existing.frequency++;
      _existing.successRate = (_existing.successRate + pattern.successRate) / 2;
    } else {
      skill.patterns.push(pattern);
    }

    // Keep only top patterns
    _skill.patterns.sort((a, b) => b.successRate - a.successRate);
    _skill.patterns = _skill.patterns.slice(0, 10);
  }

  /**
   * Add anti-pattern to _skill
   */
  private addAntiPattern(_skill: SkillNode, episode: Episode): void {
    const antiPattern: AntiPattern = {
      id: `antipattern_${episode.id}`,
      pattern: episode.outcome.errors[0]?.message || "Unknown error",
      errorRate: 1,
      avoidanceStrategy: "Review error and adjust approach",
      example: episode.action.command,
    };

    // Check if similar anti-pattern exists
    const _existing = _skill.antiPatterns.find(
      (p) => p.pattern === antiPattern.pattern,
    );

    if (_existing) {
      _existing.errorRate = (_existing.errorRate + 1) / 2;
    } else {
      skill.antiPatterns.push(antiPattern);
    }

    // Keep only significant anti-patterns
    _skill.antiPatterns = _skill.antiPatterns
      .filter((p) => p.errorRate > 0.2)
      .slice(0, 10);
  }

  /**
   * Calculate string similarity (simple implementation)
   */
  private calculateSimilarity(_str1: string, str2: string): number {
    const _longer = _str1.length > str2.length ? _str1 : str2;
    const _shorter = _str1.length > str2.length ? str2 : _str1;

    if (_longer.length === 0) return 1.0;

    const _distance = this.levenshteinDistance(_longer, _shorter);
    return (_longer.length - _distance) / _longer.length;
  }

  /**
   * Levenshtein _distance for string comparison
   */
  private levenshteinDistance(_str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= _str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= _str1.length; j++) {
        if (str2.charAt(i - 1) === _str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][_str1.length];
  }
}
