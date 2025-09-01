/**
 * Equation solving engine - Gauss-Newton method with numerical stability
 * Implements damped normal equations with convergence monitoring
 */
import type { SolveResult } from "./types.js";
import { evaluate } from "./numeric.js";

const DEFAULT_TOLERANCE = 1e-8;
const MAX_LAMBDA = 1e6;
const MIN_LAMBDA = 1e-9;
const MAX_LINE_SEARCH_ITERS = 10;

/**
 * Solve system of nonlinear equations using damped Gauss-Newton method
 * Implements: (J^T J + λI)δ = -J^T f with adaptive damping
 */
export function solveSystem(
  equations: string[],
  variables: string[],
  options: {
    x0?: number[];
    maxIters?: number;
    tolerance?: number;
    timeLimitMs?: number;
  } = {},
): SolveResult {
  const {
    x0 = new Array(variables.length).fill(1),
    maxIters = 100,
    tolerance = DEFAULT_TOLERANCE,
    timeLimitMs = 5000,
  } = options;

  if (equations.length === 0 || variables.length === 0) {
    throw new Error("Empty equations or variables");
  }

  if (equations.length > 10 || variables.length > 10) {
    throw new Error("Too many equations or variables (max 10 each)");
  }

  if (x0.length !== variables.length) {
    throw new Error("Initial guess x0 length must match variables");
  }

  const warnings: string[] = [];
  const steps: string[] = [];
  const startTime = Date.now();

  const x = [...x0];
  let lambda = MIN_LAMBDA;
  let converged = false;
  let iters = 0;
  let residualNorm = Infinity;

  steps.push(
    `Starting Gauss-Newton with ${variables.length} vars, ${equations.length} equations`,
  );

  try {
    for (iters = 0; iters < maxIters; iters++) {
      // Check timeout
      if (Date.now() - startTime > timeLimitMs) {
        warnings.push("Solver timeout exceeded");
        break;
      }

      // Evaluate residual vector f(x)
      const residuals = evaluateResiduals(equations, variables, x);
      residualNorm = norm(residuals);

      steps.push(`Iter ${iters}: ||f|| = ${residualNorm.toExponential(3)}`);

      // Check convergence
      if (residualNorm < tolerance) {
        converged = true;
        steps.push("Converged: residual norm below tolerance");
        break;
      }

      // Compute Jacobian matrix using finite differences
      const jacobian = computeJacobian(equations, variables, x);

      // Check condition number
      const conditionNumber = estimateConditionNumber(jacobian);
      if (conditionNumber > 1e10) {
        warnings.push(
          `High condition number: ${conditionNumber.toExponential(3)}`,
        );
      }

      // Solve damped normal equations: (J^T J + λI)δ = -J^T f
      let delta: number[] | null = null;
      let dampingAttempts = 0;
      const maxDampingAttempts = 5;

      while (delta === null && dampingAttempts < maxDampingAttempts) {
        try {
          delta = solveDampedNormalEquations(jacobian, residuals, lambda);

          // Check if step is reasonable
          const stepNorm = norm(delta);
          if (stepNorm > 100) {
            warnings.push("Large step detected - increasing damping");
            throw new Error("Step too large");
          }
        } catch (error) {
          // Increase damping and retry
          lambda = Math.min(lambda * 10, MAX_LAMBDA);
          dampingAttempts++;
          steps.push(`Damping increased to λ = ${lambda.toExponential(3)}`);

          if (lambda >= MAX_LAMBDA) {
            warnings.push("Maximum damping reached - solver may not converge");
            break;
          }
        }
      }

      if (delta === null) {
        warnings.push("Failed to compute step - singular system");
        break;
      }

      // Line search for step size
      const alpha = lineSearch(equations, variables, x, delta, residualNorm);
      if (alpha < 0.1) {
        warnings.push("Line search found very small step size");
      }

      // Update solution
      for (let i = 0; i < x.length; i++) {
        x[i] += alpha * delta[i];
      }

      // Adaptive damping adjustment
      const newResiduals = evaluateResiduals(equations, variables, x);
      const newResidualNorm = norm(newResiduals);

      if (newResidualNorm < residualNorm) {
        // Good step - reduce damping
        lambda = Math.max(lambda / 10, MIN_LAMBDA);
      } else {
        // Bad step - increase damping
        lambda = Math.min(lambda * 10, MAX_LAMBDA);
      }

      // Check for stagnation
      if (Math.abs(newResidualNorm - residualNorm) < tolerance * 1e-3) {
        warnings.push("Solver stagnation detected");
        if (iters > 10) break;
      }
    }

    // Final convergence check
    if (!converged && residualNorm < tolerance * 10) {
      converged = true;
      warnings.push("Converged with relaxed tolerance");
    }
  } catch (innerError) {
    throw new Error(`Solver failed: ${(error as Error).message}`);
  }

  // Build solution object
  const solution: Record<string, number> = {};
  for (let i = 0; i < variables.length; i++) {
    solution[variables[i]] = x[i];
  }

  return {
    solution,
    iters,
    converged,
    residualNorm,
    warnings: warnings.length > 0 ? warnings : undefined,
    steps: steps.length > 0 ? steps : undefined,
  };
}

