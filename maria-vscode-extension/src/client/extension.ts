import * as vscode from 'vscode';
import * as path from 'path';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';
import { MariaWebviewProvider } from './webview/MariaWebviewProvider';
import { MariaCommandManager } from './commands/CommandManager';
import { MariaStatusBar } from './statusbar/StatusBar';
import { MariaDiagnosticProvider } from './diagnostics/DiagnosticProvider';
import { MariaConfigurationManager } from './config/ConfigurationManager';
import { MariaLicenseManager } from './license/LicenseManager';
import { MariaTelemetry } from './telemetry/Telemetry';

let client: LanguageClient;
let statusBar: MariaStatusBar;
let diagnosticProvider: MariaDiagnosticProvider;
let telemetry: MariaTelemetry;

export async function activate(context: vscode.ExtensionContext) {
  console.log('MARIA AI Assistant is activating...');
  
  // Initialize telemetry
  telemetry = new MariaTelemetry(context);
  telemetry.trackEvent('extension-activated');
  
  // Initialize configuration manager
  const configManager = new MariaConfigurationManager();
  await configManager.initialize();
  
  // Initialize license manager
  const licenseManager = new MariaLicenseManager(configManager);
  const licenseStatus = await licenseManager.validateLicense();
  
  // Initialize status bar
  statusBar = new MariaStatusBar(context);
  statusBar.update('Initializing MARIA...', 'loading');
  
  // Setup Language Server
  const serverModule = context.asAbsolutePath(
    path.join('dist', 'server', 'server.js')
  );
  
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009']
      }
    }
  };
  
  const clientOptions: LanguageClientOptions = {
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
  client = new LanguageClient(
    'maria-language-server',
    'MARIA Language Server',
    serverOptions,
    clientOptions
  );
  
  // Start the client
  await client.start();
  
  // Initialize WebView provider for chat interface
  const webviewProvider = new MariaWebviewProvider(
    context.extensionUri,
    configManager,
    licenseStatus
  );
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'maria.chatView',
      webviewProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );
  
  // Initialize command manager and register commands
  const commandManager = new MariaCommandManager(
    context,
    client,
    configManager,
    licenseStatus,
    telemetry
  );
  
  await commandManager.registerCommands();
  
  // Initialize diagnostic provider
  diagnosticProvider = new MariaDiagnosticProvider(client);
  await diagnosticProvider.initialize();
  
  // Register code actions provider
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    clientOptions.documentSelector!,
    {
      provideCodeActions: async (document, range, context) => {
        return await commandManager.provideCodeActions(document, range, context);
      }
    },
    {
      providedCodeActionKinds: [
        vscode.CodeActionKind.QuickFix,
        vscode.CodeActionKind.Refactor,
        vscode.CodeActionKind.RefactorExtract,
        vscode.CodeActionKind.RefactorInline,
        vscode.CodeActionKind.RefactorRewrite,
        vscode.CodeActionKind.Source
      ]
    }
  );
  
  context.subscriptions.push(codeActionProvider);
  
  // Register completion provider
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    clientOptions.documentSelector!,
    {
      async provideCompletionItems(document, position) {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        
        // Trigger MARIA completions with /
        if (linePrefix.endsWith('/')) {
          return commandManager.provideCompletions();
        }
        
        return undefined;
      }
    },
    '/' // Trigger character
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
    let diagnosticTimeout: NodeJS.Timeout;
    
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
      } else if (selection === 'View Documentation') {
        vscode.commands.executeCommand('maria.showDocumentation');
      }
    });
  
  console.log('MARIA AI Assistant activated successfully');
}

export function deactivate(): Thenable<void> | undefined {
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