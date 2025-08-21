"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MariaDiagnosticProvider = void 0;
const vscode = __importStar(require("vscode"));
class MariaDiagnosticProvider {
    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('maria');
    }
    updateDiagnostics(document) {
        const diagnostics = [];
        // Simple example: detect TODO comments
        const text = document.getText();
        const lines = text.split('\n');
        lines.forEach((line, i) => {
            const todoMatch = line.match(/TODO|FIXME|HACK/gi);
            if (todoMatch) {
                const index = line.indexOf(todoMatch[0]);
                const range = new vscode.Range(i, index, i, index + todoMatch[0].length);
                const diagnostic = new vscode.Diagnostic(range, `${todoMatch[0]} comment found`, vscode.DiagnosticSeverity.Information);
                diagnostic.source = 'MARIA';
                diagnostics.push(diagnostic);
            }
            // Simple security check
            if (line.match(/password\s*=\s*["'][^"']+["']/i)) {
                const range = new vscode.Range(i, 0, i, line.length);
                const diagnostic = new vscode.Diagnostic(range, 'Potential hardcoded password detected', vscode.DiagnosticSeverity.Warning);
                diagnostic.source = 'MARIA Security';
                diagnostics.push(diagnostic);
            }
        });
        this.diagnosticCollection.set(document.uri, diagnostics);
    }
    clearDiagnostics() {
        this.diagnosticCollection.clear();
    }
    dispose() {
        this.diagnosticCollection.dispose();
    }
}
exports.MariaDiagnosticProvider = MariaDiagnosticProvider;
//# sourceMappingURL=MariaDiagnosticProvider.js.map