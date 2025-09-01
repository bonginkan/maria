/**
 * Unified Calc Command - Safe mathematical expression evaluation
 * Integrates with math-engine for eval-free computation
 */

import chalk from "chalk";
import {
  CalcRequestZ,
  type CalcRequest,
} from "../../services/math-engine/types.js";
import { evaluate } from "../../services/math-engine/numeric.js";

export async function handler(...args: string[]): Promise<void> {
  try {
    const expression = args.join(" ").trim();

    if (!expression) {
      showUsage();
      return;
    }

    // Parse variables from args (--vars x=1 y=2 format)
    const variables: Record<string, number> = {};
    const varIndex = args.indexOf("--vars");

    if (varIndex !== -1 && varIndex + 1 < args.length) {
      const varString = args.slice(varIndex + 1).join(" ");
      parseVariables(varString, variables);
    }

    // Clean expression (remove --vars and following arguments)
    let cleanExpr = expression;
    if (varIndex !== -1) {
      cleanExpr = args.slice(0, varIndex).join(" ").trim();
    }

    // Validate request
    const request: CalcRequest = CalcRequestZ.parse({
      expr: cleanExpr,
      vars: variables,
    });

    console.log(chalk.blue(`\n🧮 Evaluating: ${chalk.cyan(request.expr)}`));

    if (Object.keys(request.vars).length > 0) {
      const varStr = Object.entries(request.vars)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      console.log(chalk.gray(`Variables: ${varStr}`));
    }

    // Evaluate expression
    const result = evaluate(request.expr, request.vars, request.maxSteps);

    // Display result
    console.log(chalk.green(`\n= ${result.value}`));

    if (result.units) {
      console.log(chalk.gray(`Units: ${result.units}`));
    }

    // Show warnings if any
    if (result.warnings && result.warnings.length > 0) {
      console.log(chalk.yellow("\n⚠️ Warnings:"));
      result.warnings.forEach((warning) => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }

    // Show steps in verbose mode
    if (args.includes("--verbose") && result.steps) {
      console.log(chalk.gray("\n📋 Steps:"));
      result.steps.forEach((step, i) => {
        console.log(chalk.gray(`  ${i + 1}. ${step}`));
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      // Zod validation errors
      if (error.message.includes("validation")) {
        console.error(chalk.red("❌ Invalid input:"), error.message);
        showUsage();
      } else {
        console.error(chalk.red("❌ Calculation error:"), error.message);
      }
    } else {
      console.error(chalk.red("❌ Unexpected error:"), String(error));
    }

    process.exitCode = 1;
  }
}

function parseVariables(
  varString: string,
  variables: Record<string, number>,
): void {
  // Parse format: x=1 y=2.5 z=-3
  const assignments = varString.split(/\s+/);

  for (const assignment of assignments) {
    const match = assignment.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(-?\d+(?:\.\d+)?)$/,
    );

    if (match) {
      const [, name, valueStr] = match;
      const value = parseFloat(valueStr);

      if (Number.isFinite(value)) {
        variables[name] = value;
      } else {
        throw new Error(`Invalid variable value: ${name}=${valueStr}`);
      }
    } else if (assignment.includes("=")) {
      throw new Error(`Invalid variable assignment: ${assignment}`);
    }
  }
}

function showUsage(): void {
  console.log(
    chalk.cyan(
      "\n📖 Usage: /calc <expression> [--vars <assignments>] [--verbose]",
    ),
  );
  console.log(chalk.gray("\nExamples:"));
  console.log(chalk.gray('  /calc "2 + 3 * 4"'));
  console.log(chalk.gray('  /calc "sin(pi/4) + cos(pi/4)"'));
  console.log(chalk.gray('  /calc "sqrt(x^2 + y^2)" --vars x=3 y=4'));
  console.log(chalk.gray('  /calc "exp(x)" --vars x=2 --verbose'));

  console.log(chalk.gray("\nSupported:"));
  console.log(chalk.gray("  • Operators: +, -, *, /, ^"));
  console.log(chalk.gray("  • Functions: sin, cos, tan, exp, log, sqrt, abs"));
  console.log(chalk.gray("  • Constants: pi, e"));
  console.log(chalk.gray("  • Variables: Use --vars flag"));

  console.log(chalk.gray("\nLimits:"));
  console.log(chalk.gray("  • Expression length: 5000 characters"));
  console.log(chalk.gray("  • Evaluation steps: 1000"));
}
