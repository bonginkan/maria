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
exports.MariaCommandManager = void 0;
const vscode = __importStar(require("vscode"));
class MariaCommandManager {
    constructor(context, client, configManager, licenseStatus, telemetry) {
        this.context = context;
        this.client = client;
        this.configManager = configManager;
        this.licenseStatus = licenseStatus;
        this.telemetry = telemetry;
    }
    async registerCommands() {
        // Register all MARIA commands
        const commands = [
            {
                name: 'maria.generateCode',
                handler: this.generateCode.bind(this)
            },
            {
                name: 'maria.analyzeBugs',
                handler: this.analyzeBugs.bind(this)
            },
            {
                name: 'maria.runLint',
                handler: this.runLint.bind(this)
            },
            {
                name: 'maria.typeCheck',
                handler: this.typeCheck.bind(this)
            },
            {
                name: 'maria.securityReview',
                handler: this.securityReview.bind(this)
            },
            {
                name: 'maria.openChat',
                handler: this.openChat.bind(this)
            },
            {
                name: 'maria.switchProvider',
                handler: this.switchProvider.bind(this)
            },
            {
                name: 'maria.toggleInternalMode',
                handler: this.toggleInternalMode.bind(this)
            },
            {
                name: 'maria.showDocumentation',
                handler: this.showDocumentation.bind(this)
            },
            {
                name: 'maria.validateLicense',
                handler: this.validateLicense.bind(this)
            },
            {
                name: 'maria.chat',
                handler: this.chat.bind(this)
            }
        ];
        for (const command of commands) {
            const disposable = vscode.commands.registerCommand(command.name, command.handler);
            this.context.subscriptions.push(disposable);
        }
    }
    async generateCode() {
        const prompt = await vscode.window.showInputBox({
            prompt: 'Describe what code you want to generate',
            placeHolder: 'e.g., Create a REST API endpoint for user authentication'
        });
        if (!prompt) {
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'MARIA: Generating code...',
                cancellable: false
            }, async () => {
                const result = await this.client.sendRequest('maria.generateCode', {
                    prompt,
                    language: editor.document.languageId
                });
                if (result && typeof result === 'string') {
                    editor.edit(editBuilder => {
                        editBuilder.insert(editor.selection.active, result);
                    });
                }
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to generate code: ${error}`);
        }
    }
    async analyzeBugs() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        const selection = editor.selection;
        const text = selection.isEmpty
            ? editor.document.getText()
            : editor.document.getText(selection);
        try {
            const result = await this.client.sendRequest('maria.analyzeBugs', {
                code: text,
                language: editor.document.languageId
            });
            // Show results in output channel
            const outputChannel = vscode.window.createOutputChannel('MARIA Bug Analysis');
            outputChannel.clear();
            outputChannel.appendLine('MARIA Bug Analysis Results');
            outputChannel.appendLine('='.repeat(50));
            outputChannel.appendLine(JSON.stringify(result, null, 2));
            outputChannel.show();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to analyze bugs: ${error}`);
        }
    }
    async runLint() {
        vscode.window.showInformationMessage('MARIA: Running lint analysis...');
        // Implementation will be connected to existing MARIA lint service
    }
    async typeCheck() {
        vscode.window.showInformationMessage('MARIA: Running type check...');
        // Implementation will be connected to existing MARIA type check service
    }
    async securityReview() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        try {
            const result = await this.client.sendRequest('maria.securityReview', {
                code: editor.document.getText(),
                language: editor.document.languageId
            });
            // Show security results
            const outputChannel = vscode.window.createOutputChannel('MARIA Security Review');
            outputChannel.clear();
            outputChannel.appendLine('MARIA Security Review Results');
            outputChannel.appendLine('='.repeat(50));
            outputChannel.appendLine(JSON.stringify(result, null, 2));
            outputChannel.show();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Security review failed: ${error}`);
        }
    }
    async openChat() {
        // Focus on the chat view
        await vscode.commands.executeCommand('maria.chatView.focus');
    }
    async switchProvider() {
        const providers = ['openai', 'anthropic', 'google', 'groq', 'local'];
        const selected = await vscode.window.showQuickPick(providers, {
            placeHolder: 'Select AI provider'
        });
        if (selected) {
            await this.configManager.update('provider', selected);
            vscode.window.showInformationMessage(`Switched to ${selected} provider`);
        }
    }
    async toggleInternalMode() {
        const currentState = this.configManager.get('enableInternalModes');
        await this.configManager.update('enableInternalModes', !currentState);
        vscode.window.showInformationMessage(`Internal modes ${!currentState ? 'enabled' : 'disabled'}`);
    }
    async showDocumentation() {
        const panel = vscode.window.createWebviewPanel('mariaDocumentation', 'MARIA Documentation', vscode.ViewColumn.One, {
            enableScripts: true
        });
        panel.webview.html = this.getDocumentationHtml();
    }
    async validateLicense() {
        vscode.window.showInformationMessage('Validating license...');
        // Will be connected to license validation service
    }
    async chat(message, history) {
        try {
            const result = await this.client.sendRequest('maria.chat', {
                message,
                history
            });
            return result;
        }
        catch (error) {
            throw error;
        }
    }
    async provideCodeActions(document, range, context) {
        const actions = [];
        // Quick fix for diagnostics
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source?.startsWith('MARIA')) {
                const action = new vscode.CodeAction(`Fix: ${diagnostic.message}`, vscode.CodeActionKind.QuickFix);
                action.diagnostics = [diagnostic];
                action.isPreferred = true;
                actions.push(action);
            }
        }
        return actions;
    }
    provideCompletions() {
        const completions = [
            {
                label: '/code',
                kind: vscode.CompletionItemKind.Keyword,
                detail: 'Generate code with MARIA',
                documentation: 'Generate code based on natural language description',
                insertText: 'code '
            },
            {
                label: '/bug',
                kind: vscode.CompletionItemKind.Keyword,
                detail: 'Analyze bugs',
                documentation: 'Analyze code for potential bugs and issues',
                insertText: 'bug'
            },
            {
                label: '/lint',
                kind: vscode.CompletionItemKind.Keyword,
                detail: 'Run lint analysis',
                documentation: 'Check code style and quality issues',
                insertText: 'lint'
            },
            {
                label: '/typecheck',
                kind: vscode.CompletionItemKind.Keyword,
                detail: 'Type check',
                documentation: 'Analyze type safety',
                insertText: 'typecheck'
            },
            {
                label: '/security',
                kind: vscode.CompletionItemKind.Keyword,
                detail: 'Security review',
                documentation: 'Review code for security vulnerabilities',
                insertText: 'security'
            }
        ];
        return completions;
    }
    getDocumentationHtml() {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>MARIA Documentation</title>
        <style>
          body { 
            font-family: system-ui, -apple-system, sans-serif;
            padding: 20px;
            line-height: 1.6;
          }
          h1 { color: #00bcd4; }
          h2 { color: #4caf50; }
          code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
          }
          pre {
            background: #f4f4f4;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        <h1>MARIA AI Assistant Documentation</h1>
        
        <h2>Getting Started</h2>
        <p>MARIA AI Assistant provides intelligent code assistance directly in VS Code.</p>
        
        <h2>Commands</h2>
        <ul>
          <li><code>Cmd+Shift+M</code> - Open chat interface</li>
          <li><code>Cmd+Shift+G</code> - Generate code</li>
          <li><code>/code</code> - Generate code from description</li>
          <li><code>/bug</code> - Analyze bugs</li>
          <li><code>/security</code> - Security review</li>
        </ul>
        
        <h2>Configuration</h2>
        <pre>
{
  "maria.apiKey": "your-api-key",
  "maria.provider": "openai",
  "maria.enableDiagnostics": true
}
        </pre>
        
        <h2>Support</h2>
        <p>For more information, visit <a href="https://maria.bonginkan.ai">maria.bonginkan.ai</a></p>
      </body>
      </html>
    `;
    }
}
exports.MariaCommandManager = MariaCommandManager;
//# sourceMappingURL=CommandManager.js.map