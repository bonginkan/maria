import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';
import { SOWData, SOWTask } from '../types/common';

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

  async saveSOW(sow: SOWData, options: FileOutputOptions = {}): Promise<string> {
    const { format = 'json', timestamp = true, filename } = options;

    const baseFilename = filename || 'maria-sow';
    const timestampSuffix = timestamp ? `-${new Date().toISOString().replace(/[:.]/g, '-')}` : '';
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

  async saveExecutionResults(results: unknown, options: FileOutputOptions = {}): Promise<string> {
    const { format = 'json', timestamp = true, filename } = options;

    const baseFilename = filename || 'maria-execution-results';
    const timestampSuffix = timestamp ? `-${new Date().toISOString().replace(/[:.]/g, '-')}` : '';
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

  async saveChatLog(messages: unknown[], options: FileOutputOptions = {}): Promise<string> {
    const { format = 'json', timestamp = true, filename } = options;

    const baseFilename = filename || 'maria-chat-log';
    const timestampSuffix = timestamp ? `-${new Date().toISOString().replace(/[:.]/g, '-')}` : '';
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

  private sowToMarkdown(sow: SOWData): string {
    const sowData = this.ensureSOWStructure(sow);
    const sections = [
      '# Statement of Work',
      '',
      `**Generated:** ${new Date().toISOString()}`,
      `**Title:** ${sowData.title || 'Untitled'}`,
      `**Description:** ${sowData.description || 'No description'}`,
      '',
      '## Overview',
      '',
      `- **Timeline:** ${sowData.timeline || 'Not specified'}`,
      `- **Budget:** ${sowData.budget || 'Not specified'}`,
      `- **Objective:** ${sowData.objective || 'Not specified'}`,
      '',
      '## Tasks',
      '',
    ];

    if (sowData.tasks && sowData.tasks.length > 0) {
      sowData.tasks.forEach((task, index: number) => {
        const taskData = this.ensureTaskStructure(task);
        sections.push(`### ${index + 1}. ${taskData.name || `Task ${index + 1}`}`);
        sections.push('');
        sections.push(`**Description:** ${taskData.description || 'No description'}`);
        sections.push(`**Time Estimate:** ${taskData.timeEstimate || 'Not specified'}`);

        if (taskData.dependencies && taskData.dependencies.length > 0) {
          sections.push(`**Dependencies:** ${taskData.dependencies.join(', ')}`);
        }

        sections.push('');
      });
    }

    if (sow.deliverables && sow.deliverables.length > 0) {
      sections.push('## Deliverables');
      sections.push('');
      sow.deliverables.forEach((deliverable) => {
        sections.push(`- ${deliverable.name || deliverable}`);
      });
      sections.push('');
    }

    return sections.join('\n');
  }

  private sowToYaml(sow: SOWData): string {
    // Simple YAML-like format
    const lines = [
      'sow:',
      `  title: "${sow.title || 'Untitled'}"`,
      `  description: "${sow.description || 'No description'}"`,
      `  timeline: "${sow.timeline || 'Not specified'}"`,
      `  budget: "${sow.budget || 'Not specified'}"`,
      `  objective: "${sow.objective || 'Not specified'}"`,
      '  tasks:',
    ];

    if (sow.tasks && sow.tasks.length > 0) {
      sow.tasks.forEach((task: SOWTask, index: number) => {
        lines.push(`    - id: "${task.id || `task-${index}`}"`);
        lines.push(`      name: "${task.name || `Task ${index + 1}`}"`);
        lines.push(`      description: "${task.description || 'No description'}"`);
        lines.push(`      timeEstimate: "${task.timeEstimate || 'Not specified'}"`);
        if (task.dependencies && task.dependencies.length > 0) {
          lines.push(
            `      dependencies: [${task.dependencies.map((d: string) => `"${d}"`).join(', ')}]`,
          );
        }
      });
    }

    return lines.join('\n');
  }

  private sowToText(sow: SOWData): string {
    const sowData = this.ensureSOWStructure(sow);
    const lines = [
      'STATEMENT OF WORK',
      '='.repeat(50),
      '',
      `Title: ${sowData.title || 'Untitled'}`,
      `Description: ${sowData.description || 'No description'}`,
      `Timeline: ${sowData.timeline || 'Not specified'}`,
      `Budget: ${sowData.budget || 'Not specified'}`,
      `Objective: ${sowData.objective || 'Not specified'}`,
      '',
      'TASKS',
      '-'.repeat(20),
      '',
    ];

    if (sowData.tasks && Array.isArray(sowData.tasks) && sowData.tasks.length > 0) {
      sowData.tasks.forEach((task: SOWTask, index: number) => {
        const taskData = this.ensureTaskStructure(task);
        lines.push(`${index + 1}. ${taskData.name || `Task ${index + 1}`}`);
        lines.push(`   Description: ${taskData.description || 'No description'}`);
        lines.push(`   Time Estimate: ${taskData.timeEstimate || 'Not specified'}`);
        if (
          taskData.dependencies &&
          Array.isArray(taskData.dependencies) &&
          taskData.dependencies.length > 0
        ) {
          lines.push(`   Dependencies: ${taskData.dependencies.join(', ')}`);
        }
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  private resultsToMarkdown(results: unknown): string {
    const resultsData = this.ensureResultsStructure(results);
    const sections = [
      '# Execution Results',
      '',
      `**Generated:** ${new Date().toISOString()}`,
      `**Execution ID:** ${resultsData['executionId'] || 'N/A'}`,
      `**Status:** ${resultsData['status'] || 'Unknown'}`,
      `**Duration:** ${resultsData['duration'] || 'N/A'}`,
      '',
      '## Summary',
      '',
      `- **Total Steps:** ${resultsData['totalSteps'] || 0}`,
      `- **Completed Steps:** ${resultsData['completedSteps'] || 0}`,
      `- **Failed Steps:** ${resultsData['failedSteps'] || 0}`,
      `- **Success Rate:** ${resultsData['successRate'] ? `${(Number(resultsData['successRate']) * 100).toFixed(1)  }%` : 'N/A'}`,
      '',
      '## Step Details',
      '',
    ];

    if (
      resultsData['steps'] &&
      Array.isArray(resultsData['steps']) &&
      (resultsData['steps'] as unknown[]).length > 0
    ) {
      (resultsData['steps'] as unknown[]).forEach((step: unknown, index: number) => {
        const stepData = this.ensureStepStructure(step);
        const statusIcon =
          stepData['status'] === 'completed' ? '✅' : stepData['status'] === 'failed' ? '❌' : '⏸️';
        sections.push(`### ${statusIcon} ${stepData['name'] || `Step ${index + 1}`}`);
        sections.push('');
        sections.push(`**Status:** ${stepData['status'] || 'Unknown'}`);
        sections.push(`**Duration:** ${stepData['duration'] || 'N/A'}`);
        if (stepData['message']) {
          sections.push(`**Message:** ${stepData['message']}`);
        }
        if (stepData['error']) {
          sections.push(`**Error:** ${stepData['error']}`);
        }
        sections.push('');
      });
    }

    return sections.join('\n');
  }

  private resultsToYaml(results: unknown): string {
    const resultsData = this.ensureResultsStructure(results);
    const lines = [
      'execution_results:',
      `  executionId: "${resultsData['executionId'] || 'N/A'}"`,
      `  status: "${resultsData['status'] || 'Unknown'}"`,
      `  duration: "${resultsData['duration'] || 'N/A'}"`,
      `  totalSteps: ${resultsData['totalSteps'] || 0}`,
      `  completedSteps: ${resultsData['completedSteps'] || 0}`,
      `  failedSteps: ${resultsData['failedSteps'] || 0}`,
      `  successRate: ${resultsData['successRate'] || 0}`,
      '  steps:',
    ];

    if (
      resultsData['steps'] &&
      Array.isArray(resultsData['steps']) &&
      (resultsData['steps'] as unknown[]).length > 0
    ) {
      (resultsData['steps'] as unknown[]).forEach((step: unknown, index: number) => {
        const stepData = this.ensureStepStructure(step);
        lines.push(`    - name: "${stepData['name'] || `Step ${index + 1}`}"`);
        lines.push(`      status: "${stepData['status'] || 'Unknown'}"`);
        lines.push(`      duration: "${stepData['duration'] || 'N/A'}"`);
        if (stepData['message']) {
          lines.push(`      message: "${stepData['message']}"`);
        }
        if (stepData['error']) {
          lines.push(`      error: "${stepData['error']}"`);
        }
      });
    }

    return lines.join('\n');
  }

  private resultsToText(results: unknown): string {
    const resultsData = this.ensureResultsStructure(results);
    const lines = [
      'EXECUTION RESULTS',
      '='.repeat(50),
      '',
      `Execution ID: ${resultsData['executionId'] || 'N/A'}`,
      `Status: ${resultsData['status'] || 'Unknown'}`,
      `Duration: ${resultsData['duration'] || 'N/A'}`,
      `Total Steps: ${resultsData['totalSteps'] || 0}`,
      `Completed Steps: ${resultsData['completedSteps'] || 0}`,
      `Failed Steps: ${resultsData['failedSteps'] || 0}`,
      `Success Rate: ${resultsData['successRate'] ? `${(Number(resultsData['successRate']) * 100).toFixed(1)  }%` : 'N/A'}`,
      '',
      'STEP DETAILS',
      '-'.repeat(20),
      '',
    ];

    if (
      resultsData['steps'] &&
      Array.isArray(resultsData['steps']) &&
      (resultsData['steps'] as unknown[]).length > 0
    ) {
      (resultsData['steps'] as unknown[]).forEach((step: unknown, index: number) => {
        const stepData = this.ensureStepStructure(step);
        const statusSymbol =
          stepData['status'] === 'completed'
            ? '[✓]'
            : stepData['status'] === 'failed'
              ? '[✗]'
              : '[?]';
        lines.push(`${statusSymbol} ${stepData['name'] || `Step ${index + 1}`}`);
        lines.push(`    Status: ${stepData['status'] || 'Unknown'}`);
        lines.push(`    Duration: ${stepData['duration'] || 'N/A'}`);
        if (stepData['message']) {
          lines.push(`    Message: ${stepData['message']}`);
        }
        if (stepData['error']) {
          lines.push(`    Error: ${stepData['error']}`);
        }
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  private chatToMarkdown(messages: unknown[]): string {
    const sections = [
      '# MARIA Chat Log',
      '',
      `**Generated:** ${new Date().toISOString()}`,
      `**Total Messages:** ${messages.length}`,
      '',
      '## Conversation',
      '',
    ];

    messages.forEach((message: unknown) => {
      const msgData = this.ensureMessageStructure(message);
      const timestamp = msgData['timestamp']
        ? new Date(msgData['timestamp'] as string).toLocaleString()
        : new Date().toLocaleString();
      const role = msgData['role'] ? String(msgData['role']).toUpperCase() : 'UNKNOWN';
      sections.push(`### ${role} - ${timestamp}`);
      sections.push('');
      sections.push(String(msgData['content'] || ''));
      sections.push('');
      sections.push('---');
      sections.push('');
    });

    return sections.join('\n');
  }

  private chatToText(messages: unknown[]): string {
    const lines = [
      'MARIA CHAT LOG',
      '='.repeat(50),
      '',
      `Generated: ${new Date().toISOString()}`,
      `Total Messages: ${messages.length}`,
      '',
      'CONVERSATION',
      '-'.repeat(20),
      '',
    ];

    messages.forEach((message: unknown) => {
      const messageData = this.ensureMessageStructure(message);
      const timestamp = messageData['timestamp']
        ? new Date(messageData['timestamp'] as string).toLocaleString()
        : new Date().toLocaleString();
      const role = messageData['role'] ? String(messageData['role']).toUpperCase() : 'UNKNOWN';
      lines.push(`[${timestamp}] ${role}:`);
      lines.push(String(messageData['content'] || ''));
      lines.push('');
      lines.push('-'.repeat(50));
      lines.push('');
    });

    return lines.join('\n');
  }

  private ensureSOWStructure(sow: SOWData): SOWData {
    // Since sow is already typed as SOWData, just return it
    return sow;
  }

  private ensureTaskStructure(task: SOWTask): SOWTask {
    // Since task is already typed as SOWTask, just return it
    return task;
  }

  private ensureResultsStructure(results: unknown): Record<string, unknown> {
    if (typeof results === 'object' && results !== null) {
      return results as Record<string, unknown>;
    }
    return {};
  }

  private ensureStepStructure(step: unknown): Record<string, unknown> {
    if (typeof step === 'object' && step !== null) {
      return step as Record<string, unknown>;
    }
    return {};
  }

  private ensureMessageStructure(message: unknown): Record<string, unknown> {
    if (typeof message === 'object' && message !== null) {
      return message as Record<string, unknown>;
    }
    return {};
  }
}

// Global instance
export const fileOutputManager = new FileOutputManager();

// Convenience functions
export const saveSOW = (sow: SOWData, options?: FileOutputOptions) =>
  fileOutputManager.saveSOW(sow, options);

export const saveExecutionResults = (results: unknown, options?: FileOutputOptions) =>
  fileOutputManager.saveExecutionResults(results, options);

export const saveChatLog = (messages: unknown[], options?: FileOutputOptions) =>
  fileOutputManager.saveChatLog(messages, options);