/**
 * Evaluate residual vector f(x) for all equations
 */
function evaluateResiduals(
  equations: string[],
  variables: string[],
  x: number[],
): number[] {
  const context: Record<string, number> = {};
  for (let i = 0; i < variables.length; i++) {
    context[variables[i]] = x[i];
  }

  return equations.map((eq) => {
    try {
      return evaluate(eq, context).value;
    } catch (error) {
      throw new Error(
        `Error evaluating equation "${eq}": ${(error as Error).message}`,
      );
    }
  });
}

/**
 * Compute Jacobian matrix using finite differences
 */
function computeJacobian(
  equations: string[],
  variables: string[],
  x: number[],
): number[][] {
  const m = equations.length;
  const n = variables.length;
  const jacobian: number[][] = Array(m)
    .fill(0)
    .map(() => Array(n).fill(0));

  const f0 = evaluateResiduals(equations, variables, x);

  for (let j = 0; j < n; j++) {
    // Use relative step size for better numerical stability
    const h = 1e-6 * (1 + Math.abs(x[j]));
    const xPerturbed = [...x];
    xPerturbed[j] += h;

    const fPerturbed = evaluateResiduals(equations, variables, xPerturbed);

    // Finite difference approximation
    for (let i = 0; i < m; i++) {
      jacobian[i][j] = (fPerturbed[i] - f0[i]) / h;
    }
  }

  return jacobian;
}

/**
 * Solve damped normal equations: (J^T J + λI)δ = -J^T f
 */
function solveDampedNormalEquations(
  jacobian: number[][],
  residuals: number[],
  lambda: number,
): number[] {
  const m = jacobian.length;
  const n = jacobian[0].length;

  // Compute J^T J + λI
  const JTJ = Array(n)
    .fill(0)
    .map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const _sum = 0;
      for (let k = 0; k < m; k++) {
        _sum += jacobian[k][i] * jacobian[k][j];
      }
      JTJ[i][j] = _sum;
      if (i === j) JTJ[i][j] += lambda; // Add damping
    }
  }

  // Compute -J^T f
  const JTf = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const _sum = 0;
    for (let k = 0; k < m; k++) {
      _sum += jacobian[k][i] * residuals[k];
    }
    JTf[i] = -_sum;
  }

  // Solve using Gauss elimination
  return solveLinearSystem(JTJ, JTf);
}

/**
 * Simple line search for step size optimization
 */
function lineSearch(
  equations: string[],
  variables: string[],
  x: number[],
  delta: number[],
  f0Norm: number,
): number {
  let alpha = 1.0;

  for (let i = 0; i < MAX_LINE_SEARCH_ITERS; i++) {
    const xTest = x.map((xi, j) => xi + alpha * delta[j]);

    try {
      const residuals = evaluateResiduals(equations, variables, xTest);
      const fNorm = norm(residuals);

      // Armijo condition: sufficient decrease
      if (fNorm < f0Norm * (1 - 1e-4 * alpha)) {
        return alpha;
      }
    } catch {
      // Evaluation failed - reduce step size
    }

    alpha *= 0.5;
  }

  return alpha; // Return best found alpha
}

/**
 * Solve linear system Ax = b using Gaussian elimination
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const Ab = A.map((row, i) => [...row, b[i]]);

  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(Ab[k][i]) > Math.abs(Ab[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap rows
    [Ab[i], Ab[maxRow]] = [Ab[maxRow], Ab[i]];

    // Check for singular matrix
    if (Math.abs(Ab[i][i]) < 1e-14) {
      throw new Error("Singular matrix in linear solve");
    }

    // Eliminate column
    for (let k = i + 1; k < n; k++) {
      const factor = Ab[k][i] / Ab[i][i];
      for (let j = i; j < n + 1; j++) {
        Ab[k][j] -= factor * Ab[i][j];
      }
    }
  }

  // Back substitution
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = Ab[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= Ab[i][j] * x[j];
    }
    x[i] /= Ab[i][i];
  }

  return x;
}

/**
 * Estimate condition number (rough approximation)
 */
function estimateConditionNumber(matrix: number[][]): number {
  const n = matrix.length;
  if (n === 0) return Infinity;

  // Simple estimation using diagonal dominance
  let minDiag = Infinity;
  let maxOffDiag = 0;

  for (let i = 0; i < n; i++) {
    if (matrix[i] && matrix[i][i] !== undefined) {
      minDiag = Math.min(minDiag, Math.abs(matrix[i][i]));

      for (let j = 0; j < n; j++) {
        if (i !== j && matrix[i][j] !== undefined) {
          maxOffDiag = Math.max(maxOffDiag, Math.abs(matrix[i][j]));
        }
      }
    }
  }

  if (minDiag === 0) return Infinity;
  return maxOffDiag / minDiag;
}

/**
 * Vector 2-norm
 */
function norm(vector: number[]): number {
  return Math.sqrt(vector.reduce((_sum, x) => _sum + x * x, 0));
}
