/**
 * PlanGenerator - Generates execution plans from analyzed intents
 * Converts intents into concrete operation steps
 */

import { Intent } from './IntentAnalyzer';
import { OperationContext, PlannedOperation, ExecutionPlan } from './AutonomousExecutor';
import { v4 as uuid } from 'uuid';

export class PlanGenerator {
  /**
   * Generate execution plan from intent
   */
  async generate(intent: Intent, context: OperationContext): Promise<ExecutionPlan> {
    const steps = await this.generateSteps(intent, context);
    const rationale = this.generateRationale(intent, steps);
    const estimatedDuration = this.estimateDuration(steps);

    const plan: ExecutionPlan = {
      id: uuid(),
      description: this.generateDescription(intent),
      steps,
      rationale,
      risk: {
        level: 'low',
        factors: [],
        score: 0
      },
      policyResult: {
        allow: true,
        reason: 'Pending policy evaluation',
        risk: 'low',
        requiresApproval: false
      },
      estimatedDuration
    };

    return plan;
  }

  /**
   * Generate operation steps from intent
   */
  private async generateSteps(intent: Intent, context: OperationContext): Promise<PlannedOperation[]> {
    const steps: PlannedOperation[] = [];

    switch (intent.type) {
      case 'create':
        steps.push(...this.generateCreateSteps(intent));
        break;
      
      case 'modify':
        steps.push(...this.generateModifySteps(intent));
        break;
      
      case 'delete':
        steps.push(...this.generateDeleteSteps(intent));
        break;
      
      case 'execute':
        steps.push(...this.generateExecuteSteps(intent));
        break;
      
      case 'refactor':
        steps.push(...this.generateRefactorSteps(intent));
        break;
      
      default:
        steps.push(this.generateDefaultStep(intent));
    }

    return steps;
  }

  /**
   * Generate create operation steps
   */
  private generateCreateSteps(intent: Intent): PlannedOperation[] {
    const steps: PlannedOperation[] = [];
    
    // Find path entity
    const pathEntity = intent.entities.find(e => e.type === 'path');
    let path = pathEntity?.value || 'new-file.ts';
    
    // If path is a directory, append a filename
    if (path.endsWith('/')) {
      path += 'new-file.ts';
    } else if (!path.includes('.')) {
      // If no extension, assume it's a directory and append filename
      if (path.includes('src') || path.includes('test') || path.includes('docs')) {
        path += '/new-file.ts';
      } else {
        path += '.ts'; // Assume it's a file without extension
      }
    }

    steps.push({
      type: 'writeFile',
      path,
      content: this.generateDefaultContent(path),
      estimatedRisk: 'low'
    });

    return steps;
  }

  /**
   * Generate modify operation steps
   */
  private generateModifySteps(intent: Intent): PlannedOperation[] {
    const steps: PlannedOperation[] = [];
    
    const pathEntity = intent.entities.find(e => e.type === 'path');
    const path = pathEntity?.value || 'file.ts';

    steps.push({
      type: 'editFile',
      path,
      content: '// Modified content',
      estimatedRisk: 'low'
    });

    return steps;
  }

  /**
   * Generate delete operation steps
   */
  private generateDeleteSteps(intent: Intent): PlannedOperation[] {
    const steps: PlannedOperation[] = [];
    
    const pathEntity = intent.entities.find(e => e.type === 'path');
    const path = pathEntity?.value;

    // If no specific path but intent suggests mass deletion, it's very dangerous
    if (intent.rawIntent.toLowerCase().includes('all')) {
      steps.push({
        type: 'deleteFile',
        path: '*',  // Wildcard deletion is extremely dangerous
        estimatedRisk: 'critical'
      });
    } else if (intent.rawIntent.toLowerCase().includes('configuration') || 
               intent.rawIntent.toLowerCase().includes('config')) {
      // Configuration files are high risk
      steps.push({
        type: 'deleteFile',
        path: 'config/*',  // Assume config directory
        estimatedRisk: 'high'
      });
    } else if (path) {
      steps.push({
        type: 'deleteFile',
        path,
        estimatedRisk: 'high'  // Delete operations are always risky
      });
    } else {
      // Generic delete without path
      steps.push({
        type: 'deleteFile',
        path: 'unknown',
        estimatedRisk: 'high'
      });
    }

    return steps;
  }

