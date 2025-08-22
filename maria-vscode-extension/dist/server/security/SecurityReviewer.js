"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MariaSecurityReviewer = void 0;
class MariaSecurityReviewer {
    constructor(aiEngine) {
        this.aiEngine = aiEngine;
    }
    async analyze(code, language) {
        try {
            const result = await this.aiEngine.analyzeCode(code, 'security', language);
            if (result && result.issues) {
                return result.issues.map((issue) => ({
                    start: issue.start || 0,
                    end: issue.end || 0,
                    message: issue.message,
                    severity: issue.severity || 'medium',
                    cwe: issue.cwe,
                    owasp: issue.owasp,
                    recommendation: issue.recommendation
                }));
            }
            // Also check for common security patterns
            const patterns = this.checkSecurityPatterns(code, language);
            return patterns;
        }
        catch (error) {
            console.error('Security analysis failed:', error);
            return [];
        }
    }
    checkSecurityPatterns(code, language) {
        const issues = [];
        // Check for hardcoded secrets
        const secretPatterns = [
            /api[_-]?key\s*=\s*["'][^"']+["']/gi,
            /password\s*=\s*["'][^"']+["']/gi,
            /secret\s*=\s*["'][^"']+["']/gi,
            /token\s*=\s*["'][^"']+["']/gi
        ];
        for (const pattern of secretPatterns) {
            const matches = code.matchAll(pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    issues.push({
                        start: match.index,
                        end: match.index + match[0].length,
                        message: 'Potential hardcoded secret detected',
                        severity: 'critical',
                        cwe: 'CWE-798',
                        owasp: 'A02:2021',
                        recommendation: 'Use environment variables or secure key management systems'
                    });
                }
            }
        }
        // SQL Injection patterns
        if (language === 'javascript' || language === 'typescript') {
            const sqlPatterns = [
                /query\s*\(\s*['"`].*\$\{.*\}.*['"`]\s*\)/gi,
                /query\s*\(\s*['"`].*\+.*['"`]\s*\)/gi
            ];
            for (const pattern of sqlPatterns) {
                const matches = code.matchAll(pattern);
                for (const match of matches) {
                    if (match.index !== undefined) {
                        issues.push({
                            start: match.index,
                            end: match.index + match[0].length,
                            message: 'Potential SQL injection vulnerability',
                            severity: 'high',
                            cwe: 'CWE-89',
                            owasp: 'A03:2021',
                            recommendation: 'Use parameterized queries or prepared statements'
                        });
                    }
                }
            }
        }
        // XSS patterns
        const xssPatterns = [
            /innerHTML\s*=\s*[^;]+/gi,
            /document\.write\s*\([^)]+\)/gi,
            /eval\s*\([^)]+\)/gi
        ];
        for (const pattern of xssPatterns) {
            const matches = code.matchAll(pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    issues.push({
                        start: match.index,
                        end: match.index + match[0].length,
                        message: 'Potential XSS vulnerability',
                        severity: 'high',
                        cwe: 'CWE-79',
                        owasp: 'A03:2021',
                        recommendation: 'Sanitize user input and use safe DOM manipulation methods'
                    });
                }
            }
        }
        return issues;
    }
}
exports.MariaSecurityReviewer = MariaSecurityReviewer;
//# sourceMappingURL=SecurityReviewer.js.map