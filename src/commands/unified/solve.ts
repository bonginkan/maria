/**
 * Unified Solve Command - Nonlinear equation system solver
 * Integrates with math-engine for Gauss-Newton solving
 */

import chalk from "chalk";
import {
  SolveRequestZ,
  type SolveRequest,
} from "../../services/math-engine/types.js";
import { solveSystem } from "../../services/math-engine/solve.js";

export async function handler(...args: string[]): Promise<void> {
  try {
    if (args.length === 0) {
      showUsage();
      return;
    }

    // Parse arguments
    const equations: string[] = [];
    const variables: string[] = [];
    let initialGuess: number[] = [];
    let method: "numeric" | "symbolic" = "numeric";

    // Parse equations (quoted strings)
    const eqMatches = args.join(" ").match(/"([^"]+)"/g);
    if (eqMatches) {
      equations.push(...eqMatches.map((eq) => eq.slice(1, -1)));
    }

    // Parse variables (--vars x y z)
    const varsIndex = args.indexOf("--vars");
    if (varsIndex !== -1 && varsIndex + 1 < args.length) {
      let i = varsIndex + 1;
      while (i < args.length && !args[i].startsWith("--")) {
        variables.push(args[i]);
        i++;
      }
    }

    // Parse initial guess (--x0 1 2 3)
    const x0Index = args.indexOf("--x0");
    if (x0Index !== -1 && x0Index + 1 < args.length) {
      let i = x0Index + 1;
      while (i < args.length && !args[i].startsWith("--")) {
        const value = parseFloat(args[i]);
        if (Number.isFinite(value)) {
          initialGuess.push(value);
        }
        i++;
      }
    }

    // Parse method (--method symbolic|numeric)
    const methodIndex = args.indexOf("--method");
    if (methodIndex !== -1 && methodIndex + 1 < args.length) {
      const methodArg = args[methodIndex + 1];
      if (methodArg === "symbolic" || methodArg === "numeric") {
        method = methodArg;
      }
    }

    // Validate input
    if (equations.length === 0) {
      console.error(
        chalk.red(
          '❌ No equations found. Use quoted strings like "x^2 + y - 5"',
        ),
      );
      showUsage();
      return;
    }

    if (variables.length === 0) {
      console.error(chalk.red("❌ No variables specified. Use --vars x y z"));
      showUsage();
      return;
    }

    // Set default initial guess if not provided
    if (initialGuess.length === 0) {
      initialGuess = new Array(variables.length).fill(1);
    } else if (initialGuess.length !== variables.length) {
      console.error(
        chalk.red(
          `❌ Initial guess length (${initialGuess.length}) must match variables (${variables.length})`,
        ),
      );
      return;
    }

    // Build request
    const request: SolveRequest = SolveRequestZ.parse({
      equations,
      vars: variables,
      method,
      x0: initialGuess,
    });

    // Display problem
    console.log(chalk.blue("\n🔧 Solving system:"));
    request.equations.forEach((eq, i) => {
      console.log(chalk.cyan(`  ${i + 1}. ${eq} = 0`));
    });

    console.log(chalk.gray(`Variables: ${request.vars.join(", ")}`));
    console.log(chalk.gray(`Initial guess: [${request.x0?.join(", ")}]`));
    console.log(chalk.gray(`Method: ${request.method}`));

    // Solve system
    console.log(chalk.gray("\n⏳ Solving..."));
    const result = solveSystem(request.equations, request.vars, {
      x0: request.x0,
      maxIters: request.maxIters,
      tolerance: request.tol,
    });

    // Display results
    console.log(chalk.green("\n✅ Solution:"));
    Object.entries(result.solution).forEach(([variable, value]) => {
      console.log(chalk.green(`  ${variable} = ${value.toFixed(8)}`));
    });

    // Show convergence info
    console.log(chalk.blue(`\n📊 Convergence:`));
    console.log(chalk.gray(`  Iterations: ${result.iters}`));
    console.log(chalk.gray(`  Converged: ${result.converged ? "✅" : "❌"}`));
    console.log(
      chalk.gray(`  Residual norm: ${result.residualNorm.toExponential(3)}`),
    );

    // Show warnings
    if (result.warnings && result.warnings.length > 0) {
      console.log(chalk.yellow("\n⚠️ Warnings:"));
      result.warnings.forEach((warning) => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }

    // Show steps in verbose mode
    if (args.includes("--verbose") && result.steps) {
      console.log(chalk.gray("\n📋 Solver steps:"));
      result.steps.forEach((step) => {
        console.log(chalk.gray(`  ${step}`));
      });
    }

    // Verification
    if (args.includes("--verify")) {
      console.log(chalk.blue("\n🔍 Verification:"));
      await verifysolution(request.equations, request.vars, result.solution);
    }

    if (!result.converged) {
      process.exitCode = 1;
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("validation")) {
        console.error(chalk.red("❌ Invalid input:"), error.message);
        showUsage();
      } else {
        console.error(chalk.red("❌ Solver error:"), error.message);
      }
    } else {
      console.error(chalk.red("❌ Unexpected error:"), String(error));
    }

    process.exitCode = 1;
  }
}

async function _verifyolution(
  equations: string[],
  _variables: string[],
  solution: Record<string, number>,
): Promise<void> {
  const { evaluate } = await import("../../services/math-engine/numeric.js");

  equations.forEach((equation, i) => {
    try {
      const result = evaluate(equation, solution);
      const residual = result.value;
      const status = Math.abs(residual) < 1e-6 ? "✅" : "❌";

      console.log(
        chalk.gray(`  Eq ${i + 1}: f = ${residual.toExponential(3)} ${status}`),
      );
    } catch (innerError) {
      console.log(
        chalk.red(`  Eq ${i + 1}: Error - ${(error as Error).message}`),
      );
    }
  });
}

function showUsage(): void {
  console.log(
    chalk.cyan(
      '\n📖 Usage: /solve "<eq1>" "<eq2>" --vars <variables> [options]',
    ),
  );
  console.log(chalk.gray("\nExamples:"));
  console.log(chalk.gray('  /solve "x^2 + y^2 - 25" "x + y - 7" --vars x y'));
  console.log(chalk.gray('  /solve "sin(x) - 0.5" --vars x --x0 0.5'));
  console.log(
    chalk.gray('  /solve "x^2 - 4" "y - x - 1" --vars x y --x0 2 3 --verify'),
  );

  console.log(chalk.gray("\nOptions:"));
  console.log(chalk.gray("  --vars <var1> <var2>  Variables to solve for"));
  console.log(
    chalk.gray("  --x0 <val1> <val2>    Initial guess (default: all 1s)"),
  );
  console.log(
    chalk.gray("  --method numeric      Solution method (numeric only)"),
  );
  console.log(
    chalk.gray("  --verify              Verify solution by substitution"),
  );
  console.log(chalk.gray("  --verbose             Show solver steps"));

  console.log(chalk.gray("\nLimits:"));
  console.log(chalk.gray("  • Max equations: 10"));
  console.log(chalk.gray("  • Max variables: 10"));
  console.log(chalk.gray("  • Max iterations: 1000"));
  console.log(chalk.gray("  • Convergence tolerance: 1e-8"));
}