  /**
   * Generate execute operation steps
   */
  private generateExecuteSteps(intent: Intent): PlannedOperation[] {
    const steps: PlannedOperation[] = [];
    
    const commandEntity = intent.entities.find(e => e.type === 'command');
    // If the raw intent contains dangerous patterns, preserve them for detection
    const command = commandEntity?.value || intent.rawIntent || 'echo "No command specified"';

    steps.push({
      type: 'execCommand',
      command,
      estimatedRisk: 'medium'
    });

    return steps;
  }

  /**
   * Generate refactor operation steps
   */
  private generateRefactorSteps(intent: Intent): PlannedOperation[] {
    const steps: PlannedOperation[] = [];
    
    // Refactoring typically involves multiple steps
    const pathEntity = intent.entities.find(e => e.type === 'path');
    const path = pathEntity?.value || 'src/file.ts';

    // Analyze current code
    steps.push({
      type: 'execCommand',
      command: `eslint ${path} --fix`,
      estimatedRisk: 'low'
    });

    // Apply refactoring
    steps.push({
      type: 'editFile',
      path,
      content: '// Refactored content',
      estimatedRisk: 'medium'
    });

    // Run tests
    steps.push({
      type: 'execCommand',
      command: 'npm test',
      estimatedRisk: 'low'
    });

    return steps;
  }

  /**
   * Generate default step
   */
  private generateDefaultStep(intent: Intent): PlannedOperation {
    return {
      type: 'execCommand',
      command: 'echo "Operation not implemented"',
      estimatedRisk: 'low'
    };
  }

  /**
   * Generate default file content based on extension
   */
  private generateDefaultContent(path: string): string {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) {
      return `/**
 * ${path}
 * Generated by MARIA Autonomous Agent
 */

export class NewClass {
  constructor() {
    // Implementation
  }
}`;
    }
    
    if (path.endsWith('.js') || path.endsWith('.jsx')) {
      return `/**
 * ${path}
 * Generated by MARIA Autonomous Agent
 */

class NewClass {
  constructor() {
    // Implementation
  }
}

module.exports = NewClass;`;
    }
    
    if (path.endsWith('.json')) {
      return JSON.stringify({
        name: 'generated',
        version: '1.0.0',
        description: 'Generated by MARIA Autonomous Agent'
      }, null, 2);
    }
    
    if (path.endsWith('.md')) {
      return `# ${path}

Generated by MARIA Autonomous Agent

## Description

This file was automatically generated.`;
    }
    
    return '// Generated file';
  }

  /**
   * Generate plan description
   */
  private generateDescription(intent: Intent): string {
    const action = intent.action.charAt(0).toUpperCase() + intent.action.slice(1);
    const target = intent.target;
    const scope = intent.scope;
    
    return `${action} ${target} at ${scope} level`;
  }

  /**
   * Generate rationale for the plan
   */
  private generateRationale(intent: Intent, steps: PlannedOperation[]): string {
    const lines: string[] = [];
    
    lines.push(`Intent: ${intent.type} operation`);
    lines.push(`Target: ${intent.target}`);
    lines.push(`Scope: ${intent.scope}`);
    lines.push(`Confidence: ${(intent.confidence * 100).toFixed(1)}%`);
    lines.push(`Steps: ${steps.length} operations planned`);
    
    if (intent.urgency === 'critical') {
      lines.push('⚠️ Critical urgency - expedited processing');
    }
    
    return lines.join('\n');
  }

  /**
   * Estimate execution duration
   */
  private estimateDuration(steps: PlannedOperation[]): number {
    let totalMs = 0;
    
    for (const step of steps) {
      switch (step.type) {
        case 'writeFile':
        case 'editFile':
        case 'deleteFile':
          totalMs += 100; // File operations are fast
          break;
        
        case 'execCommand':
          // Commands can vary widely
          if (step.command?.includes('test')) {
            totalMs += 5000; // Tests take longer
          } else if (step.command?.includes('build')) {
            totalMs += 10000; // Builds take even longer
          } else {
            totalMs += 1000; // Default command time
          }
          break;
        
        case 'networkRequest':
          totalMs += 2000; // Network requests have latency
          break;
        
        default:
          totalMs += 500;
      }
    }
    
    return totalMs;
  }
}