/**
 * JUnit XML Reporter
 * Converts ValidateGate reports to JUnit XML format for CI integration
 */

import * as fs from "fs/promises";
import * as path from "path";
import type {
  GateReport,
  ErrorFingerprint,
  StageResult,
} from "../code-quality/types";

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\x00-\x1F\x7F]/g, ""); // Remove control characters
}

/**
 * Format duration for XML (seconds with 3 decimal places)
 */
function formatDuration(ms: number): string {
  return (ms / 1000).toFixed(3);
}

/**
 * Generate test case name from error
 */
function getTestCaseName(error: ErrorFingerprint): string {
  if (error.ruleId) {
    return `${error.source}:${error.ruleId}`;
  }
  if (error.code) {
    return `${error.source}:${error.code}`;
  }
  // Fallback to truncated message
  const msg = error.message.replace(/[^a-zA-Z0-9_\- ]/g, "").slice(0, 50);
  return `${error.source}:${msg}`;
}

/**
 * Generate test suite name from stage
 */
function getTestSuiteName(stageName: string): string {
  const suiteNames: Record<string, string> = {
    format: "Code Formatting (Prettier)",
    eslint: "ESLint Validation",
    typecheck: "TypeScript Compilation",
    test: "Test Execution",
    build: "Build Process",
    security: "Security Scanning",
  };
  return suiteNames[stageName] || stageName;
}

/**
 * Convert ErrorFingerprint to JUnit test case XML
 */
function errorToTestCase(
  error: ErrorFingerprint,
  className: string,
  time = "0.000",
): string {
  const name = escapeXml(getTestCaseName(error));
  const message = escapeXml(error.message);

  let fileInfo = "";
  if (error.file) {
    fileInfo = ` file="${escapeXml(error.file)}"`;
    if (error.line) {
      fileInfo += ` line="${error.line}"`;
      if (error.column) {
        fileInfo += ` column="${error.column}"`;
      }
    }
  }

  const details = error.raw ? escapeXml(error.raw) : message;

  // Stack trace for runtime errors
  const stackTrace =
    error.stack && error.stack.length > 0
      ? "\n" + error.stack.map(escapeXml).join("\n")
      : "";

  return `    <testcase classname="${className}" name="${name}" time="${time}">
      <failure message="${message}" type="${error.source}"${fileInfo}>
${details}${stackTrace}
      </failure>
    </testcase>`;
}

/**
 * Convert warning to skipped test case
 */
function warningToSkippedCase(
  warning: ErrorFingerprint,
  className: string,
  time = "0.000",
): string {
  const name = escapeXml(getTestCaseName(warning));
  const message = escapeXml(warning.message);

  return `    <testcase classname="${className}" name="${name}" time="${time}">
      <skipped message="${message}"/>
    </testcase>`;
}

/**
 * Convert successful check to passed test case
 */
function successToTestCase(
  name: string,
  className: string,
  time: string,
): string {
  return `    <testcase classname="${className}" name="${escapeXml(name)}" time="${time}"/>`;
}

/**
 * Convert StageResult to test suite XML
 */
function stageToTestSuite(stageName: string, stage: StageResult): string {
  const suiteName = getTestSuiteName(stageName);
  const className = `maria.validate.${stageName}`;
  const time = formatDuration(stage.tookMs);

  const errors = stage.errors || [];
  const warnings = stage.warnings || [];

  // Calculate counts
  const tests = Math.max(1, errors.length + warnings.length);
  const failures = errors.length;
  const skipped = stage.skipped ? tests : warnings.length;

  let testCases = "";

  if (stage.skipped) {
    // Entire stage was skipped
    testCases = `    <testcase classname="${className}" name="${suiteName}" time="${time}">
      <skipped message="${escapeXml(stage.skipReason || "Stage skipped")}"/>
    </testcase>`;
  } else if (errors.length === 0 && warnings.length === 0) {
    // Stage passed successfully
    testCases = successToTestCase(`${suiteName} Validation`, className, time);
  } else {
    // Add failure cases
    testCases = errors
      .map((e) => errorToTestCase(e, className, "0.000"))
      .join("\n");

    // Add warning cases as skipped
    if (warnings.length > 0) {
      testCases +=
        "\n" +
        warnings
          .map((w) => warningToSkippedCase(w, className, "0.000"))
          .join("\n");
    }
  }

  return `  <testsuite name="${escapeXml(suiteName)}" tests="${tests}" failures="${failures}" errors="0" skipped="${skipped}" time="${time}" timestamp="${new Date().toISOString()}">
${testCases}
  </testsuite>`;
}

/**
 * Convert GateReport to JUnit XML
 */
