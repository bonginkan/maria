import { MariaAIEngine } from '../ai/MariaAIEngine';
export interface SecurityIssue {
    start: number;
    end: number;
    message: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    cwe?: string;
    owasp?: string;
    recommendation?: string;
}
export declare class MariaSecurityReviewer {
    private aiEngine;
    constructor(aiEngine: MariaAIEngine);
    analyze(code: string, language: string): Promise<SecurityIssue[]>;
    private checkSecurityPatterns;
}
//# sourceMappingURL=SecurityReviewer.d.ts.map