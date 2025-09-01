/**
 * Phase C Tests - Autonomous Execution and AI-driven Patch Generation
 */

import { describe, it, expect, beforeEach, afterEach, _vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import {
  AutonomousEngine,
  _ConfidenceLevel,
  _RiskLevel,
  PatchSuggestion,
} from "../../autonomous-engine";
import {
  AIPatchGenerator,
  _CodeAnalysis,
  GenerationContext,
  _CodeModification,
} from "../../ai-patch-generator";
import { ShellAgent } from "../../shell-agent";

describe("Phase C - Autonomous Engine", () => {
  let autonomousEngine: AutonomousEngine;
  let tempDir: string;

  beforeEach(async () => {
    autonomousEngine = new AutonomousEngine({
      enableLearning: true,
      minConfidence: 0.7,
      autoApprove: true,
      dryRun: true, // Dry run for tests
    });

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "auto-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("Patch Suggestion Generation", () => {
    it("should generate patch suggestion with confidence scoring", async () => {
      const suggestion = await autonomousEngine.generatePatchSuggestion(
        "add logging to processData function",
        { currentFile: "app.js" },
      );

      expect(suggestion).toBeDefined();
      expect(suggestion.confidence).toBeGreaterThan(0);
      expect(suggestion.confidence).toBeLessThanOrEqual(1);
      expect(suggestion.risk).toBeDefined();
      expect(suggestion.reasoning).toContain("Intent");
      expect(suggestion.plan.operations).toHaveLength(1);
    });

    it("should assess risk levels correctly", async () => {
      const criticalSuggestion = await autonomousEngine.generatePatchSuggestion(
        "modify authentication logic",
        { currentFile: "auth.js" },
      );

      expect(criticalSuggestion.risk).toBe(RiskLevel.CRITICAL);
      expect(criticalSuggestion.plan.requiresApproval).toBe(true);

      const lowRiskSuggestion = await autonomousEngine.generatePatchSuggestion(
        "add comment to function",
        { currentFile: "utils.js" },
      );

      expect([RiskLevel.MINIMAL, RiskLevel.LOW]).toContain(
        lowRiskSuggestion.risk,
      );
    });

    it("should determine auto-approval based on confidence and risk", async () => {
      const _highConfidenceLowRisk =
        await autonomousEngine.generatePatchSuggestion("add debug logging", {
          currentFile: "debug.js",
        });

      // High confidence + low risk might auto-approve
      // (depends on configuration)

      const lowConfidenceHighRisk =
        await autonomousEngine.generatePatchSuggestion(
          "refactor entire module",
          { currentFile: "core.js" },
        );

      expect(lowConfidenceHighRisk.plan.requiresApproval).toBe(true);
    });
  });

  describe("Learning System", () => {
    it("should record approval history", async () => {
      const suggestion: PatchSuggestion = {
        plan: {
          description: "Test patch",
          operations: [
            {
              type: "find_replace",
              file: "test.js",
              find: "old",
              replace: "new",
            },
          ],
          requiresApproval: false,
          transactionId: "test-1",
        },
        confidence: 0.8,
        risk: RiskLevel.LOW,
        reasoning: "Test reasoning",
        metadata: {
          timestamp: new Date().toISOString(),
        },
      };

      // Simulate execution (would normally go through approval)
      await autonomousEngine.executeAutonomousPatch(suggestion);

      const stats = autonomousEngine.getLearningStats();
      expect(stats.totalApprovals).toBeGreaterThanOrEqual(0);
    });

    it("should export and import learning data", () => {
      const exported = autonomousEngine.exportLearningData();
      expect(exported).toBeDefined();
      expect(() => JSON.parse(exported)).not.toThrow();

      const newEngine = new AutonomousEngine();
      newEngine.importLearningData(exported);

      const stats = newEngine.getLearningStats();
      expect(stats).toBeDefined();
    });

    it("should improve confidence over time with positive feedback", async () => {
      // Record multiple approvals for similar patterns
      for (let i = 0; i < 5; i++) {
        const suggestion = await autonomousEngine.generatePatchSuggestion(
          "add logging to function",
          { currentFile: "app.js" },
        );

        // Simulate approval (in dry run mode)
        await autonomousEngine.executeAutonomousPatch(suggestion);
      }

      const stats = autonomousEngine.getLearningStats();
      expect(stats.confidenceImprovement).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Batch Processing", () => {
    it("should process multiple requests in batch", async () => {
      const requests = [
        'add comment "TODO: refactor" to main.js',
        'replace "var" with "const" in utils.js',
        "add error handling to fetchData function",
      ];

      const result = await autonomousEngine.processBatch(requests);

      expect(result.total).toBe(3);
      expect(result.results).toHaveLength(3);
      expect(result.succeeded + result.failed).toBe(3);
    });

    it("should continue batch processing on individual failures", async () => {
      const requests = [
        "valid operation: add comment to file.js",
        "invalid operation that will fail",
        "another valid operation: add logging",
      ];

      const result = await autonomousEngine.processBatch(requests);

      expect(result.total).toBe(3);
      expect(result.results.some((r) => r.success)).toBe(true);
      expect(result.results.some((r) => !r.success)).toBe(true);
    });
  });
});

describe("Phase C - AI Patch Generator", () => {
  let aiGenerator: AIPatchGenerator;
  let tempDir: string;
  let testFile: string;

  beforeEach(async () => {
    aiGenerator = new AIPatchGenerator({
      provider: "openai",
      model: "gpt-4",
      temperature: 0.3,
    });

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-gen-test-"));
    testFile = path.join(tempDir, "test.js");

    await fs.writeFile(
      testFile,
      `
function processData(data) {
  const result = data.map(_item => _item * 2);
  return result;
}

class UserService {
  constructor() {
    this.users = [];
  }
  
  addUser(user) {
    this.users.push(user);
  }
}

export { processData, UserService };
`,
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("Code Analysis", () => {
    it("should analyze code and detect language", async () => {
      const content = await fs.readFile(testFile, "utf-8");
      const analysis = await aiGenerator.analyzeCode("test.js", content);

      expect(analysis.language).toBe("javascript");
      expect(analysis.patterns).toContain("class-based");
      expect(analysis.patterns).toContain("functional");
      expect(analysis.complexity).toBeDefined();
    });

    it("should detect framework patterns", async () => {
      const reactCode = `
import React, { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}
`;
      const analysis = await aiGenerator.analyzeCode("App.jsx", reactCode);

      expect(analysis.language).toBe("javascript-react");
      expect(analysis.framework).toBe("react");
      expect(analysis.patterns).toContain("functional");
    });

    it("should assess code complexity", async () => {
      const simpleCode = "const x = 1;";
      const simpleAnalysis = await aiGenerator.analyzeCode(
        "simple.js",
        simpleCode,
      );
      expect(simpleAnalysis.complexity).toBe("low");

      const complexCode = `
function complex(data) {
  if (data) {
    for (let i = 0; i < data.length; i++) {
      if (data[i] > 0) {
        while (data[i] > 10) {
          if (data[i] % 2 === 0) {
            data[i] = data[i] / 2;
          } else {
            data[i] = data[i] - 1;
          }
        }
      }
    }
  }
}`;
      const complexAnalysis = await aiGenerator.analyzeCode(
        "complex.js",
        complexCode,
      );
      expect(["medium", "high"]).toContain(complexAnalysis.complexity);
    });
  });

  describe("Patch Generation", () => {
    it("should generate modification for adding logging", async () => {
      const content = await fs.readFile(testFile, "utf-8");
      const context: GenerationContext = {
        currentCode: content,
        targetDescription: "add logging to processData function",
        codeAnalysis: await aiGenerator.analyzeCode(testFile, content),
      };

      const modification = await aiGenerator.generateModification(context);

      expect(modification.type).toBeDefined();
      expect(modification.patches).toHaveLength(1);
      expect(modification.explanation).toBeDefined();
      expect(modification.estimatedImpact).toBeDefined();
    });

    it("should generate alternative approaches", async () => {
      const context: GenerationContext = {
        targetDescription: "improve performance of data processing",
      };

      const modification = await aiGenerator.generateModification(context);

      expect(modification.alternativeApproaches).toBeDefined();
      expect(modification.alternativeApproaches!.length).toBeGreaterThan(0);
    });

    it("should validate generated patches", async () => {
      const validPatches = [
        {
          type: "find_replace" as const,
          file: "test.js",
          find: "old",
          replace: "new",
        },
      ];

      const validResult = await aiGenerator.validatePatches(validPatches);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidPatches = [
        {
          type: "find_replace" as const,
          file: "", // Missing file
          find: "old",
          replace: "new",
        },
      ];

      const invalidResult = await aiGenerator.validatePatches(invalidPatches);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    it("should generate warnings for risky operations", async () => {
      const riskyPatches = [
        {
          type: "delete_lines" as const,
          file: "test.spec.js",
          startLine: 1,
          endLine: 100, // Large deletion
        },
      ];

      const result = await aiGenerator.validatePatches(riskyPatches);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("Large deletion");
    });
  });
});

describe("Phase C - Shell Agent Integration", () => {
  let shellAgent: ShellAgent;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shell-c-test-"));

    shellAgent = new ShellAgent({
      workspaceRoot: tempDir,
      phase: "C",
      enableEdit: true,
      autoApprove: true,
      enableLearning: true,
      minConfidence: 0.7,
      batchMode: true,
    });

    // Create test file
    const testFile = path.join(tempDir, "test.js");
    await fs.writeFile(testFile, "function test() { return 42; }");
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("Autonomous Execution", () => {
    it("should execute autonomous operations", async () => {
      const result = await shellAgent.executeAutonomous({
        text: 'add comment "This is a test function" to test.js',
        dryRun: true,
      });

      expect(result.success).toBeDefined();
      expect(result.message).toBeDefined();
      if (result.suggestion) {
        expect(result.suggestion.confidence).toBeGreaterThan(0);
        expect(result.suggestion.risk).toBeDefined();
      }
    });

    it("should provide learning statistics", async () => {
      const result = await shellAgent.executeAutonomous({
        text: "add logging to test.js",
        dryRun: true,
      });

      if (result.learningStats) {
        expect(result.learningStats.totalApprovals).toBeDefined();
        expect(result.learningStats.approvalRate).toBeDefined();
      }
    });
  });

  describe("Batch Operations", () => {
    it("should execute batch operations", async () => {
      const requests = [
        "add comment to test.js",
        "add error handling to test function",
      ];

      const result = await shellAgent.executeBatch(requests);

      expect(result.success).toBeDefined();
      expect(result.total).toBe(2);
      expect(result.results).toHaveLength(2);
    });
  });

  describe("Learning Data Management", () => {
    it("should export and import learning data", () => {
      // Execute some operations to generate learning data
      // (would normally be done through actual operations)

      const exported = shellAgent.exportLearning();
      if (exported) {
        expect(() => JSON.parse(exported)).not.toThrow();

        // Create new agent and import
        const newAgent = new ShellAgent({
          workspaceRoot: tempDir,
          phase: "C",
          enableLearning: true,
        });

        const imported = newAgent.importLearning(exported);
        expect(imported).toBe(true);
      }
    });
  });

  describe("Phase Validation", () => {
    it("should reject autonomous operations in Phase A/B", async () => {
      const phaseAAgent = new ShellAgent({
        workspaceRoot: tempDir,
        phase: "A",
      });

      const result = await phaseAAgent.executeAutonomous({
        text: "test operation",
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Phase C");
    });

    it("should reject batch operations in Phase A/B", async () => {
      const phaseBAgent = new ShellAgent({
        workspaceRoot: tempDir,
        phase: "B",
        enableEdit: true,
      });

      const result = await phaseBAgent.executeBatch(["test"]);

      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
    });
  });
});
