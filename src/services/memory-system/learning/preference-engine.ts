/**
 * Preference Engine
 *
 * Adaptive _behavior system that personalizes AI responses based on user patterns.
 * Learns and adapts to individual user preferences and working styles.
 */

import { EventEmitter } from "node:events";
import type { UserPattern } from "./user-pattern-analyzer";

export interface AdaptiveBehavior {
  userId: string;
  responseStyle: ResponseStyle;
  codeGenerationStyle: CodeGenerationStyle;
  explanationStyle: ExplanationStyle;
  interactionStyle: InteractionStyle;
  assistanceLevel: AssistanceLevel;
  personalizationSettings: PersonalizationSettings;
}

export interface ResponseStyle {
  length: "brief" | "moderate" | "detailed" | "comprehensive";
  tone: "formal" | "professional" | "casual" | "friendly";
  structure: "bullet-points" | "paragraphs" | "mixed" | "code-heavy";
  examples: "minimal" | "moderate" | "extensive";
  technicalDepth: "surface" | "intermediate" | "deep" | "expert";
  assumptionLevel: "explain-everything" | "assume-basics" | "assume-expertise";
}

export interface CodeGenerationStyle {
  commentDensity: "none" | "minimal" | "moderate" | "extensive";
  commentStyle: "inline" | "block" | "jsdoc" | "mixed";
  variableNaming: "concise" | "descriptive" | "verbose";
  functionGranularity: "monolithic" | "balanced" | "highly-modular";
  errorHandling: "minimal" | "basic" | "comprehensive" | "paranoid";
  optimization: "readability" | "balanced" | "performance";
  patterns: CodePatternPreference[];
}

export interface CodePatternPreference {
  pattern: string;
  preference: "avoid" | "neutral" | "prefer" | "always";
  alternatives: string[];
}

export interface ExplanationStyle {
  conceptIntroduction: "assume-known" | "brief-reminder" | "full-explanation";
  reasoning: "skip" | "brief" | "detailed" | "step-by-step";
  alternatives: "none" | "mention" | "compare" | "exhaustive";
  tradeoffs: "skip" | "mention" | "discuss" | "analyze";
  references: "none" | "minimal" | "relevant" | "comprehensive";
  diagrams: "never" | "when-helpful" | "frequently" | "always";
}

export interface InteractionStyle {
  proactivity: "reactive" | "suggestive" | "proactive" | "autonomous";
  confirmationNeeded: "never" | "major-changes" | "most-actions" | "everything";
  feedbackHandling: "immediate" | "batch" | "summary" | "on-request";
  progressUpdates: "none" | "milestones" | "regular" | "continuous";
  errorReporting: "silent" | "critical-only" | "all-errors" | "verbose";
  suggestions: "disabled" | "on-request" | "contextual" | "continuous";
}

export interface AssistanceLevel {
  autonomy: "full-control" | "guided" | "collaborative" | "automated";
  scaffolding: "none" | "minimal" | "moderate" | "extensive";
  validation: "trust" | "spot-check" | "verify" | "paranoid";
  completion: "manual" | "semi-auto" | "auto-complete" | "fully-automated";
  optimization: "as-is" | "suggest" | "auto-optimize" | "aggressive";
}

export interface PersonalizationSettings {
  learningRate: number; // 0-1, how quickly to adapt
  adaptationThreshold: number; // confidence needed before changing
  experimentalFeatures: boolean;
  memoryRetention: "session" | "day" | "week" | "permanent";
  privacyLevel: "minimal" | "balanced" | "maximum";
  sharingPreference: "private" | "team" | "organization" | "public";
}

export interface PreferenceProfile {
  _behavior: AdaptiveBehavior;
  confidence: PreferenceConfidence;
  history: PreferenceHistory;
  overrides: PreferenceOverride[];
}

export interface PreferenceConfidence {
  overall: number;
  responseStyle: number;
  codeGeneration: number;
  explanation: number;
  interaction: number;
  assistance: number;
}

export interface PreferenceHistory {
  created: Date;
  lastUpdated: Date;
  updateCount: number;
  significantChanges: PreferenceChange[];
  feedbackHistory: FeedbackEvent[];
}

export interface PreferenceChange {
  timestamp: Date;
  category: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  impact: "minor" | "moderate" | "major";
}

export interface FeedbackEvent {
  timestamp: Date;
  type: "positive" | "negative" | "neutral" | "correction";
  _aspect: string;
  details: string;
  applied: boolean;
}

export interface PreferenceOverride {
  id: string;
  category: string;
  setting: string;
  value: unknown;
  reason: string;
  expires?: Date;
  priority: number;
}

