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
exports.MariaCommands = void 0;
const vscode = __importStar(require("vscode"));
class MariaCommands {
    constructor(licenseInfo, telemetry) {
        this.licenseInfo = licenseInfo;
        this.telemetry = telemetry;
    }
    async generateCode() {
        const input = await vscode.window.showInputBox({
            prompt: 'Describe the code you want to generate',
            placeHolder: 'e.g., Create a REST API endpoint'
        });
        if (input) {
            vscode.window.showInformationMessage(`Generating code for: ${input}`);
            // TODO: Implement actual code generation
        }
    }
    async analyzeBugs() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            vscode.window.showInformationMessage('Analyzing code for bugs...');
            // TODO: Implement bug analysis
        }
        else {
            vscode.window.showWarningMessage('No active editor found');
        }
    }
    async lintAnalysis() {
        vscode.window.showInformationMessage('Running lint analysis...');
        // TODO: Implement lint analysis
    }
    async typecheckAnalysis() {
        vscode.window.showInformationMessage('Running type check...');
        // TODO: Implement type checking
    }
    async securityReview() {
        vscode.window.showInformationMessage('Running security review...');
        // TODO: Implement security review
    }
    async paperProcessing() {
        const uri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Documents': ['pdf', 'txt', 'md']
            }
        });
        if (uri && uri[0]) {
            vscode.window.showInformationMessage(`Processing paper: ${uri[0].fsPath}`);
            // TODO: Implement paper processing
        }
    }
    async openChat() {
        await vscode.commands.executeCommand('maria.chatView.focus');
    }
    async showStatus() {
        const quickPick = vscode.window.createQuickPick();
        quickPick.items = [
            { label: 'MARIA Status', description: 'Active' },
            { label: 'License', description: this.licenseInfo.tier },
            { label: 'Features', description: this.licenseInfo.features.join(', ') }
        ];
        quickPick.title = 'MARIA System Status';
        quickPick.show();
    }
    async listModels() {
        const models = ['GPT-4', 'Claude', 'Gemini', 'Local LLM'];
        const selected = await vscode.window.showQuickPick(models, {
            placeHolder: 'Select an AI model'
        });
        if (selected) {
            vscode.window.showInformationMessage(`Selected model: ${selected}`);
        }
    }
    async switchMode() {
        const modes = ['Thinking', 'Debugging', 'Optimizing', 'Brainstorming'];
        const selected = await vscode.window.showQuickPick(modes, {
            placeHolder: 'Select internal mode'
        });
        if (selected) {
            vscode.window.showInformationMessage(`Switched to ${selected} mode`);
        }
    }
}
exports.MariaCommands = MariaCommands;
//# sourceMappingURL=MariaCommands.js.map