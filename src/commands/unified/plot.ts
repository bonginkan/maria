/**
 * Unified Plot Command - Mathematical function visualization
 * Integrates with math-engine for ASCII and SVG plotting
 */

import chalk from "chalk";
import * as fs from "node:fs/promises";
import {
  PlotRequestZ,
  type PlotRequest,
} from "../../services/math-engine/types.js";
import { plot } from "../../services/math-engine/plot.js";

export async function handler(...args: string[]): Promise<void> {
  try {
    const expression = args.find((arg) => !arg.startsWith("--"));

    if (!expression) {
      showUsage();
      return;
    }

    // Parse options
    let xRange: [number, number] = [-10, 10];
    let samples = 80;
    let outputFile: string | undefined;
    let format: "ascii" | "svg" = "ascii";
    const variables: Record<string, number> = {};
    let yClamp: [number, number] | undefined;

    // Parse --range -5 5
    const rangeIndex = args.indexOf("--range");
    if (rangeIndex !== -1 && rangeIndex + 2 < args.length) {
      const min = parseFloat(args[rangeIndex + 1]);
      const max = parseFloat(args[rangeIndex + 2]);
      if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
        xRange = [min, max];
      }
    }

    // Parse --samples 200
    const samplesIndex = args.indexOf("--samples");
    if (samplesIndex !== -1 && samplesIndex + 1 < args.length) {
      const s = parseInt(args[samplesIndex + 1], 10);
      if (s > 0 && s <= 2000) {
        samples = s;
      }
    }

    // Parse --svg output.svg
    const svgIndex = args.indexOf("--svg");
    if (svgIndex !== -1) {
      format = "svg";
      if (svgIndex + 1 < args.length && !args[svgIndex + 1].startsWith("--")) {
        outputFile = args[svgIndex + 1];
      } else {
        outputFile = "plot.svg";
      }
    }

    // Parse --vars x=1 y=2
    const varsIndex = args.indexOf("--vars");
    if (varsIndex !== -1 && varsIndex + 1 < args.length) {
      const varString = args
        .slice(varsIndex + 1)
        .filter((arg) => !arg.startsWith("--"))
        .join(" ");
      parseVariables(varString, variables);
    }

    // Parse --clamp -10 10
    const clampIndex = args.indexOf("--clamp");
    if (clampIndex !== -1 && clampIndex + 2 < args.length) {
      const min = parseFloat(args[clampIndex + 1]);
      const max = parseFloat(args[clampIndex + 2]);
      if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
        yClamp = [min, max];
      }
    }

    // Build request
    const request: PlotRequest = PlotRequestZ.parse({
      expr: expression,
      xrange: xRange,
      samples,
      vars: variables,
      clampY: yClamp,
    });

    console.log(chalk.blue(`\n📊 Plotting: ${chalk.cyan(request.expr)}`));
    console.log(chalk.gray(`Range: x ∈ [${xRange[0]}, ${xRange[1]}]`));
    console.log(chalk.gray(`Samples: ${samples}`));

    if (Object.keys(variables).length > 0) {
      const varStr = Object.entries(variables)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      console.log(chalk.gray(`Variables: ${varStr}`));
    }

    // Generate plot
    console.log(chalk.gray("\n⏳ Generating plot..."));
    const result = plot(request, format);

    // Display or save result
    if (format === "ascii") {
      console.log(chalk.green("\n📈 Plot:"));
      console.log(result.ascii);
    } else if (format === "svg" && outputFile) {
      await fs.writeFile(outputFile, result.svg!, "utf8");
      console.log(chalk.green(`\n✅ SVG saved: ${outputFile}`));
    }

    // Show plot statistics
    const validPoints = result.data.filter((p) => p.y !== undefined).length;
    const invalidPoints = result.data.length - validPoints;

    console.log(chalk.blue("\n📊 Statistics:"));
    console.log(
      chalk.gray(`  Valid points: ${validPoints}/${result.data.length}`),
    );
    if (invalidPoints > 0) {
      console.log(
        chalk.gray(`  Invalid points: ${invalidPoints} (NaN/Infinity)`),
      );
    }
    console.log(
      chalk.gray(
        `  Y range: [${result.bounds.ymin.toFixed(3)}, ${result.bounds.ymax.toFixed(3)}]`,
      ),
    );

    // Show warnings
    if (result.warnings && result.warnings.length > 0) {
      console.log(chalk.yellow("\n⚠️ Warnings:"));
      result.warnings.forEach((warning) => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }

    // Show data in verbose mode
    if (args.includes("--verbose")) {
      console.log(chalk.gray("\n📋 Sample data (first 10):"));
      result.data.slice(0, 10).forEach(({ x, y }) => {
        const yStr = y !== undefined ? y.toFixed(6) : "undefined";
        console.log(chalk.gray(`  x=${x.toFixed(3)}, y=${yStr}`));
      });
      if (result.data.length > 10) {
        console.log(
          chalk.gray(`  ... and ${result.data.length - 10} more points`),
        );
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("validation")) {
        console.error(chalk.red("❌ Invalid input:"), error.message);
        showUsage();
      } else {
        console.error(chalk.red("❌ Plot error:"), error.message);
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
  const assignments = varString.split(/\s+/).filter((s) => s.length > 0);

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
  console.log(chalk.cyan("\n📖 Usage: /plot <expression> [options]"));
  console.log(chalk.gray("\nExamples:"));
  console.log(chalk.gray('  /plot "sin(x)"'));
  console.log(chalk.gray('  /plot "x^2 - 4*x + 3" --range -2 6'));
  console.log(chalk.gray('  /plot "exp(-x^2)" --range -3 3 --samples 200'));
  console.log(chalk.gray('  /plot "sin(a*x)" --vars a=2 --svg sine_wave.svg'));
  console.log(chalk.gray('  /plot "1/x" --range -5 5 --clamp -10 10'));

  console.log(chalk.gray("\nOptions:"));
  console.log(
    chalk.gray("  --range <min> <max>   X-axis range (default: -10 10)"),
  );
  console.log(
    chalk.gray("  --samples <n>         Number of sample points (default: 80)"),
  );
  console.log(chalk.gray("  --vars <assignments>  Variables (e.g. a=2 b=3)"));
  console.log(chalk.gray("  --clamp <min> <max>   Clamp Y values to range"));
  console.log(
    chalk.gray("  --svg [file]          Export as SVG (default: plot.svg)"),
  );
  console.log(chalk.gray("  --verbose             Show sample data"));

  console.log(chalk.gray("\nSupported functions:"));
  console.log(chalk.gray("  • Trigonometric: sin, cos, tan"));
  console.log(chalk.gray("  • Exponential: exp, log"));
  console.log(chalk.gray("  • Other: sqrt, abs"));
  console.log(chalk.gray("  • Constants: pi, e"));

  console.log(chalk.gray("\nLimits:"));
  console.log(chalk.gray("  • Max samples: 2000"));
  console.log(chalk.gray("  • Expression length: 5000 characters"));
}
