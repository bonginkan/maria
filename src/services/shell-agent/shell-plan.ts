// src/services/shell-agent/shell-plan.ts
import * as z from "zod";

/** Shell Intent Classification */
export const _ShellIntentZ = z.enum(["read", "search", "edit", "other"]);
export type ShellIntent = z.infer<typeof _ShellIntentZ>;

/** Individual execution step */
export const _ShellStepZ = z.object({
  op: z.enum(["read", "search", "patch", "exec"]),
  /** Semantic arguments (not shell commands)
   *  read:  [targetPath]
   *  search:[pattern, targetPath]
   *  patch: [targetPath, diffSpec]
   *  exec:  forbidden in read-only mode
   */
  args: z.array(z.string()).min(1),
  comment: z.string().optional(),
  previewLimit: z.number().int().positive().max(100_000).optional(), // max 100KB per step
});

/** Patch specification for edit operations */
export const _PatchSpecZ = z.object({
  type: z.enum(["unified", "structured"]),
  target: z.string().min(1),
  diff: z.string().optional(),
  edits: z
    .array(z.object({ find: z.string(), replace: z.string() }))
    .optional(),
});

/** Safety constraints */
export const _SafetyZ = z.object({
  readOnly: z.boolean().default(true),
  allowPaths: z.array(z.string()).default(["src/**", "README.md"]),
  denyPaths: z
    .array(z.string())
    .default([".git/**", "node_modules/**", "~/**", "/**"]),
  timeLimitMs: z.number().int().positive().max(60_000).default(10_000),
  sizeLimitBytes: z.number().int().positive().max(5_000_000).default(1_000_000), // 1MB
});

/** Complete execution plan */
export const _ShellPlanZ = z
  .object({
    intent: _ShellIntentZ,
    steps: z.array(_ShellStepZ).min(1),
    patches: z.array(_PatchSpecZ).optional(),
    safety: _SafetyZ,
    approvalsRequired: z.boolean().optional(),
  })
  .superRefine((plan, ctx) => {
    // Multi-layer validation
    if (plan.steps.length > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "too many steps (max 5)",
      });
    }

    const totalPreview = plan.steps.reduce(
      (s, x) => s + (x.previewLimit ?? 0),
      0,
    );
    if (totalPreview > 50_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "total preview budget exceeded (max 50KB)",
      });
    }

    // Read-only enforcement
    if (plan.safety.readOnly) {
      if (plan.steps.some((s) => s.op === "exec" || s.op === "patch")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "mutating step under readOnly=true",
        });
      }
    }

    if (plan.safety.readOnly && plan.patches?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "patches not allowed under readOnly=true",
      });
    }
  });

export type ShellStep = z.infer<typeof _ShellStepZ>;
export type PatchSpec = z.infer<typeof _PatchSpecZ>;
export type ShellPlan = z.infer<typeof _ShellPlanZ>;
export type Safety = z.infer<typeof _SafetyZ>;

/** Shell step execution result */
export interface ShellStepResult {
  step: ShellStep;
  success: boolean;
  output?: string;
  error?: string;
  executionTimeMs: number;
  outputSizeBytes: number;
  filesRead?: number;
}

/** Natural language request */
export const _NLRequestZ = z.object({
  text: z.string().min(1),
  cwd: z.string().optional(),
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  dryRun: z.boolean().optional(),
  enableEdit: z.boolean().optional(), // Phase B: Allow patch operations
  autoApprove: z.boolean().optional(), // Phase B: Skip interactive approval
});
export type NLRequest = z.infer<typeof _NLRequestZ>;

/** Extended validation options */
type ExtraValidateOpts = {
  workspaceRoot: string;
  allowOps?: Array<ShellStep["op"]>;
};

const DEFAULT_ALLOW_OPS: Array<ShellStep["op"]> = ["read", "search"];

/** Shell metacharacter detection */
const SHELL_META = /[;&|><`$]/;

/** Forbidden command tokens */
const FORBIDDEN_TOKENS = /\b(rm|sudo|curl|wget|scp|ssh)\b/i;

/** Enhanced plan validation with security checks */
export function validatePlan(
  planInput: unknown,
  opts: ExtraValidateOpts,
): ShellPlan {
  const parsed = _ShellPlanZ.parse(planInput);
  const allowOps = opts.allowOps ?? DEFAULT_ALLOW_OPS;

  // Operation permission check
  for (const s of parsed.steps) {
    if (!allowOps.includes(s.op)) {
      throw new Error(`operation "${s.op}" is not allowed in this stage`);
    }

    // Metacharacter guard
    for (const a of s.args) {
      if (SHELL_META.test(a)) {
        throw new Error(`shell metacharacters not allowed in args: "${a}"`);
      }
    }
  }

  // Forbidden token detection
  assertSafeTokensInPlan(parsed);

  // Path configuration validation
  if (parsed.safety.allowPaths.length === 0) {
    throw new Error("safety.allowPaths must not be empty");
  }

  return parsed;
}

/** Forbidden token detection in plan */
export function assertSafeTokensInPlan(plan: ShellPlan): void {
  const all = JSON.stringify(plan);
  if (FORBIDDEN_TOKENS.test(all)) {
    throw new Error("forbidden tokens detected in plan");
  }
}

// Security constants
export const SECURITY_LIMITS = {
  MAX_STEPS: 5,
  MAX_ARGS_PER_STEP: 4,
  MAX_ARG_LENGTH: 200,
  MAX_FILE_MATCHES: 2000,
  MAX_PREVIEW_SIZE: 50000, // 50KB
  MAX_EXECUTION_TIME: 10000, // 10 seconds
  MAX_TOTAL_SIZE: 5000000, // 5MB
} as const;

/**
 * Create a safe plan with validation
 */
export function createSafePlan(
  intent: ShellIntent,
  steps: ShellStep[],
  safetyOverrides?: Partial<Safety>,
): ShellPlan {
  const defaultSafety: Safety = {
    readOnly: true,
    allowPaths: ["src/**", "README.md", "package.json", "tsconfig.json"],
    denyPaths: [".git/**", "node_modules/**", "~/**", "/**"],
    timeLimitMs: 10_000,
    sizeLimitBytes: 1_000_000,
  };

  const safety = { ...defaultSafety, ...safetyOverrides };

  const plan: ShellPlan = {
    intent,
    steps,
    safety,
    approvalsRequired: intent === "edit" && safety.readOnly === false,
  };

  return _ShellPlanZ.parse(plan);
}
