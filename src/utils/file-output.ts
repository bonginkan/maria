import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';

export interface FileOutputOptions {
  format?: 'json' | 'markdown' | 'yaml' | 'txt';
  timestamp?: boolean;
  outputDir?: string;
  filename?: string;
}

export class FileOutputManager {
  private outputDir: string;

  constructor(outputDir: string = process.cwd()) {
    this.outputDir = outputDir;
  }

  async saveSOW(sow: any, options: FileOutputOptions = {}): Promise<string> {
    const {
      format = 'json',
      timestamp = true,
      filename
    } = options;

    const baseFilename = filename || 'maria-sow';
    const timestampSuffix = timestamp 
      ? `-${new Date().toISOString().replace(/[:.]/g, '-')}` 
      : '';
    const fullFilename = `${baseFilename}${timestampSuffix}.${format}`;
    const filepath = path.join(this.outputDir, fullFilename);

    let content: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(sow, null, 2);
        break;
      case 'markdown':
        content = this.sowToMarkdown(sow);
        break;
      case 'yaml':
        content = this.sowToYaml(sow);
        break;
      case 'txt':
        content = this.sowToText(sow);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    await fs.writeFile(filepath, content, 'utf-8');
    logger.info(`SOW saved to: ${filepath}`);
    return filepath;
  }

  async saveExecutionResults(results: any, options: FileOutputOptions = {}): Promise<string> {
    const {
      format = 'json',
      timestamp = true,
      filename
    } = options;

    const baseFilename = filename || 'maria-execution-results';
    const timestampSuffix = timestamp 
      ? `-${new Date().toISOString().replace(/[:.]/g, '-')}` 
      : '';
    const fullFilename = `${baseFilename}${timestampSuffix}.${format}`;
    const filepath = path.join(this.outputDir, fullFilename);

    let content: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(results, null, 2);
        break;
      case 'markdown':
        content = this.resultsToMarkdown(results);
        break;
      case 'yaml':
        content = this.resultsToYaml(results);
        break;
      case 'txt':
        content = this.resultsToText(results);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    await fs.writeFile(filepath, content, 'utf-8');
    logger.info(`Execution results saved to: ${filepath}`);
    return filepath;
  }

  async saveChatLog(messages: any[], options: FileOutputOptions = {}): Promise<string> {
    const {
      format = 'json',
      timestamp = true,
      filename
    } = options;

    const baseFilename = filename || 'maria-chat-log';
    const timestampSuffix = timestamp 
      ? `-${new Date().toISOString().replace(/[:.]/g, '-')}` 
      : '';
    const fullFilename = `${baseFilename}${timestampSuffix}.${format}`;
    const filepath = path.join(this.outputDir, fullFilename);

    let content: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(messages, null, 2);
        break;
      case 'markdown':
        content = this.chatToMarkdown(messages);
        break;
      case 'txt':
        content = this.chatToText(messages);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    await fs.writeFile(filepath, content, 'utf-8');
    logger.info(`Chat log saved to: ${filepath}`);
    return filepath;
  }

  private sowToMarkdown(sow: any): string {
    const sections = [
      '# Statement of Work',
      '',
      `**Generated:** ${new Date().toISOString()}`,
      `**Title:** ${sow.title || 'Untitled'}`,
      `**Description:** ${sow.description || 'No description'}`,
      '',
      '## Overview',
      '',
      `- **Estimated Duration:** ${sow.estimatedDuration || 'Not specified'}`,
      `- **Total Budget:** $${sow.totalBudget || '0'}`,
      `- **Priority:** ${sow.priority || 'Medium'}`,
      '',
      '## Tasks',
      ''
    ];

    if (sow.tasks && sow.tasks.length > 0) {
      sow.tasks.forEach((task: any, index: number) => {
        sections.push(`### ${index + 1}. ${task.name || `Task ${index + 1}`}`);
        sections.push('');
        sections.push(`**Description:** ${task.description || 'No description'}`);
        sections.push(`**Duration:** ${task.duration || 'Not specified'}`);
        
        if (task.dependencies && task.dependencies.length > 0) {
          sections.push(`**Dependencies:** ${task.dependencies.join(', ')}`);
        }
        
        sections.push('');
      });
    }

    if (sow.deliverables && sow.deliverables.length > 0) {
      sections.push('## Deliverables');
      sections.push('');
      sow.deliverables.forEach((deliverable: any) => {
        sections.push(`- ${deliverable.name || deliverable}`);
      });
      sections.push('');
    }

    return sections.join('\n');
  }