export interface AdaptationRule {
  id: string;
  name: string;
  description: string;
  condition: AdaptationCondition;
  action: AdaptationAction;
  priority: number;
  enabled: boolean;
}

export interface AdaptationCondition {
  type: "pattern" | "feedback" | "time" | "context" | "metric";
  operator: "equals" | "contains" | "greater" | "less" | "matches";
  value: unknown;
  threshold?: number;
  window?: number; // time window in minutes
}

export interface AdaptationAction {
  type: "adjust" | "set" | "increment" | "decrement" | "toggle";
  target: string; // dot notation path to setting
  value: unknown;
  gradual: boolean; // whether to apply gradually
  rate?: number; // rate of change if gradual
}

export interface PreferenceMetrics {
  satisfactionScore: number;
  adaptationAccuracy: number;
  consistencyScore: number;
  engagementLevel: number;
  productivityImpact: number;
}

export interface PreferenceRecommendation {
  id: string;
  category: string;
  recommendation: string;
  rationale: string;
  impact: "low" | "medium" | "high";
  confidence: number;
  suggestedValue: unknown;
  currentValue: unknown;
}

export class PreferenceEngine extends EventEmitter {
  private profiles: Map<string, PreferenceProfile>;
  private adaptationRules: AdaptationRule[];
  private metricsCache: Map<string, PreferenceMetrics>;
  private recommendationCache: Map<string, PreferenceRecommendation[]>;
  private updateQueue: PreferenceUpdate[];
  private processingInterval?: NodeJS.Timeout;

  constructor() {
    super();

    this.profiles = new Map();
    this.adaptationRules = this.initializeAdaptationRules();
    this.metricsCache = new Map();
    this.recommendationCache = new Map();
    this.updateQueue = [];

    this.startProcessing();
  }

  // ========== Preference Learning ==========

  async learnFromPattern(_userId: string, pattern: UserPattern): Promise<void> {
    const _profile =
      this.profiles.get(_userId) || this.createDefaultProfile(_userId);

    // Adapt response style based on communication patterns
    this.adaptResponseStyle(_profile, pattern);

    // Adapt code generation style based on coding patterns
    this.adaptCodeGenerationStyle(_profile, pattern);

    // Adapt explanation style based on learning _profile
    this.adaptExplanationStyle(_profile, pattern);

    // Adapt interaction style based on working patterns
    this.adaptInteractionStyle(_profile, pattern);

    // Adapt assistance level based on problem-solving approach
    this.adaptAssistanceLevel(_profile, pattern);

    // Update confidence scores
    this.updateConfidence(_profile, pattern);

    // Record the _update
    _profile.history.lastUpdated = new Date();
    profile.history.updateCount++;

    this.profiles.set(_userId, _profile);

    // Generate _recommendations
    const _recommendations = await this.generateRecommendations(
      _profile,
      pattern,
    );
    this.recommendationCache.set(_userId, _recommendations);

    this.emit("preferenceLearned", { _userId, _profile, _recommendations });
  }

  private adaptResponseStyle(
    _profile: PreferenceProfile,
    pattern: UserPattern,
  ): void {
    const _behavior = _profile._behavior;

    // Adapt response length based on communication style
    switch (pattern.communicationStyle.responseLength) {
      case "verbose":
        behavior.responseStyle.length = "comprehensive";
        break;
      case "concise":
        behavior.responseStyle.length = "moderate";
        break;
      case "minimal":
        behavior.responseStyle.length = "brief";
        break;
    }

    // Adapt technical depth based on expertise
    switch (pattern.communicationStyle.technicalLevel) {
      case "expert":
        _behavior.responseStyle.technicalDepth = "expert";
        behavior.responseStyle.assumptionLevel = "assume-expertise";
        break;
      case "intermediate":
        _behavior.responseStyle.technicalDepth = "intermediate";
        behavior.responseStyle.assumptionLevel = "assume-basics";
        break;
      case "beginner-friendly":
        _behavior.responseStyle.technicalDepth = "surface";
        behavior.responseStyle.assumptionLevel = "explain-everything";
        break;
    }

    // Adapt structure based on learning style
    if (pattern.learningProfile.learningStyle.primary === "visual") {
      behavior.responseStyle.structure = "bullet-points";
    } else if (pattern.learningProfile.learningStyle.primary === "reading") {
      behavior.responseStyle.structure = "paragraphs";
    } else if (pattern.learningProfile.learningStyle.primary === "hands-on") {
      behavior.responseStyle.structure = "code-heavy";
    }

    // Adapt examples based on learning preferences
    if (
      pattern.learningProfile.learningStyle.examplePreference ===
      "many-examples"
    ) {
      behavior.responseStyle.examples = "extensive";
    } else if (
      pattern.learningProfile.learningStyle.examplePreference === "few-examples"
    ) {
      behavior.responseStyle.examples = "moderate";
    } else {
      behavior.responseStyle.examples = "minimal";
    }
  }

