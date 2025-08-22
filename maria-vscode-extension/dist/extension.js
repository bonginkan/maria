"use strict";
/**
 * MARIA AI Assistant VS Code Extension
 * Main extension entry point implementing Language Server Protocol
 * and WebView integration for AI-powered development assistance
 */
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
const MariaCommands_1 = require("./commands/MariaCommands");
const MariaStatusBar_1 = require("./ui/MariaStatusBar");
const MariaTreeViewProvider_1 = require("./ui/MariaTreeViewProvider");
const MariaDiagnosticProvider_1 = require("./diagnostics/MariaDiagnosticProvider");
const MariaCodeActionProvider_1 = require("./actions/MariaCodeActionProvider");
// import { LicenseValidator } from './license/LicenseValidator'; // Disabled for guest mode
// import { MariaTelemetry } from './telemetry/MariaTelemetry'; // Disabled for guest mode
let client;
let statusBar;
// let telemetry: MariaTelemetry; // Disabled for guest mode
/**
 * Extension activation function
 * Called when VS Code activates the extension
 */
async function activate(context) {
    console.log('MARIA AI Assistant is activating...');
    try {
        // Initialize telemetry (simplified for guest mode)
        console.log('Telemetry disabled in guest mode');
        // Check for Pro license
        const proLicense = vscode.workspace.getConfiguration('maria').get('proLicense', '');
        const licenseInfo = proLicense
            ? { tier: 'pro', features: ['all-features', 'advanced-ai', 'priority-support'] }
            : { tier: 'free', features: ['basic-code-generation', 'chat-interface', 'diagnostics'] };
        // Initialize Language Server Client (simplified for guest mode)
        console.log('Skipping Language Server initialization in guest mode');
        // Initialize WebView Chat Interface
        initializeWebViewProvider(context);
        // Initialize Status Bar
        statusBar = new MariaStatusBar_1.MariaStatusBar();
        context.subscriptions.push(statusBar);
        // Initialize Tree View Provider
        initializeTreeViewProvider(context);
        // Initialize Diagnostic Provider
        initializeDiagnosticProvider(context);
        // Initialize Code Actions Provider
        initializeCodeActionProvider(context);
        // Register Commands
        registerCommands(context, licenseInfo);
        // Show welcome message for first-time users
        await showWelcomeMessage(context, licenseInfo);
        console.log(`MARIA CODE activated successfully (${licenseInfo.tier} mode)`);
    }
    catch (error) {
        console.error('Failed to activate MARIA AI Assistant:', error);
        vscode.window.showErrorMessage('Failed to activate MARIA AI Assistant. Please check your configuration.');
    }
}
exports.activate = activate;
/**
 * Initialize Language Server Protocol client
 */
async function initializeLanguageServer(context) {
    // Language Server executable path
    const serverModule = context.asAbsolutePath(path.join('dist', 'server', 'mariaLanguageServer.js'));
    // Server options for both run and debug modes
    const serverOptions = {
        run: { module: serverModule, transport: node_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: node_1.TransportKind.ipc,
            options: { execArgv: ['--nolazy', '--inspect=6009'] }
        }
    };
    // Client options for language server communication
    const clientOptions = {
        // Document selector - apply to all file types
        documentSelector: [
            { scheme: 'file', language: '*' },
            { scheme: 'untitled', language: '*' }
        ],
        // Synchronize configuration changes
        synchronize: {
            configurationSection: 'maria',
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.mariarc')
        },
        // Output channel for debugging
        outputChannelName: 'MARIA Language Server'
    };
    // Create and start the language client
    client = new node_1.LanguageClient('maria', 'MARIA AI Language Server', serverOptions, clientOptions);
    // Start the client and language server
    await client.start();
    // Wait for server to be ready
    console.log('MARIA Language Server is ready');
}
/**
 * Initialize WebView provider for chat interface
 */
function initializeWebViewProvider(context) {
    const provider = new MariaWebviewProvider_1.MariaWebviewProvider(context.extensionUri);
    // Register webview view provider
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('maria.chatView', provider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    }));
}
/**
 * Initialize Tree View provider for project structure
 */
function initializeTreeViewProvider(context) {
    const treeProvider = new MariaTreeViewProvider_1.MariaTreeViewProvider();
    // Register tree data provider
    context.subscriptions.push(vscode.window.registerTreeDataProvider('maria.projectView', treeProvider));
    // Register tree view commands
    context.subscriptions.push(vscode.commands.registerCommand('maria.refreshProjectView', () => {
        treeProvider.refresh();
    }));
}
/**
 * Initialize diagnostic provider for code analysis
 */
