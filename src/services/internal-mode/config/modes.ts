/**
 * Internal Mode Configuration - Single Source of Truth (SSoT)
 *
 * UI와 분리된 서버측 모드 정의 (Responses API 준거)
 * Temperature를 사용하지 않고 GPT-5 mini의 reasoning.effort / text.verbosity / allowed_tools로 제어
 */

export type ModeId =
  | "thinking"
  | "ultrathinking"
  | "deepthinking"
  | "researching"
  | "analyzing"
  | "planning"
  | "creating"
  | "brainstorming"
  | "designing"
  | "coding"
  | "implementing"
  | "building"
  | "testing"
  | "debugging"
  | "validating"
  | "optimizing"
  | "refactoring"
  | "reviewing";

export interface ModeSpec {
  id: ModeId;
  label: string; // UI表示名(絵文字含むがUI専用)
  category:
    | "reasoning"
    | "creative"
    | "implementation"
    | "validation"
    | "optimization";
  intensity: "low" | "medium" | "high" | "maximum";

  // Responses API パラメータ(temperatureは使わない)
  reasoning: { effort: "minimal" | "medium" | "high" };
  text: { verbosity: "low" | "medium" | "high" };

  // tool 実行ポリシー(Responses API の allowed_tools にマッピング)
  tools: {
    allowed: Array<
      | { type: "function"; name: string }
      | { type: "web_search" }
      | { type: "mcp"; server_label: string }
    >;
    mode: "auto" | "required";
  };

  // 安全枠
  safety?: {
    jsonOnly?: boolean; // Ultra は基本 JSON
    maxOutputTokens?: number; // 既定: OPENAI_MAX_OUTPUT_TOKENS
    rateKey?: string; // RequestGuard のレートキー
  };

  // 推奨遷移(UI/ルータで活用)
  transitions?: ModeId[];
}

// === 代表値(UIはこれを読んで色・演出を決めるだけ) ===
export const MODES: Record<ModeId, ModeSpec> = {
  thinking: {
    id: "thinking",
    label: "🧠 Thinking...",
    category: "reasoning",
    intensity: "medium",
    reasoning: { effort: "minimal" }, // 속도 우선
    text: { verbosity: "low" },
    tools: { allowed: [], mode: "auto" },
    safety: { jsonOnly: false, rateKey: "mode:thinking" },
    transitions: ["ultrathinking", "researching", "planning"],
  },

  ultrathinking: {
    id: "ultrathinking",
    label: "🧠 Ultra Thinking...",
    category: "reasoning",
    intensity: "high",
    reasoning: { effort: "medium" }, // 깊이 파기(minimal이 아닌 medium)
    text: { verbosity: "medium" }, // 더 설명적
    tools: {
      // 예: math / web_search만 허가. edit계열은 사용하지 않음(ShellAgent는 승인 경유)
      allowed: [
        { type: "function", name: "math_eval" },
        { type: "web_search" },
      ],
      mode: "auto",
    },
    safety: { jsonOnly: true, maxOutputTokens: 4096, rateKey: "mode:ultra" },
    transitions: ["researching", "planning", "analyzing"],
  },

  deepthinking: {
    id: "deepthinking",
    label: "🧠 Deep Thinking...",
    category: "reasoning",
    intensity: "maximum",
    reasoning: { effort: "high" }, // 철저한 추론
    text: { verbosity: "high" },
    tools: { allowed: [{ type: "web_search" }], mode: "auto" },
    safety: { jsonOnly: true, maxOutputTokens: 8192, rateKey: "mode:deep" },
    transitions: ["researching", "planning"],
  },

  researching: {
    id: "researching",
    label: "🧠 Researching...",
    category: "reasoning",
    intensity: "medium",
    reasoning: { effort: "medium" },
    text: { verbosity: "medium" },
    tools: { allowed: [{ type: "web_search" }], mode: "auto" },
    safety: { rateKey: "mode:research" },
    transitions: ["analyzing", "planning"],
  },

  analyzing: {
    id: "analyzing",
    label: "🧠 Analyzing...",
    category: "reasoning",
    intensity: "medium",
    reasoning: { effort: "medium" },
    text: { verbosity: "medium" },
    tools: { allowed: [{ type: "web_search" }], mode: "auto" },
    safety: { rateKey: "mode:analyzing" },
    transitions: ["planning", "optimizing"],
  },

  planning: {
    id: "planning",
    label: "🧠 Planning...",
    category: "optimization",
    intensity: "medium",
    reasoning: { effort: "minimal" },
    text: { verbosity: "low" },
    tools: { allowed: [], mode: "auto" },
    safety: { rateKey: "mode:planning" },
    transitions: ["implementing", "designing"],
  },

  creating: {
    id: "creating",
    label: "🧠 Creating...",
    category: "creative",
    intensity: "high",
    reasoning: { effort: "medium" },
    text: { verbosity: "medium" },
    tools: { allowed: [], mode: "auto" },
    safety: { rateKey: "mode:creating" },
    transitions: ["designing", "brainstorming"],
  },

  brainstorming: {
    id: "brainstorming",
    label: "🧠 Brainstorming...",
    category: "creative",
    intensity: "high",
    reasoning: { effort: "medium" },
    text: { verbosity: "high" },
    tools: { allowed: [], mode: "auto" },
    safety: { rateKey: "mode:brainstorming" },
    transitions: ["creating", "designing"],
  },

  designing: {
    id: "designing",
    label: "🧠 Designing...",
    category: "creative",
    intensity: "medium",
    reasoning: { effort: "medium" },
    text: { verbosity: "medium" },
    tools: { allowed: [], mode: "auto" },
    safety: { rateKey: "mode:designing" },
    transitions: ["implementing", "planning"],
  },

  coding: {
    id: "coding",
    label: "🧠 Coding...",
    category: "implementation",
    intensity: "high",
    reasoning: { effort: "medium" },
    text: { verbosity: "low" },
    tools: { allowed: [], mode: "auto" },
    safety: { rateKey: "mode:coding" },
    transitions: ["testing", "debugging"],
  },

  implementing: {
    id: "implementing",
    label: "🧠 Implementing...",
    category: "implementation",
    intensity: "high",
    reasoning: { effort: "medium" },
    text: { verbosity: "low" },
    tools: { allowed: [], mode: "auto" },
    safety: { rateKey: "mode:implementing" },
    transitions: ["testing", "validating"],
  },

  building: {
    id: "building",
    label: "🧠 Building...",
    category: "implementation",
    intensity: "high",
    reasoning: { effort: "medium" },
    text: { verbosity: "low" },
    tools: { allowed: [], mode: "auto" },
    safety: { rateKey: "mode:building" },
    transitions: ["testing", "validating"],
  },

  testing: {
    id: "testing",
    label: "🧠 Testing...",
    category: "validation",
    intensity: "medium",
    reasoning: { effort: "minimal" },
    text: { verbosity: "low" },
    tools: { allowed: [], mode: "auto" },
    safety: { rateKey: "mode:testing" },
    transitions: ["debugging", "validating"],
  },

  debugging: {
    id: "debugging",
    label: "🧠 Debugging...",
    category: "validation",
    intensity: "high",
    reasoning: { effort: "high" },
    text: { verbosity: "medium" },
    tools: { allowed: [{ type: "web_search" }], mode: "auto" },
    safety: { rateKey: "mode:debugging" },
    transitions: ["testing", "analyzing"],
  },

  validating: {
    id: "validating",
    label: "🧠 Validating...",
    category: "validation",
    intensity: "medium",
    reasoning: { effort: "medium" },
    text: { verbosity: "medium" },
    tools: { allowed: [], mode: "auto" },
    safety: { rateKey: "mode:validating" },
    transitions: ["optimizing", "reviewing"],
  },

  optimizing: {
    id: "optimizing",
    label: "🧠 Optimizing...",
    category: "optimization",
    intensity: "high",
    reasoning: { effort: "high" },
    text: { verbosity: "medium" },
    tools: { allowed: [{ type: "web_search" }], mode: "auto" },
    safety: { rateKey: "mode:optimizing" },
    transitions: ["refactoring", "reviewing"],
  },

  refactoring: {
    id: "refactoring",
    label: "🧠 Refactoring...",
    category: "optimization",
    intensity: "high",
    reasoning: { effort: "high" },
    text: { verbosity: "low" },
    tools: { allowed: [], mode: "auto" },
    safety: { rateKey: "mode:refactoring" },
    transitions: ["testing", "reviewing"],
  },

  reviewing: {
    id: "reviewing",
    label: "🧠 Reviewing...",
    category: "validation",
    intensity: "medium",
    reasoning: { effort: "medium" },
    text: { verbosity: "medium" },
    tools: { allowed: [], mode: "auto" },
    safety: { rateKey: "mode:reviewing" },
    transitions: ["optimizing", "validating"],
  },
};