  private adaptCodeGenerationStyle(
    _profile: PreferenceProfile,
    pattern: UserPattern,
  ): void {
    const _behavior = _profile._behavior;

    // Adapt comment density based on documentation level
    switch (pattern.developmentStyle.documentationLevel) {
      case "extensive":
        behavior.codeGenerationStyle.commentDensity = "extensive";
        break;
      case "essential":
        behavior.codeGenerationStyle.commentDensity = "moderate";
        break;
      case "minimal":
      case "inline-heavy":
        behavior.codeGenerationStyle.commentDensity = "minimal";
        break;
    }

    // Adapt comment style based on preferences
    switch (pattern.codeQualityPreferences.commentingStyle.location) {
      case "inline":
        behavior.codeGenerationStyle.commentStyle = "inline";
        break;
      case "block":
        behavior.codeGenerationStyle.commentStyle = "block";
        break;
      case "header":
        behavior.codeGenerationStyle.commentStyle = "jsdoc";
        break;
      default:
        behavior.codeGenerationStyle.commentStyle = "mixed";
    }

    // Adapt variable naming based on preferences
    switch (pattern.codeQualityPreferences.namingConventions.verbosity) {
      case "descriptive":
        behavior.codeGenerationStyle.variableNaming = "descriptive";
        break;
      case "concise":
        behavior.codeGenerationStyle.variableNaming = "concise";
        break;
      case "abbreviated":
        behavior.codeGenerationStyle.variableNaming = "concise";
        break;
    }

    // Adapt function granularity based on code organization
    switch (pattern.developmentStyle.codeOrganization) {
      case "modular":
      case "microservices":
        behavior.codeGenerationStyle.functionGranularity = "highly-modular";
        break;
      case "monolithic":
        behavior.codeGenerationStyle.functionGranularity = "monolithic";
        break;
      default:
        behavior.codeGenerationStyle.functionGranularity = "balanced";
    }

    // Adapt error handling based on preferences
    switch (pattern.codeQualityPreferences.errorHandling.strategy) {
      case "defensive":
        behavior.codeGenerationStyle.errorHandling = "comprehensive";
        break;
      case "optimistic":
        behavior.codeGenerationStyle.errorHandling = "minimal";
        break;
      case "fail-fast":
        behavior.codeGenerationStyle.errorHandling = "basic";
        break;
      case "graceful-degradation":
        behavior.codeGenerationStyle.errorHandling = "comprehensive";
        break;
    }

    // Adapt optimization based on performance consideration
    switch (pattern.codeQualityPreferences.performanceConsideration) {
      case "optimize-first":
        behavior.codeGenerationStyle.optimization = "performance";
        break;
      case "functional-first":
        behavior.codeGenerationStyle.optimization = "readability";
        break;
      case "balanced":
        behavior.codeGenerationStyle.optimization = "balanced";
        break;
    }
  }

  private adaptExplanationStyle(
    _profile: PreferenceProfile,
    pattern: UserPattern,
  ): void {
    const _behavior = _profile._behavior;

    // Adapt concept introduction based on knowledge acquisition
    switch (pattern.learningProfile.knowledgeAcquisition.speed) {
      case "fast":
        behavior.explanationStyle.conceptIntroduction = "assume-known";
        break;
      case "moderate":
        behavior.explanationStyle.conceptIntroduction = "brief-reminder";
        break;
      case "methodical":
        behavior.explanationStyle.conceptIntroduction = "full-explanation";
        break;
    }

    // Adapt reasoning based on learning style
    if (pattern.learningProfile.learningStyle.conceptualDepth === "deep-dive") {
      behavior.explanationStyle.reasoning = "step-by-step";
    } else if (
      pattern.learningProfile.learningStyle.conceptualDepth === "thorough"
    ) {
      behavior.explanationStyle.reasoning = "detailed";
    } else {
      behavior.explanationStyle.reasoning = "brief";
    }

    // Adapt alternatives based on problem-solving approach
    if (pattern.problemSolvingApproach.experimentationRate > 0.7) {
      behavior.explanationStyle.alternatives = "exhaustive";
    } else if (pattern.problemSolvingApproach.experimentationRate > 0.4) {
      behavior.explanationStyle.alternatives = "compare";
    } else {
      behavior.explanationStyle.alternatives = "mention";
    }

    // Adapt references based on documentation reliance
    switch (
      pattern.learningProfile.knowledgeAcquisition.documentationReliance
    ) {
      case "heavy":
        behavior.explanationStyle.references = "comprehensive";
        break;
      case "moderate":
        behavior.explanationStyle.references = "relevant";
        break;
      case "minimal":
        behavior.explanationStyle.references = "minimal";
        break;
    }

    // Adapt diagrams based on learning style
    if (pattern.learningProfile.learningStyle.primary === "visual") {
      behavior.explanationStyle.diagrams = "frequently";
    } else {
      behavior.explanationStyle.diagrams = "when-helpful";
    }
  }

