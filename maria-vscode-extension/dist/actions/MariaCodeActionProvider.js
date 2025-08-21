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
exports.MariaCodeActionProvider = void 0;
const vscode = __importStar(require("vscode"));
class MariaCodeActionProvider {
    provideCodeActions(document, range, context, token) {
        const actions = [];
        // Create quick fix actions for diagnostics
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source === 'MARIA' || diagnostic.source === 'MARIA Security') {
                const action = new vscode.CodeAction(`Fix: ${diagnostic.message}`, vscode.CodeActionKind.QuickFix);
                action.diagnostics = [diagnostic];
                actions.push(action);
            }
        }
        // Add refactoring actions
        if (!range.isEmpty) {
            const extractAction = new vscode.CodeAction('MARIA: Extract Method', vscode.CodeActionKind.RefactorExtract);
            extractAction.command = {
                command: 'maria.refactorExtract',
                title: 'Extract Method',
                arguments: [document, range]
            };
            actions.push(extractAction);
            const improveAction = new vscode.CodeAction('MARIA: Improve Code', vscode.CodeActionKind.RefactorRewrite);
            improveAction.command = {
                command: 'maria.improveCode',
                title: 'Improve Code',
                arguments: [document, range]
            };
            actions.push(improveAction);
        }
        // Add source action
        const organizeAction = new vscode.CodeAction('MARIA: Organize and Clean', vscode.CodeActionKind.Source);
        organizeAction.command = {
            command: 'maria.organizeCode',
            title: 'Organize Code'
        };
        actions.push(organizeAction);
        return actions;
    }
}
exports.MariaCodeActionProvider = MariaCodeActionProvider;
//# sourceMappingURL=MariaCodeActionProvider.js.map