  private sowToYaml(sow: any): string {
    // Simple YAML-like format
    const lines = [
      'sow:',
      `  title: "${sow.title || 'Untitled'}"`,
      `  description: "${sow.description || 'No description'}"`,
      `  estimatedDuration: "${sow.estimatedDuration || 'Not specified'}"`,
      `  totalBudget: ${sow.totalBudget || 0}`,
      `  priority: "${sow.priority || 'Medium'}"`,
      '  tasks:'
    ];

    if (sow.tasks && sow.tasks.length > 0) {
      sow.tasks.forEach((task: any, index: number) => {
        lines.push(`    - id: "${task.id || `task-${index}`}"`);
        lines.push(`      name: "${task.name || `Task ${index + 1}`}"`);
        lines.push(`      description: "${task.description || 'No description'}"`);
        lines.push(`      duration: "${task.duration || 'Not specified'}"`);
        if (task.dependencies && task.dependencies.length > 0) {
          lines.push(`      dependencies: [${task.dependencies.map((d: string) => `"${d}"`).join(', ')}]`);
        }
      });
    }

    return lines.join('\n');
  }

  private sowToText(sow: any): string {
    const lines = [
      'STATEMENT OF WORK',
      '='.repeat(50),
      '',
      `Title: ${sow.title || 'Untitled'}`,
      `Description: ${sow.description || 'No description'}`,
      `Estimated Duration: ${sow.estimatedDuration || 'Not specified'}`,
      `Total Budget: $${sow.totalBudget || '0'}`,
      `Priority: ${sow.priority || 'Medium'}`,
      '',
      'TASKS',
      '-'.repeat(20),
      ''
    ];

    if (sow.tasks && sow.tasks.length > 0) {
      sow.tasks.forEach((task: any, index: number) => {
        lines.push(`${index + 1}. ${task.name || `Task ${index + 1}`}`);
        lines.push(`   Description: ${task.description || 'No description'}`);
        lines.push(`   Duration: ${task.duration || 'Not specified'}`);
        if (task.dependencies && task.dependencies.length > 0) {
          lines.push(`   Dependencies: ${task.dependencies.join(', ')}`);
        }
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  private resultsToMarkdown(results: any): string {
    const sections = [
      '# Execution Results',
      '',
      `**Generated:** ${new Date().toISOString()}`,
      `**Execution ID:** ${results.executionId || 'N/A'}`,
      `**Status:** ${results.status || 'Unknown'}`,
      `**Duration:** ${results.duration || 'N/A'}`,
      '',
      '## Summary',
      '',
      `- **Total Steps:** ${results.totalSteps || 0}`,
      `- **Completed Steps:** ${results.completedSteps || 0}`,
      `- **Failed Steps:** ${results.failedSteps || 0}`,
      `- **Success Rate:** ${results.successRate ? (results.successRate * 100).toFixed(1) + '%' : 'N/A'}`,
      '',
      '## Step Details',
      ''
    ];

    if (results.steps && results.steps.length > 0) {
      results.steps.forEach((step: any, index: number) => {
        const statusIcon = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏸️';
        sections.push(`### ${statusIcon} ${step.name || `Step ${index + 1}`}`);
        sections.push('');
        sections.push(`**Status:** ${step.status || 'Unknown'}`);
        sections.push(`**Duration:** ${step.duration || 'N/A'}`);
        if (step.message) {
          sections.push(`**Message:** ${step.message}`);
        }
        if (step.error) {
          sections.push(`**Error:** ${step.error}`);
        }
        sections.push('');
      });
    }

    return sections.join('\n');
  }

  private resultsToYaml(results: any): string {
    const lines = [
      'execution_results:',
      `  executionId: "${results.executionId || 'N/A'}"`,
      `  status: "${results.status || 'Unknown'}"`,
      `  duration: "${results.duration || 'N/A'}"`,
      `  totalSteps: ${results.totalSteps || 0}`,
      `  completedSteps: ${results.completedSteps || 0}`,
      `  failedSteps: ${results.failedSteps || 0}`,
      `  successRate: ${results.successRate || 0}`,
      '  steps:'
    ];

    if (results.steps && results.steps.length > 0) {
      results.steps.forEach((step: any, index: number) => {
        lines.push(`    - name: "${step.name || `Step ${index + 1}`}"`);
        lines.push(`      status: "${step.status || 'Unknown'}"`);
        lines.push(`      duration: "${step.duration || 'N/A'}"`);
        if (step.message) {
          lines.push(`      message: "${step.message}"`);
        }
        if (step.error) {
          lines.push(`      error: "${step.error}"`);
        }
      });
    }

    return lines.join('\n');
  }

  private resultsToText(results: any): string {
    const lines = [
      'EXECUTION RESULTS',
      '='.repeat(50),
      '',
      `Execution ID: ${results.executionId || 'N/A'}`,
      `Status: ${results.status || 'Unknown'}`,
      `Duration: ${results.duration || 'N/A'}`,
      `Total Steps: ${results.totalSteps || 0}`,
      `Completed Steps: ${results.completedSteps || 0}`,
      `Failed Steps: ${results.failedSteps || 0}`,
      `Success Rate: ${results.successRate ? (results.successRate * 100).toFixed(1) + '%' : 'N/A'}`,
      '',
      'STEP DETAILS',
      '-'.repeat(20),
      ''
    ];

    if (results.steps && results.steps.length > 0) {
      results.steps.forEach((step: any, index: number) => {
        const statusSymbol = step.status === 'completed' ? '[✓]' : step.status === 'failed' ? '[✗]' : '[?]';
        lines.push(`${statusSymbol} ${step.name || `Step ${index + 1}`}`);
        lines.push(`    Status: ${step.status || 'Unknown'}`);
        lines.push(`    Duration: ${step.duration || 'N/A'}`);
        if (step.message) {
          lines.push(`    Message: ${step.message}`);
        }
        if (step.error) {
          lines.push(`    Error: ${step.error}`);
        }
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  private chatToMarkdown(messages: any[]): string {
    const sections = [
      '# MARIA Chat Log',
      '',
      `**Generated:** ${new Date().toISOString()}`,
      `**Total Messages:** ${messages.length}`,
      '',
      '## Conversation',
      ''
    ];

    messages.forEach((message: any) => {
      const timestamp = new Date(message.timestamp).toLocaleString();
      const role = message.role.toUpperCase();
      sections.push(`### ${role} - ${timestamp}`);
      sections.push('');
      sections.push(message.content);
      sections.push('');
      sections.push('---');
      sections.push('');
    });

    return sections.join('\n');
  }

  private chatToText(messages: any[]): string {
    const lines = [
      'MARIA CHAT LOG',
      '='.repeat(50),
      '',
      `Generated: ${new Date().toISOString()}`,
      `Total Messages: ${messages.length}`,
      '',
      'CONVERSATION',
      '-'.repeat(20),
      ''
    ];

    messages.forEach((message: any) => {
      const timestamp = new Date(message.timestamp).toLocaleString();
      const role = message.role.toUpperCase();
      lines.push(`[${timestamp}] ${role}:`);
      lines.push(message.content);
      lines.push('');
      lines.push('-'.repeat(50));
      lines.push('');
    });

    return lines.join('\n');
  }
}

// Global instance
export const fileOutputManager = new FileOutputManager();

// Convenience functions
export const saveSOW = (sow: any, options?: FileOutputOptions) => 
  fileOutputManager.saveSOW(sow, options);

export const saveExecutionResults = (results: any, options?: FileOutputOptions) => 
  fileOutputManager.saveExecutionResults(results, options);

export const saveChatLog = (messages: any[], options?: FileOutputOptions) => 
  fileOutputManager.saveChatLog(messages, options);