  private adaptInteractionStyle(
    _profile: PreferenceProfile,
    pattern: UserPattern,
  ): void {
    const _behavior = _profile._behavior;

    // Adapt proactivity based on collaboration level
    switch (pattern.communicationStyle.collaborationLevel) {
      case "highly-interactive":
        behavior.interactionStyle.proactivity = "proactive";
        break;
      case "periodic-sync":
        behavior.interactionStyle.proactivity = "suggestive";
        break;
      case "independent":
        behavior.interactionStyle.proactivity = "reactive";
        break;
    }

    // Adapt confirmation needs based on AI assistance preference
    switch (pattern.toolPreferences.aiAssistance.verificationBehavior) {
      case "always-verify":
        behavior.interactionStyle.confirmationNeeded = "most-actions";
        break;
      case "trust-but-verify":
        behavior.interactionStyle.confirmationNeeded = "major-changes";
        break;
      case "trust-completely":
        behavior.interactionStyle.confirmationNeeded = "never";
        break;
    }

    // Adapt feedback handling based on feedback preference
    switch (pattern.communicationStyle.feedbackPreference) {
      case "continuous":
        behavior.interactionStyle.feedbackHandling = "immediate";
        break;
      case "milestone-based":
        behavior.interactionStyle.feedbackHandling = "batch";
        break;
      case "final-only":
        behavior.interactionStyle.feedbackHandling = "summary";
        break;
    }

    // Adapt progress updates based on communication style
    if (pattern.communicationStyle.responseLength === "verbose") {
      behavior.interactionStyle.progressUpdates = "continuous";
    } else if (pattern.communicationStyle.responseLength === "minimal") {
      behavior.interactionStyle.progressUpdates = "milestones";
    } else {
      behavior.interactionStyle.progressUpdates = "regular";
    }

    // Adapt error reporting based on error handling style
    switch (pattern.codeQualityPreferences.errorHandling.loggingVerbosity) {
      case "everything":
      case "debug-heavy":
        behavior.interactionStyle.errorReporting = "verbose";
        break;
      case "errors-only":
        behavior.interactionStyle.errorReporting = "all-errors";
        break;
      case "critical-only":
        behavior.interactionStyle.errorReporting = "critical-only";
        break;
    }
  }

  private adaptAssistanceLevel(
    _profile: PreferenceProfile,
    pattern: UserPattern,
  ): void {
    const _behavior = _profile._behavior;

    // Adapt autonomy based on AI assistance usage
    switch (pattern.toolPreferences.aiAssistance.usageLevel) {
      case "heavy":
        behavior.assistanceLevel.autonomy = "automated";
        break;
      case "moderate":
        behavior.assistanceLevel.autonomy = "collaborative";
        break;
      case "minimal":
        behavior.assistanceLevel.autonomy = "guided";
        break;
      case "none":
        behavior.assistanceLevel.autonomy = "full-control";
        break;
    }

    // Adapt scaffolding based on skill progression
    switch (pattern.learningProfile.skillProgression.masteryApproach) {
      case "perfectionist":
        behavior.assistanceLevel.scaffolding = "extensive";
        break;
      case "good-enough":
        behavior.assistanceLevel.scaffolding = "moderate";
        break;
      case "continuous":
        behavior.assistanceLevel.scaffolding = "minimal";
        break;
    }

    // Adapt validation based on trust level
    const _trustLevel = pattern.toolPreferences.aiAssistance._trustLevel;
    if (_trustLevel > 0.8) {
      behavior.assistanceLevel.validation = "trust";
    } else if (_trustLevel > 0.5) {
      behavior.assistanceLevel.validation = "spot-check";
    } else if (_trustLevel > 0.2) {
      behavior.assistanceLevel.validation = "verify";
    } else {
      behavior.assistanceLevel.validation = "paranoid";
    }

    // Adapt completion based on scope preference
    switch (pattern.toolPreferences.aiAssistance.scopePreference) {
      case "full-solution":
        behavior.assistanceLevel.completion = "fully-automated";
        break;
      case "guidance":
        behavior.assistanceLevel.completion = "semi-auto";
        break;
      case "syntax-only":
        behavior.assistanceLevel.completion = "manual";
        break;
    }
  }

