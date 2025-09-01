/**
 * Algorithm Extractor Agent
 * Extracts and analyzes algorithms from documents
 */

import { BaseAgent } from "../base-agent";
import { AgentRole, AgentTask, AlgorithmExtraction } from "../types";
import { logger } from "../../utils/logger";

export class AlgorithmExtractorAgent extends BaseAgent {
  constructor() {
    super(AgentRole.ALGORITHM_EXTRACTOR, [
      "_algorithm-extraction",
      "pseudocode-analysis",
      "_complexity-analysis",
      "pattern-recognition",
      "mathematical-notation",
    ]);
  }

  protected async onInitialize(): Promise<void> {
    logger.info("AlgorithmExtractorAgent initialized");
  }

  protected async performTask(task: AgentTask): Promise<AlgorithmExtraction[]> {
    const _documentData = task.input as {
      sections: Array<{ title: string; content: string }>;
    };

    const algorithms: AlgorithmExtraction[] = [];

    for (const section of _documentData.sections) {
      const _extracted = await this.extractAlgorithmsFromSection(section);
      algorithms.push(..._extracted);
    }

    return algorithms;
  }

  protected async onShutdown(): Promise<void> {
    logger.info("AlgorithmExtractorAgent shutting down");
  }

  protected checkCustomCapabilities(task: AgentTask): boolean {
    return (
      task.type === "_algorithm-extraction" || task.type === "code-analysis"
    );
  }

