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
export declare class MariaAnalyzer {
    private aiEngine;
    constructor(aiEngine: MariaAIEngine);
    analyzeBugs(code: string, language: string): Promise<AnalysisIssue[]>;
    analyzeLint(code: string, language: string): Promise<AnalysisIssue[]>;
    analyzeTypes(code: string, language: string): Promise<AnalysisIssue[]>;
}
//# sourceMappingURL=MariaAnalyzer.d.ts.map