  // ========== Feedback Processing ==========

  async processFeedback(
    userId: string,
    feedback: {
      type: "positive" | "negative" | "neutral" | "correction";
      _aspect: string;
      details: string;
    },
  ): Promise<void> {
    const _profile =
      this.profiles.get(userId) || this.createDefaultProfile(userId);

    // Record feedback
    const feedbackEvent: FeedbackEvent = {
      timestamp: new Date(),
      type: feedback.type,
      _aspect: feedback.aspect,
      details: feedback.details,
      applied: false,
    };

    profile.history.feedbackHistory.push(feedbackEvent);

    // Apply feedback-based adaptations
    if (feedback.type === "negative" || feedback.type === "correction") {
      await this.applyNegativeFeedback(_profile, feedback);
      feedbackEvent.applied = true;
    } else if (feedback.type === "positive") {
      await this.reinforceCurrentSettings(_profile, feedback.aspect);
      feedbackEvent.applied = true;
    }

    // Check adaptation rules
    await this.checkAdaptationRules(_profile);

    this.profiles.set(userId, _profile);

    this.emit("feedbackProcessed", { userId, feedback, _profile });
  }

  private async applyNegativeFeedback(
    _profile: PreferenceProfile,
    feedback: { _aspect: string; details: string },
  ): Promise<void> {
    // Parse feedback and adjust preferences
    const _aspect = feedback._aspect.toLowerCase();

    if (_aspect.includes("length") || _aspect.includes("verbose")) {
      // Adjust response length
      const _current = profile.behavior.responseStyle.length;
      if (
        feedback.details.includes("too long") ||
        feedback.details.includes("verbose")
      ) {
        profile.behavior.responseStyle.length = this.decreaseLength(_current);
      } else if (
        feedback.details.includes("too short") ||
        feedback.details.includes("brief")
      ) {
        profile.behavior.responseStyle.length = this.increaseLength(_current);
      }
    }

    if (_aspect.includes("technical") || _aspect.includes("complexity")) {
      // Adjust technical depth
      const _current = profile.behavior.responseStyle.technicalDepth;
      if (
        feedback.details.includes("too complex") ||
        feedback.details.includes("difficult")
      ) {
        profile.behavior.responseStyle.technicalDepth =
          this.decreaseDepth(_current);
      } else if (
        feedback.details.includes("too simple") ||
        feedback.details.includes("basic")
      ) {
        profile.behavior.responseStyle.technicalDepth =
          this.increaseDepth(_current);
      }
    }

    if (_aspect.includes("comment") || _aspect.includes("documentation")) {
      // Adjust comment density
      const _current = profile.behavior.codeGenerationStyle.commentDensity;
      if (
        feedback.details.includes("too many") ||
        feedback.details.includes("excessive")
      ) {
        profile.behavior.codeGenerationStyle.commentDensity =
          this.decreaseComments(_current);
      } else if (
        feedback.details.includes("not enough") ||
        feedback.details.includes("more")
      ) {
        profile.behavior.codeGenerationStyle.commentDensity =
          this.increaseComments(_current);
      }
    }

    // Record the change
    this.recordPreferenceChange(
      _profile,
      _aspect,
      "Negative feedback adjustment",
    );
  }

  private async reinforceCurrentSettings(
    _profile: PreferenceProfile,
    _aspect: string,
  ): Promise<void> {
    // Increase confidence in _current settings
    if (_aspect.includes("response") || _aspect.includes("explanation")) {
      profile.confidence.responseStyle = Math.min(
        1,
        profile.confidence.responseStyle + 0.1,
      );
      profile.confidence.explanation = Math.min(
        1,
        profile.confidence.explanation + 0.1,
      );
    }

    if (_aspect.includes("code") || _aspect.includes("generation")) {
      profile.confidence.codeGeneration = Math.min(
        1,
        profile.confidence.codeGeneration + 0.1,
      );
    }

    if (_aspect.includes("interaction") || _aspect.includes("assistance")) {
      profile.confidence.interaction = Math.min(
        1,
        profile.confidence.interaction + 0.1,
      );
      profile.confidence.assistance = Math.min(
        1,
        profile.confidence.assistance + 0.1,
      );
    }

    // Update overall confidence
    this.updateOverallConfidence(_profile);
  }

  // ========== Adaptation Rules ==========

  private async checkAdaptationRules(
    _profile: PreferenceProfile,
  ): Promise<void> {
    for (const rule of this.adaptationRules) {
      if (!rule.enabled) {
        continue;
      }

      if (this.evaluateCondition(rule.condition, _profile)) {
        await this.applyAction(rule.action, _profile);

        this.emit("ruleApplied", {
          userId: profile.behavior.userId,
          rule,
          _profile,
        });
      }
    }
  }

