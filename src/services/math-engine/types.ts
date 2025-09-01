import * as z from "zod";

// Core request/response types with strict validation
export const CalcRequestZ = z.object({
  expr: z.string().min(1).max(5000),
  vars: z.record(z.number()).default({}),
  units: z.object({ unit: z.string().optional() }).optional(),
  seed: z.number().int().optional(),
  maxSteps: z.number().int().max(1_000).default(200),
});

export const SolveRequestZ = z.object({
  equations: z.array(z.string().min(1)).min(1).max(10),
  vars: z.array(z.string()).min(1).max(10),
  method: z.enum(["symbolic", "numeric"]).default("numeric"),
  seed: z.number().int().optional(),
  maxIters: z.number().int().max(1_000).default(100),
  x0: z.array(z.number()).optional(),
  tol: z.number().min(1e-12).max(1e-3).default(1e-8),
});

export const PlotRequestZ = z.object({
  expr: z.string().min(1),
  xrange: z.tuple([z.number(), z.number()]),
  samples: z.number().int().min(2).max(2000).default(80),
  vars: z.record(z.number()).default({}),
  clampY: z.tuple([z.number(), z.number()]).optional(),
});

export const ExplainJsonZ = z.object({
  high_level: z.string(),
  steps: z.array(z.string()),
  checks: z.array(z.string()).optional(),
  caveats: z.array(z.string()).optional(),
});

// Inferred types
export type CalcRequest = z.infer<typeof CalcRequestZ>;
export type SolveRequest = z.infer<typeof SolveRequestZ>;
export type PlotRequest = z.infer<typeof PlotRequestZ>;
export type ExplainJson = z.infer<typeof ExplainJsonZ>;

// Core mathematical types
export type NumericEvalResult = {
  value: number;
  warnings?: string[];
  steps?: string[];
  units?: string;
};

export type SolveResult = {
  solution: Record<string, number>;
  iters: number;
  converged: boolean;
  residualNorm: number;
  warnings?: string[];
  steps?: string[];
};

// Token types for parser
export type Token =
  | { t: "num"; v: number }
  | { t: "name"; v: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "^" }
  | { t: "lpar" }
  | { t: "rpar" }
  | { t: "comma" };

// AST node types for symbolic manipulation
export type ASTNode =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "un"; op: "+" | "-"; x: ASTNode }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "^"; l: ASTNode; r: ASTNode }
  | { k: "fun"; name: string; x: ASTNode };

// Plot data types
export type Sample = { x: number; y: number | undefined };
export type Series = Sample[];