// UI표시명・구 모드명 → canonical id 매핑(호환)
export const MODE_ALIASES: Record<string, ModeId> = {
  // 기본 레이블 매핑
  "🧠 Thinking...": "thinking",
  "🧠 Ultra Thinking...": "ultrathinking",
  "🧠 Deep Thinking...": "deepthinking",
  "🧠 Researching...": "researching",
  "🧠 Analyzing...": "analyzing",
  "🧠 Planning...": "planning",
  "🧠 Creating...": "creating",
  "🧠 Brainstorming...": "brainstorming",
  "🧠 Designing...": "designing",
  "🧠 Coding...": "coding",
  "🧠 Implementing...": "implementing",
  "🧠 Building...": "building",
  "🧠 Testing...": "testing",
  "🧠 Debugging...": "debugging",
  "🧠 Validating...": "validating",
  "🧠 Optimizing...": "optimizing",
  "🧠 Refactoring...": "refactoring",
  "🧠 Reviewing...": "reviewing",

  // 구 프리픽스 "✽ " 흡수
  "✽ Thinking...": "thinking",
  "✽ Ultra Thinking...": "ultrathinking",
  "✽ Deep Thinking...": "deepthinking",
  "✽ Researching...": "researching",
  "✽ Analyzing...": "analyzing",
  "✽ Planning...": "planning",
  "✽ Creating...": "creating",
  "✽ Brainstorming...": "brainstorming",
  "✽ Designing...": "designing",
  "✽ Coding...": "coding",
  "✽ Implementing...": "implementing",
  "✽ Building...": "building",
  "✽ Testing...": "testing",
  "✽ Debugging...": "debugging",
  "✽ Validating...": "validating",
  "✽ Optimizing...": "optimizing",
  "✽ Refactoring...": "refactoring",
  "✽ Reviewing...": "reviewing",

  // 소문자화 흡수
  "ultra thinking": "ultrathinking",
  "deep thinking": "deepthinking",
  thinking: "thinking",
  researching: "researching",
  analyzing: "analyzing",
  planning: "planning",
  creating: "creating",
  brainstorming: "brainstorming",
  designing: "designing",
  coding: "coding",
  implementing: "implementing",
  building: "building",
  testing: "testing",
  debugging: "debugging",
  validating: "validating",
  optimizing: "optimizing",
  refactoring: "refactoring",
  reviewing: "reviewing",
};
