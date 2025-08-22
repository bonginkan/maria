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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const node_1 = require("vscode-languageclient/node");
const MariaWebviewProvider_1 = require("./webview/MariaWebviewProvider");
const CommandManager_1 = require("./commands/CommandManager");
const StatusBar_1 = require("./statusbar/StatusBar");
const DiagnosticProvider_1 = require("./diagnostics/DiagnosticProvider");
const ConfigurationManager_1 = require("./config/ConfigurationManager");
const LicenseManager_1 = require("./license/LicenseManager");
const Telemetry_1 = require("./telemetry/Telemetry");
let client;
let statusBar;
let diagnosticProvider;
let telemetry;
async function activate(context) {
    console.log('MARIA AI Assistant is activating...');
    // Initialize telemetry
    telemetry = new Telemetry_1.MariaTelemetry(context);
    telemetry.trackEvent('extension-activated');
    // Initialize configuration manager
    const configManager = new ConfigurationManager_1.MariaConfigurationManager();
    await configManager.initialize();
    // Initialize license manager
    const licenseManager = new LicenseManager_1.MariaLicenseManager(configManager);
    const licenseStatus = await licenseManager.validateLicense();
    // Initialize status bar
    statusBar = new StatusBar_1.MariaStatusBar(context);
    statusBar.update('Initializing MARIA...', 'loading');
    // Setup Language Server
    const serverModule = context.asAbsolutePath(path.join('dist', 'server', 'server.js'));
    const serverOptions = {
        run: {
            module: serverModule,
            transport: node_1.TransportKind.ipc
        },
        debug: {
            module: serverModule,
            transport: node_1.TransportKind.ipc,
            options: {
                execArgv: ['--nolazy', '--inspect=6009']
            }
        }
    };
    const clientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'javascript' },
            { scheme: 'file', language: 'typescript' },
            { scheme: 'file', language: 'javascriptreact' },
            { scheme: 'file', language: 'typescriptreact' },
            { scheme: 'file', language: 'python' },
            { scheme: 'file', language: 'java' },
            { scheme: 'file', language: 'csharp' },
            { scheme: 'file', language: 'cpp' },
            { scheme: 'file', language: 'c' },
            { scheme: 'file', language: 'go' },
            { scheme: 'file', language: 'rust' }
        ],
        synchronize: {
            configurationSection: 'maria',
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.*')
        }
    };
    // Create and start the language client
    client = new node_1.LanguageClient('maria-language-server', 'MARIA Language Server', serverOptions, clientOptions);
    // Start the client
    await client.start();
    // Initialize WebView provider for chat interface
    const webviewProvider = new MariaWebviewProvider_1.MariaWebviewProvider(context.extensionUri, configManager, licenseStatus);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('maria.chatView', webviewProvider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    }));
    // Initialize command manager and register commands
    const commandManager = new CommandManager_1.MariaCommandManager(context, client, configManager, licenseStatus, telemetry);
    await commandManager.registerCommands();
    // Initialize diagnostic provider
    diagnosticProvider = new DiagnosticProvider_1.MariaDiagnosticProvider(client);
    await diagnosticProvider.initialize();
    // Register code actions provider
    const codeActionProvider = vscode.languages.registerCodeActionsProvider(clientOptions.documentSelector, {
        provideCodeActions: async (document, range, context) => {
            return await commandManager.provideCodeActions(document, range, context);
        }
    }, {
        providedCodeActionKinds: [
            vscode.CodeActionKind.QuickFix,
            vscode.CodeActionKind.Refactor,
            vscode.CodeActionKind.RefactorExtract,
            vscode.CodeActionKind.RefactorInline,
            vscode.CodeActionKind.RefactorRewrite,
            vscode.CodeActionKind.Source
        ]
    });
    context.subscriptions.push(codeActionProvider);
    // Register completion provider
    const completionProvider = vscode.languages.registerCompletionItemProvider(clientOptions.documentSelector, {
        async provideCompletionItems(document, position) {
            const linePrefix = document.lineAt(position).text.substr(0, position.character);
            // Trigger MARIA completions with /
            if (linePrefix.endsWith('/')) {
                return commandManager.provideCompletions();
            }
            return undefined;
        }
    }, '/' // Trigger character
    );
    context.subscriptions.push(completionProvider);
    // Setup workspace change listeners
    vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('maria')) {
            await configManager.reload();
            statusBar.update('Configuration updated', 'info');
            telemetry.trackEvent('configuration-changed');
        }
    });
    // Setup document change listeners for real-time diagnostics
    if (configManager.get('enableDiagnostics')) {
        let diagnosticTimeout;
        vscode.workspace.onDidChangeTextDocument((e) => {
            clearTimeout(diagnosticTimeout);
            diagnosticTimeout = setTimeout(async () => {
                await diagnosticProvider.updateDiagnostics(e.document);
            }, configManager.get('diagnosticDelay') || 500);
        });
    }
    // Update status bar
    statusBar.update('MARIA Ready', 'ready');
    // Show welcome message
    const welcomeMessage = licenseStatus.isEnterprise
        ? 'MARIA AI Assistant (Enterprise) activated successfully!'
        : 'MARIA AI Assistant activated successfully!';
    vscode.window.showInformationMessage(welcomeMessage, 'Open Chat', 'View Documentation')
        .then(selection => {
        if (selection === 'Open Chat') {
            vscode.commands.executeCommand('maria.openChat');
        }
        else if (selection === 'View Documentation') {
            vscode.commands.executeCommand('maria.showDocumentation');
        }
    });
    console.log('MARIA AI Assistant activated successfully');
}
exports.activate = activate;
function deactivate() {
    console.log('MARIA AI Assistant is deactivating...');
    // Track deactivation
    telemetry?.trackEvent('extension-deactivated');
    telemetry?.dispose();
    // Clean up status bar
    statusBar?.dispose();
    // Clean up diagnostic provider
    diagnosticProvider?.dispose();
    // Stop the language client
    if (!client) {
        return undefined;
    }
    return client.stop();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map