function initializeDiagnosticProvider(context) {
    const diagnosticProvider = new MariaDiagnosticProvider_1.MariaDiagnosticProvider();
    context.subscriptions.push(diagnosticProvider);
    // Update diagnostics on file changes
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
        if (vscode.workspace.getConfiguration('maria').get('enableDiagnostics')) {
            diagnosticProvider.updateDiagnostics(event.document);
        }
    }));
    // Update diagnostics on file open
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
        if (vscode.workspace.getConfiguration('maria').get('enableDiagnostics')) {
            diagnosticProvider.updateDiagnostics(document);
        }
    }));
}
/**
 * Initialize code actions provider for quick fixes
 */
function initializeCodeActionProvider(context) {
    const codeActionProvider = new MariaCodeActionProvider_1.MariaCodeActionProvider();
    // Register code actions provider for all languages
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider({ scheme: 'file' }, codeActionProvider, {
        providedCodeActionKinds: [
            vscode.CodeActionKind.QuickFix,
            vscode.CodeActionKind.Refactor,
            vscode.CodeActionKind.Source
        ]
    }));
}
/**
 * Register all extension commands
 */
function registerCommands(context, licenseInfo) {
    const commands = new MariaCommands_1.MariaCommands(licenseInfo, null); // No telemetry in guest mode
    // Core commands
    context.subscriptions.push(vscode.commands.registerCommand('maria.generateCode', commands.generateCode.bind(commands)));
    context.subscriptions.push(vscode.commands.registerCommand('maria.analyzeBugs', commands.analyzeBugs.bind(commands)));
    context.subscriptions.push(vscode.commands.registerCommand('maria.lintAnalysis', commands.lintAnalysis.bind(commands)));
    context.subscriptions.push(vscode.commands.registerCommand('maria.typecheckAnalysis', commands.typecheckAnalysis.bind(commands)));
    context.subscriptions.push(vscode.commands.registerCommand('maria.securityReview', commands.securityReview.bind(commands)));
    context.subscriptions.push(vscode.commands.registerCommand('maria.paperProcessing', commands.paperProcessing.bind(commands)));
    // UI commands
    context.subscriptions.push(vscode.commands.registerCommand('maria.openChat', commands.openChat.bind(commands)));
    context.subscriptions.push(vscode.commands.registerCommand('maria.showStatus', commands.showStatus.bind(commands)));
    context.subscriptions.push(vscode.commands.registerCommand('maria.listModels', commands.listModels.bind(commands)));
    context.subscriptions.push(vscode.commands.registerCommand('maria.switchMode', commands.switchMode.bind(commands)));
}
/**
 * Show welcome message for new users
 */
async function showWelcomeMessage(context, licenseInfo) {
    const hasShownWelcome = context.globalState.get('maria.hasShownWelcome', false);
    if (!hasShownWelcome) {
        const action = await vscode.window.showInformationMessage('Welcome to MARIA AI Assistant! Your intelligent development companion is ready.', 'Open Chat', 'View Commands', 'Don\'t show again');
        switch (action) {
            case 'Open Chat':
                vscode.commands.executeCommand('maria.openChat');
                break;
            case 'View Commands':
                vscode.commands.executeCommand('workbench.action.showCommands', 'MARIA:');
                break;
            case 'Don\'t show again':
                context.globalState.update('maria.hasShownWelcome', true);
                break;
        }
    }
    // Show license tier information
    if (licenseInfo.tier === 'free') {
        const upgradeAction = await vscode.window.showInformationMessage('MARIA CODE is ready! Upgrade to Pro for advanced AI features.', 'Get Pro License', 'Learn More', 'Dismiss');
        if (upgradeAction === 'Get Pro License') {
            vscode.env.openExternal(vscode.Uri.parse('https://bonginkan.ai/maria-pro'));
        }
        else if (upgradeAction === 'Learn More') {
            vscode.env.openExternal(vscode.Uri.parse('https://bonginkan.ai/maria-features'));
        }
    }
    else if (licenseInfo.tier === 'pro') {
        vscode.window.showInformationMessage('🎉 MARIA CODE Pro is active! All advanced features unlocked.');
    }
}
/**
 * Extension deactivation function
 * Called when VS Code deactivates the extension
 */
async function deactivate() {
    console.log('MARIA AI Assistant is deactivating...');
    try {
        // Stop language server client
        if (client) {
            await client.stop();
        }
        // Dispose status bar
        if (statusBar) {
            statusBar.dispose();
        }
        // Guest mode deactivation
        console.log('Guest mode deactivation - no telemetry');
        console.log('MARIA AI Assistant deactivated successfully');
    }
    catch (error) {
        console.error('Error during deactivation:', error);
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map