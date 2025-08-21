/**
 * Algorithm Extractor Agent
 * Extracts and analyzes algorithms from documents
 */

import { BaseAgent } from '../base-agent';
import { AgentRole, AgentTask, AlgorithmExtraction } from '../types';
import { logger } from '../../utils/logger';

export class AlgorithmExtractorAgent extends BaseAgent {
  constructor() {
    super(AgentRole.ALGORITHM_EXTRACTOR, [
      'algorithm-extraction',
      'pseudocode-analysis',
      'complexity-analysis',
      'pattern-recognition',
      'mathematical-notation',
    ]);
  }

  protected async onInitialize(): Promise<void> {
    logger.info('AlgorithmExtractorAgent initialized');
  }

  protected async performTask(task: AgentTask): Promise<AlgorithmExtraction[]> {
    const documentData = task.input as {
      sections: Array<{ title: string; content: string }>;
    };

    const algorithms: AlgorithmExtraction[] = [];

    for (const section of documentData.sections) {
      const extracted = await this.extractAlgorithmsFromSection(section);
      algorithms.push(...extracted);
    }

    return algorithms;
  }

  protected async onShutdown(): Promise<void> {
    logger.info('AlgorithmExtractorAgent shutting down');
  }

  protected checkCustomCapabilities(task: AgentTask): boolean {
    return task.type === 'algorithm-extraction' || task.type === 'code-analysis';
  }

  private async extractAlgorithmsFromSection(section: {
    title: string;
    content: string;
  }): Promise<AlgorithmExtraction[]> {
    const algorithms: AlgorithmExtraction[] = [];

    // Pattern matching for algorithm indicators
    const algorithmPatterns = [
      /Algorithm\s+\d+[:.]?\s*(.*)/gi,
      /Procedure\s+(.*?):/gi,
      /Function\s+(.*?)\(/gi,
      /def\s+(.*?)\(/gi,
      /Input:\s*(.*?)Output:/gis,
    ];

    for (const pattern of algorithmPatterns) {
      const matches = section.content.matchAll(pattern);
      for (const match of matches) {
        const algorithm = await this.parseAlgorithm(match[0], section.content);
        if (algorithm) {
          algorithms.push(algorithm);
        }
      }
    }

    // Also look for pseudocode blocks
    const pseudocodeBlocks = this.extractPseudocodeBlocks(section.content);
    for (const block of pseudocodeBlocks) {
      const algorithm = await this.analyzePseudocode(block);
      if (algorithm) {
        algorithms.push(algorithm);
      }
    }

    return algorithms;
  }

  private async parseAlgorithm(
    matchText: string,
    fullContent: string,
  ): Promise<AlgorithmExtraction | null> {
    try {
      // Extract algorithm name
      const nameMatch = matchText.match(/(?:Algorithm|Procedure|Function|def)\s+(\w+)/i);
      const name = nameMatch?.[1] || 'UnnamedAlgorithm';

      // Extract parameters
      const paramMatch = matchText.match(/\((.*?)\)/);
      const parameters = paramMatch?.[1] ? this.parseParameters(paramMatch[1]) : [];

      // Extract steps (simplified)
      const steps = this.extractSteps(fullContent, matchText);

      // Analyze complexity (simplified)
      const complexity = this.analyzeComplexity(steps);

      return {
        name,
        description: `Algorithm extracted from: ${matchText.substring(0, 50)}...`,
        pseudocode: steps.join('\n'),
        complexity,
        parameters,
        steps,
      };
    } catch (error) {
      logger.error('Failed to parse algorithm:', error);
      return null;
    }
  }

  private parseParameters(paramString: string): Array<{
    name: string;
    type: string;
    description: string;
  }> {
    const params = paramString.split(',').map((p) => p.trim());
    return params.map((param) => {
      const parts = param.split(':');
      return {
        name: parts[0]?.trim() || 'param',
        type: parts[1]?.trim() || 'any',
        description: `Parameter: ${param}`,
      };
    });
  }

  private extractSteps(content: string, startMarker: string): string[] {
    const startIndex = content.indexOf(startMarker);
    if (startIndex === -1) return [];

    const subsequentContent = content.substring(startIndex);
    const lines = subsequentContent.split('\n').slice(0, 20); // Get next 20 lines

    const steps: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
        steps.push(trimmed);
      }
      // Stop at return or end markers
      if (trimmed.match(/^(return|end|END|End Algorithm)/i)) {
        break;
      }
    }

    return steps;
  }

  private analyzeComplexity(steps: string[]): {
    time: string;
    space: string;
  } {
    // Simplified complexity analysis
    let timeComplexity = 'O(1)';
    let spaceComplexity = 'O(1)';

    const hasLoop = steps.some((step) => step.match(/for|while|loop|iterate/i));

    const hasNestedLoop = steps.some((step, i) => {
      if (step.match(/for|while|loop/i)) {
        // Check next few steps for another loop
        return steps.slice(i + 1, i + 5).some((s) => s.match(/for|while|loop/i));
      }
      return false;
    });

    const hasRecursion = steps.some((step) => step.match(/recursive|recurse|calls itself/i));

    if (hasNestedLoop) {
      timeComplexity = 'O(n²)';
    } else if (hasLoop) {
      timeComplexity = 'O(n)';
    } else if (hasRecursion) {
      timeComplexity = 'O(log n) or worse';
    }

    if (steps.some((step) => step.match(/array|list|matrix/i))) {
      spaceComplexity = 'O(n)';
    }

    return {
      time: timeComplexity,
      space: spaceComplexity,
    };
  }

  private extractPseudocodeBlocks(content: string): string[] {
    const blocks: string[] = [];

    // Look for indented blocks or code blocks
    const codeBlockPattern = /```[\s\S]*?```/g;
    const matches = content.match(codeBlockPattern);

    if (matches) {
      blocks.push(...matches.map((m) => m.replace(/```/g, '')));
    }

    // Also look for indented sections
    const lines = content.split('\n');
    let currentBlock: string[] = [];
    let inBlock = false;

    for (const line of lines) {
      if (line.match(/^\s{4,}/) || line.match(/^\t/)) {
        inBlock = true;
        currentBlock.push(line);
      } else if (inBlock && line.trim() === '') {
        currentBlock.push(line);
      } else if (inBlock) {
        if (currentBlock.length > 2) {
          blocks.push(currentBlock.join('\n'));
        }
        currentBlock = [];
        inBlock = false;
      }
    }

    if (currentBlock.length > 2) {
      blocks.push(currentBlock.join('\n'));
    }

    return blocks;
  }

  private async analyzePseudocode(block: string): Promise<AlgorithmExtraction | null> {
    const lines = block.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return null;

    // Try to extract algorithm name from first line
    const firstLine = lines[0];
    const nameMatch = firstLine?.match(/(?:algorithm|function|procedure|def)\s+(\w+)/i);
    const name = nameMatch?.[1] || 'ExtractedAlgorithm';

    return {
      name,
      description: 'Algorithm extracted from pseudocode block',
      pseudocode: block,
      complexity: this.analyzeComplexity(lines),
      parameters: [],
      steps: lines,
    };
  }
}