  private async extractAlgorithmsFromSection(section: {
    title: string;
    content: string;
  }): Promise<AlgorithmExtraction[]> {
    const algorithms: AlgorithmExtraction[] = [];

    // Pattern matching for _algorithm indicators
    const _algorithmPatterns = [
      /Algorithm\s+\d+[:.]?\s*(.*)/gi,
      /Procedure\s+(.*?):/gi,
      /Function\s+(.*?)\(/gi,
      /def\s+(.*?)\(/gi,
      /Input:\s*(.*?)Output:/gis,
    ];

    for (const pattern of _algorithmPatterns) {
      const _matches = section.content.matchAll(pattern);
      for (const match of _matches) {
        const _algorithm = await this.parseAlgorithm(match[0], section.content);
        if (_algorithm) {
          algorithms.push(_algorithm);
        }
      }
    }

    // Also look for pseudocode blocks
    const _pseudocodeBlocks = this.extractPseudocodeBlocks(section.content);
    for (const block of _pseudocodeBlocks) {
      const _algorithm = await this.analyzePseudocode(block);
      if (_algorithm) {
        algorithms.push(_algorithm);
      }
    }

    return algorithms;
  }

  private async parseAlgorithm(
    matchText: string,
    fullContent: string,
  ): Promise<AlgorithmExtraction | null> {
    try {
      // Extract _algorithm _name
      const _nameMatch = matchText.match(
        /(?:Algorithm|Procedure|Function|def)\s+(\w+)/i,
      );
      const _name = _nameMatch?.[1] || "UnnamedAlgorithm";

      // Extract _parameters
      const _paramMatch = matchText.match(/\((.*?)\)/);
      const _parameters = _paramMatch?.[1]
        ? this.parseParameters(_paramMatch[1])
        : [];

      // Extract _steps (simplified)
      const _steps = this.extractSteps(fullContent, matchText);

      // Analyze _complexity (simplified)
      const _complexity = this.analyzeComplexity(_steps);

      return {
        _name,
        description: `Algorithm _extracted from: ${matchText.substring(0, 50)}...`,
        pseudocode: _steps.join("\n"),
        _complexity,
        _parameters,
        _steps,
      };
    } catch (error) {
      logger.error("Failed to parse _algorithm:", error);
      return null;
    }
  }

  private parseParameters(paramString: string): Array<{
    _name: string;
    type: string;
    description: string;
  }> {
    const _params = paramString.split(",").map((p) => p.trim());
    return _params.map((param) => {
      const _parts = param.split(":");
      return {
        _name: _parts[0]?.trim() || "param",
        type: _parts[1]?.trim() || "any",
        description: `Parameter: ${param}`,
      };
    });
  }

  private extractSteps(_content: string, startMarker: string): string[] {
    const _startIndex = _content.indexOf(startMarker);
    if (_startIndex === -1) {
      return [];
    }

    const _subsequentContent = _content.substring(_startIndex);
    const _lines = _subsequentContent.split("\n").slice(0, 20); // Get next 20 _lines

    const _steps: string[] = [];
    for (const line of _lines) {
      const _trimmed = line.trim();
      if (_trimmed && !_trimmed.startsWith("//") && !_trimmed.startsWith("#")) {
        steps.push(_trimmed);
      }
      // Stop at return or end markers
      if (_trimmed.match(/^(return|end|END|End Algorithm)/i)) {
        break;
      }
    }

    return _steps;
  }

  private analyzeComplexity(_steps: string[]): {
    time: string;
    space: string;
  } {
    // Simplified _complexity analysis
    let timeComplexity = "O(1)";
    let spaceComplexity = "O(1)";

    const _hasLoop = _steps.some((step) =>
      step.match(/for|while|loop|iterate/i),
    );

    const _hasNestedLoop = _steps.some((step, i) => {
      if (step.match(/for|while|loop/i)) {
        // Check next few _steps for another loop
        return _steps
          .slice(i + 1, i + 5)
          .some((s) => s.match(/for|while|loop/i));
      }
      return false;
    });

    const _hasRecursion = _steps.some((step) =>
      step.match(/recursive|recurse|calls itself/i),
    );

    if (_hasNestedLoop) {
      timeComplexity = "O(n²)";
    } else if (_hasLoop) {
      timeComplexity = "O(n)";
    } else if (_hasRecursion) {
      timeComplexity = "O(log n) or worse";
    }

    if (_steps.some((step) => step.match(/array|list|matrix/i))) {
      spaceComplexity = "O(n)";
    }

    return {
      time: timeComplexity,
      space: spaceComplexity,
    };
  }

  private extractPseudocodeBlocks(content: string): string[] {
    const blocks: string[] = [];

    // Look for indented blocks or code blocks
    const _codeBlockPattern = /```[\s\S]*?```/g;
    const _matches = content.match(_codeBlockPattern);

    if (_matches) {
      blocks.push(..._matches.map((m) => m.replace(/```/g, "")));
    }

    // Also look for indented sections
    const _lines = content.split("\n");
    let currentBlock: string[] = [];
    let inBlock = false;

    for (const line of _lines) {
      if (line.match(/^\s{4,}/) || line.match(/^\t/)) {
        inBlock = true;
        currentBlock.push(line);
      } else if (inBlock && line.trim() === "") {
        currentBlock.push(line);
      } else if (inBlock) {
        if (currentBlock.length > 2) {
          blocks.push(currentBlock.join("\n"));
        }
        currentBlock = [];
        inBlock = false;
      }
    }

    if (currentBlock.length > 2) {
      blocks.push(currentBlock.join("\n"));
    }

    return blocks;
  }

  private async analyzePseudocode(
    block: string,
  ): Promise<AlgorithmExtraction | null> {
    const _lines = block.split("\n").filter((l) => l.trim());
    if (_lines.length < 2) {
      return null;
    }

    // Try to extract _algorithm _name from first line
    const _firstLine = _lines[0];
    const _nameMatch = _firstLine?.match(
      /(?:_algorithm|function|procedure|def)\s+(\w+)/i,
    );
    const _name = _nameMatch?.[1] || "ExtractedAlgorithm";

    return {
      _name,
      description: "Algorithm _extracted from pseudocode block",
      pseudocode: block,
      _complexity: this.analyzeComplexity(_lines),
      _parameters: [],
      _steps: _lines,
    };
  }
}