  private evaluateCondition(
    _condition: AdaptationCondition,
    _profile: PreferenceProfile,
  ): boolean {
    switch (_condition.type) {
      case "feedback":
        {
          // Check recent feedback
          const _recentFeedback = _profile.history.feedbackHistory.slice(-10);
          const _negativeCount = _recentFeedback.filter(
            (f) => f.type === "negative",
          ).length;
        }
        return _negativeCount > (_condition.threshold || 3);

      case "metric":
        {
          // Check _metrics
          const _metrics = this.metricsCache.get(_profile.behavior.userId);
          if (_metrics && _condition.value) {
            const _metricValue = (_metrics as any)[_condition.value as string];
          }
          return this.compareValue(
            _metricValue,
            _condition.operator,
            _condition.threshold,
          );
        }
        return false;

      case "time":
        {
          // Check time-based conditions
          const _lastUpdate = _profile.history.lastUpdated;
          const _minutesSinceUpdate =
            (Date.now() - _lastUpdate.getTime()) / 60000;
        }
        return _minutesSinceUpdate > (_condition.threshold || 60);

      default:
        return false;
    }
  }

  private compareValue(
    _value: unknown,
    operator: string,
    threshold?: number,
  ): boolean {
    if (typeof _value !== "number" || threshold === undefined) {
      return false;
    }

    switch (operator) {
      case "greater":
        return _value > threshold;
      case "less":
        return _value < threshold;
      case "equals":
        return Math.abs(_value - threshold) < 0.01;
      default:
        return false;
    }
  }

  private async applyAction(
    _action: AdaptationAction,
    _profile: PreferenceProfile,
  ): Promise<void> {
    const _targetPath = _action.target.split(".");
    let target: unknown = profile.behavior;

    // Navigate to target _property
    for (let i = 0; i < _targetPath.length - 1; i++) {
      target = target[_targetPath[i]];
      if (!target) {
        return;
      }
    }

    const _property = _targetPath[_targetPath.length - 1];

    switch (_action.type) {
      case "set":
        target[_property] = _action.value;
        break;
      case "adjust":
        if (
          typeof target[_property] === "number" &&
          typeof _action.value === "number"
        ) {
          target[_property] = _action.gradual
            ? target[_property] + _action.value * (_action.rate || 0.1)
            : _action.value;
        }
        break;
      case "increment":
        if (typeof target[_property] === "number") {
          target[_property] = Math.min(
            1,
            target[_property] + (_action.rate || 0.1),
          );
        }
        break;
      case "decrement":
        if (typeof target[_property] === "number") {
          target[_property] = Math.max(
            0,
            target[_property] - (_action.rate || 0.1),
          );
        }
        break;
      case "toggle":
        if (typeof target[_property] === "boolean") {
          target[_property] = !target[_property];
        }
        break;
    }

    this.recordPreferenceChange(
      _profile,
      _action.target,
      "Adaptation rule applied",
    );
  }

  // ========== Recommendation Generation ==========

  private async generateRecommendations(
    _profile: PreferenceProfile,
    pattern: UserPattern,
  ): Promise<PreferenceRecommendation[]> {
    const _recommendations: PreferenceRecommendation[] = [];

    // Check for misalignment between pattern and preferences
    if (
      pattern.communicationStyle.responseLength === "verbose" &&
      profile.behavior.responseStyle.length === "brief"
    ) {
      recommendations.push({
        id: "response-length-alignment",
        category: "response-style",
        recommendation: "Consider increasing response detail level",
        rationale:
          "Your communication pattern suggests preference for detailed responses",
        impact: "medium",
        confidence: 0.7,
        suggestedValue: "detailed",
        currentValue: _profile.behavior.responseStyle.length,
      });
    }

    // Check for optimization opportunities
    if (
      pattern.developmentStyle.testingPhilosophy === "comprehensive" &&
      profile.behavior.codeGenerationStyle.errorHandling === "minimal"
    ) {
      recommendations.push({
        id: "error-handling-enhancement",
        category: "code-generation",
        recommendation: "Enhance error handling in generated code",
        rationale:
          "Your testing philosophy suggests preference for robust error handling",
        impact: "high",
        confidence: 0.8,
        suggestedValue: "comprehensive",
        currentValue: _profile.behavior.codeGenerationStyle.errorHandling,
      });
    }

    // Check for learning style alignment
    if (
      pattern.learningProfile.learningStyle.primary === "visual" &&
      profile.behavior.explanationStyle.diagrams === "never"
    ) {
      recommendations.push({
        id: "visual-learning-support",
        category: "explanation-style",
        recommendation: "Enable diagram generation for explanations",
        rationale: "Your learning style indicates visual preference",
        impact: "high",
        confidence: 0.85,
        suggestedValue: "frequently",
        currentValue: _profile.behavior.explanationStyle.diagrams,
      });
    }

    return _recommendations;
  }