export function toJUnitXml(report: GateReport): string {
  const testSuites: string[] = [];
  let totalTests = 0;
  let totalFailures = 0;
  let totalSkipped = 0;

  // Process each stage
  for (const [stageName, stageResult] of Object.entries(report.stages)) {
    if (stageResult) {
      const suite = stageToTestSuite(stageName, stageResult);
      testSuites.push(suite);

      // Update totals
      const errors = stageResult.errors?.length || 0;
      const warnings = stageResult.warnings?.length || 0;
      totalTests += Math.max(1, errors + warnings);
      totalFailures += errors;
      if (stageResult.skipped) {
        totalSkipped += Math.max(1, errors + warnings);
      } else {
        totalSkipped += warnings;
      }
    }
  }

  // If no stages, create a summary suite
  if (testSuites.length === 0) {
    const summaryTests = report.errors.length + report.warnings.length;
    testSuites.push(`  <testsuite name="Validation Summary" tests="${summaryTests}" failures="${report.errors.length}" errors="0" skipped="${report.warnings.length}" time="${formatDuration(report.durationMs)}">
${report.errors.map((e) => errorToTestCase(e, "maria.validate", "0.000")).join("\n")}
${report.warnings.map((w) => warningToSkippedCase(w, "maria.validate", "0.000")).join("\n")}
  </testsuite>`);

    totalTests = summaryTests;
    totalFailures = report.errors.length;
    totalSkipped = report.warnings.length;
  }

  // Build complete XML document
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="MARIA Code Validation" tests="${totalTests}" failures="${totalFailures}" errors="0" skipped="${totalSkipped}" time="${formatDuration(report.durationMs)}">
${testSuites.join("\n")}
</testsuites>`;
}

/**
 * Write JUnit XML report to file
 */
export async function writeJUnit(
  report: GateReport,
  options: {
    outputDir?: string;
    filename?: string;
  } = {},
): Promise<string> {
  const outputDir = options.outputDir || path.join(process.cwd(), "reports");
  const filename = options.filename || `validate_${Date.now()}.junit.xml`;

  // Ensure directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Generate XML
  const xml = toJUnitXml(report);

  // Write to file
  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, xml, "utf8");

  return filepath;
}

/**
 * Create a simple JUnit report from a single test result
 */
export function createSimpleJUnitReport(opts: {
  name: string;
  passed: boolean;
  duration?: number;
  error?: string;
  output?: string;
}): string {
  const time = formatDuration(opts.duration || 0);
  const testCase = opts.passed
    ? `    <testcase name="${escapeXml(opts.name)}" classname="maria.test" time="${time}"/>`
    : `    <testcase name="${escapeXml(opts.name)}" classname="maria.test" time="${time}">
      <failure message="${escapeXml(opts.error || "Test failed")}" type="AssertionError">
${escapeXml(opts.output || opts.error || "")}
      </failure>
    </testcase>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="MARIA Test" tests="1" failures="${opts.passed ? 0 : 1}" errors="0" skipped="0" time="${time}">
  <testsuite name="${escapeXml(opts.name)}" tests="1" failures="${opts.passed ? 0 : 1}" errors="0" skipped="0" time="${time}">
${testCase}
  </testsuite>
</testsuites>`;
}

/**
 * Merge multiple JUnit XML files
 */
export async function mergeJUnitFiles(
  files: string[],
  outputFile: string,
): Promise<void> {
  let totalTests = 0;
  let totalFailures = 0;
  let totalErrors = 0;
  let totalSkipped = 0;
  let totalTime = 0;
  const allSuites: string[] = [];

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");

    // Extract test suites (basic XML parsing - for production use XML parser)
    const suitesMatch = content.match(/<testsuite[^>]*>[\s\S]*?<\/testsuite>/g);
    if (suitesMatch) {
      allSuites.push(...suitesMatch);
    }

    // Extract totals from root testsuites element
    const rootMatch = content.match(
      /<testsuites[^>]*tests="(\d+)"[^>]*failures="(\d+)"[^>]*errors="(\d+)"[^>]*skipped="(\d+)"[^>]*time="([0-9.]+)"/,
    );
    if (rootMatch) {
      totalTests += parseInt(rootMatch[1]);
      totalFailures += parseInt(rootMatch[2]);
      totalErrors += parseInt(rootMatch[3]);
      totalSkipped += parseInt(rootMatch[4]);
      totalTime += parseFloat(rootMatch[5]);
    }
  }

  // Build merged XML
  const merged = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="MARIA Merged Tests" tests="${totalTests}" failures="${totalFailures}" errors="${totalErrors}" skipped="${totalSkipped}" time="${totalTime.toFixed(3)}">
${allSuites.join("\n")}
</testsuites>`;

  await fs.writeFile(outputFile, merged, "utf8");
}
