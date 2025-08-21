import { MariaAIEngine } from '../ai/MariaAIEngine';

export interface AnalysisIssue {
  start: number;
  end: number;
  line?: number;
  column?: number;
  message: string;
  code?: string;
  severity?: 'error' | 'warning' | 'info';
}

export class MariaAnalyzer {
  private aiEngine: MariaAIEngine;
  
  constructor(aiEngine: MariaAIEngine) {
    this.aiEngine = aiEngine;
  }
  
  async analyzeBugs(code: string, language: string): Promise<AnalysisIssue[]> {
    try {
      const result = await this.aiEngine.analyzeCode(code, 'bugs', language);
      
      if (result && result.issues) {
        return result.issues.map((issue: any) => ({
          start: issue.start || 0,
          end: issue.end || 0,
          line: issue.line,
          column: issue.column,
          message: issue.message,
          code: issue.code,
          severity: 'error'
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Bug analysis failed:', error);
      return [];
    }
  }
  
  async analyzeLint(code: string, language: string): Promise<AnalysisIssue[]> {
    try {
      const result = await this.aiEngine.analyzeCode(code, 'lint', language);
      
      if (result && result.issues) {
        return result.issues.map((issue: any) => ({
          start: issue.start || 0,
          end: issue.end || 0,
          line: issue.line,
          column: issue.column,
          message: issue.message,
          code: issue.code,
          severity: 'warning'
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Lint analysis failed:', error);
      return [];
    }
  }
  
  async analyzeTypes(code: string, language: string): Promise<AnalysisIssue[]> {
    try {
      const result = await this.aiEngine.analyzeCode(code, 'types', language);
      
      if (result && result.issues) {
        return result.issues.map((issue: any) => ({
          start: issue.start || 0,
          end: issue.end || 0,
          line: issue.line,
          column: issue.column,
          message: issue.message,
          code: issue.code,
          severity: 'error'
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Type analysis failed:', error);
      return [];
    }
  }
}