  // ========== Utility Methods ==========

  private createDefaultProfile(userId: string): PreferenceProfile {
    const _behavior: AdaptiveBehavior = {
      userId,
      responseStyle: {
        length: "moderate",
        tone: "professional",
        structure: "mixed",
        examples: "moderate",
        technicalDepth: "intermediate",
        assumptionLevel: "assume-basics",
      },
      codeGenerationStyle: {
        commentDensity: "moderate",
        commentStyle: "mixed",
        variableNaming: "descriptive",
        functionGranularity: "balanced",
        errorHandling: "basic",
        optimization: "balanced",
        patterns: [],
      },
      explanationStyle: {
        conceptIntroduction: "brief-reminder",
        reasoning: "brief",
        alternatives: "mention",
        tradeoffs: "mention",
        references: "relevant",
        diagrams: "when-helpful",
      },
      interactionStyle: {
        proactivity: "suggestive",
        confirmationNeeded: "major-changes",
        feedbackHandling: "batch",
        progressUpdates: "regular",
        errorReporting: "all-errors",
        suggestions: "contextual",
      },
      assistanceLevel: {
        autonomy: "collaborative",
        scaffolding: "moderate",
        validation: "verify",
        completion: "semi-auto",
        optimization: "suggest",
      },
      personalizationSettings: {
        learningRate: 0.5,
        adaptationThreshold: 0.7,
        experimentalFeatures: false,
        memoryRetention: "week",
        privacyLevel: "balanced",
        sharingPreference: "team",
      },
    };

    return {
      _behavior,
      confidence: {
        overall: 0.5,
        responseStyle: 0.5,
        codeGeneration: 0.5,
        explanation: 0.5,
        interaction: 0.5,
        assistance: 0.5,
      },
      history: {
        created: new Date(),
        lastUpdated: new Date(),
        updateCount: 0,
        significantChanges: [],
        feedbackHistory: [],
      },
      overrides: [],
    };
  }

  private initializeAdaptationRules(): AdaptationRule[] {
    return [
      {
        id: "negative-feedback-response",
        name: "Adjust on negative feedback",
        description: "Reduce confidence when receiving negative feedback",
        condition: {
          type: "feedback",
          operator: "greater",
          value: "negative",
          threshold: 3,
          window: 60,
        },
        action: {
          type: "decrement",
          target: "confidence.overall",
          value: 0.1,
          gradual: true,
          rate: 0.05,
        },
        priority: 1,
        enabled: true,
      },
      {
        id: "low-engagement-adjustment",
        name: "Adjust for low engagement",
        description: "Modify interaction style when engagement drops",
        condition: {
          type: "metric",
          operator: "less",
          value: "engagementLevel",
          threshold: 0.3,
        },
        action: {
          type: "set",
          target: "interactionStyle.proactivity",
          value: "proactive",
          gradual: false,
        },
        priority: 2,
        enabled: true,
      },
    ];
  }

  private updateConfidence(
    _profile: PreferenceProfile,
    pattern: UserPattern,
  ): void {
    // Update individual confidence scores based on pattern confidence
    const _patternConfidence = pattern.developmentStyle.confidence;

    profile.confidence.responseStyle =
      (profile.confidence.responseStyle + _patternConfidence) / 2;

    profile.confidence.codeGeneration =
      (profile.confidence.codeGeneration + _patternConfidence) / 2;

    // Update overall confidence
    this.updateOverallConfidence(_profile);
  }

  private updateOverallConfidence(_profile: PreferenceProfile): void {
    const _confidences = [
      _profile.confidence.responseStyle,
      _profile.confidence.codeGeneration,
      _profile.confidence.explanation,
      _profile.confidence.interaction,
      profile.confidence.assistance,
    ];

    profile.confidence.overall =
      _confidences.reduce((sum, c) => sum + c, 0) / _confidences.length;
  }

  private recordPreferenceChange(
    _profile: PreferenceProfile,
    category: string,
    reason: string,
  ): void {
    const change: PreferenceChange = {
      timestamp: new Date(),
      category,
      oldValue: null, // Would track actual old value in production
      newValue: null, // Would track actual new value in production
      reason,
      impact: "moderate",
    };

    profile.history.significantChanges.push(change);

    // Keep only recent changes
    if (_profile.history.significantChanges.length > 50) {
      profile.history.significantChanges.shift();
    }
  }

