"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MariaAnalyzer = void 0;
class MariaAnalyzer {
    constructor(aiEngine) {
        this.aiEngine = aiEngine;
    }
    async analyzeBugs(code, language) {
        try {
            const result = await this.aiEngine.analyzeCode(code, 'bugs', language);
            if (result && result.issues) {
                return result.issues.map((issue) => ({
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
        }
        catch (error) {
            console.error('Bug analysis failed:', error);
            return [];
        }
    }
    async analyzeLint(code, language) {
        try {
            const result = await this.aiEngine.analyzeCode(code, 'lint', language);
            if (result && result.issues) {
                return result.issues.map((issue) => ({
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
        }
        catch (error) {
            console.error('Lint analysis failed:', error);
            return [];
        }
    }
    async analyzeTypes(code, language) {
        try {
            const result = await this.aiEngine.analyzeCode(code, 'types', language);
            if (result && result.issues) {
                return result.issues.map((issue) => ({
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
        }
        catch (error) {
            console.error('Type analysis failed:', error);
            return [];
        }
    }
}
exports.MariaAnalyzer = MariaAnalyzer;
//# sourceMappingURL=MariaAnalyzer.js.map