  private decreaseLength(
    _current: string,
  ): "brief" | "moderate" | "detailed" | "comprehensive" {
    const _levels = ["brief", "moderate", "detailed", "comprehensive"];
    const _index = _levels.indexOf(_current);
    return _levels[Math.max(0, _index - 1)] as any;
  }

  private increaseLength(
    _current: string,
  ): "brief" | "moderate" | "detailed" | "comprehensive" {
    const _levels = ["brief", "moderate", "detailed", "comprehensive"];
    const _index = _levels.indexOf(_current);
    return _levels[Math.min(_levels.length - 1, _index + 1)] as any;
  }

  private decreaseDepth(
    _current: string,
  ): "surface" | "intermediate" | "deep" | "expert" {
    const _levels = ["surface", "intermediate", "deep", "expert"];
    const _index = _levels.indexOf(_current);
    return _levels[Math.max(0, _index - 1)] as any;
  }

  private increaseDepth(
    _current: string,
  ): "surface" | "intermediate" | "deep" | "expert" {
    const _levels = ["surface", "intermediate", "deep", "expert"];
    const _index = _levels.indexOf(_current);
    return _levels[Math.min(_levels.length - 1, _index + 1)] as any;
  }

  private decreaseComments(
    _current: string,
  ): "none" | "minimal" | "moderate" | "extensive" {
    const _levels = ["none", "minimal", "moderate", "extensive"];
    const _index = _levels.indexOf(_current);
    return _levels[Math.max(0, _index - 1)] as any;
  }

  private increaseComments(
    _current: string,
  ): "none" | "minimal" | "moderate" | "extensive" {
    const _levels = ["none", "minimal", "moderate", "extensive"];
    const _index = _levels.indexOf(_current);
    return _levels[Math.min(_levels.length - 1, _index + 1)] as any;
  }

  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processUpdateQueue();
    }, 5000); // Process every 5 seconds
  }

  private processUpdateQueue(): void {
    while (this.updateQueue.length > 0) {
      const _update = this.updateQueue.shift();
      if (_update) {
        this.applyUpdate(_update);
      }
    }
  }

  private applyUpdate(_update: PreferenceUpdate): void {
    // Apply preference _update
    this.emit("preferenceUpdate", _update);
  }

  // ========== Public API ==========

  getProfile(userId: string): PreferenceProfile | undefined {
    return this.profiles.get(userId);
  }

  getBehavior(userId: string): AdaptiveBehavior | undefined {
    return this.profiles.get(userId)?.behavior;
  }

  getRecommendations(userId: string): PreferenceRecommendation[] {
    return this.recommendationCache.get(userId) || [];
  }

  getMetrics(userId: string): PreferenceMetrics | undefined {
    return this.metricsCache.get(userId);
  }

  async setOverride(
    _userId: string,
    override: Omit<PreferenceOverride, "id">,
  ): Promise<string> {
    const _profile =
      this.profiles.get(_userId) || this.createDefaultProfile(_userId);

    const overrideWithId: PreferenceOverride = {
      ...override,
      id: `override_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };

    _profile.overrides.push(overrideWithId);

    // Sort by priority
    profile.overrides.sort((a, b) => b.priority - a.priority);

    this.profiles.set(_userId, _profile);

    this.emit("overrideSet", { _userId, override: overrideWithId });

    return overrideWithId.id;
  }

  async removeOverride(_userId: string, overrideId: string): Promise<void> {
    const _profile = this.profiles.get(_userId);
    if (!_profile) {
      return;
    }

    _profile.overrides = _profile.overrides.filter((o) => o.id !== overrideId);

    this.profiles.set(_userId, _profile);

    this.emit("overrideRemoved", { _userId, overrideId });
  }

  async exportProfiles(): Promise<string> {
    return JSON.stringify(
      {
        profiles: Array.from(this.profiles.entries()),
        rules: this.adaptationRules,
        _metrics: Array.from(this.metricsCache.entries()),
        _recommendations: Array.from(this.recommendationCache.entries()),
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  async importProfiles(data: string): Promise<void> {
    const _imported = JSON.parse(data);

    if (_imported.profiles) {
      this.profiles = new Map(_imported.profiles);
    }

    if (_imported.rules) {
      this.adaptationRules = _imported.rules;
    }

    if (_imported.metrics) {
      this.metricsCache = new Map(_imported.metrics);
    }

    if (_imported.recommendations) {
      this.recommendationCache = new Map(_imported.recommendations);
    }

    this.emit("profilesImported", { importedAt: new Date() });
  }

  dispose(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.removeAllListeners();
  }
}

interface PreferenceUpdate {
  userId: string;
  type: string;
  data: unknown;
  timestamp: Date;
}

export default PreferenceEngine;
