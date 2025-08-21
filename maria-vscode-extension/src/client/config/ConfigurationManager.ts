import * as vscode from 'vscode';

export class MariaConfigurationManager {
  private configuration: vscode.WorkspaceConfiguration;
  
  constructor() {
    this.configuration = vscode.workspace.getConfiguration('maria');
  }
  
  async initialize(): Promise<void> {
    // Check for required configuration
    const apiKey = this.get('apiKey');
    if (!apiKey && !this.get('localModel.url')) {
      const action = await vscode.window.showWarningMessage(
        'MARIA AI Assistant requires an API key or local model configuration.',
        'Configure Now',
        'Later'
      );
      
      if (action === 'Configure Now') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'maria.apiKey');
      }
    }
  }
  
  get<T>(key: string): T | undefined {
    return this.configuration.get<T>(key);
  }
  
  async update(key: string, value: any, global: boolean = true): Promise<void> {
    await this.configuration.update(key, value, global);
  }
  
  async reload(): Promise<void> {
    this.configuration = vscode.workspace.getConfiguration('maria');
  }
  
  getAll(): any {
    return {
      apiKey: this.get('apiKey'),
      provider: this.get('provider'),
      model: this.get('model'),
      enableDiagnostics: this.get('enableDiagnostics'),
      diagnosticDelay: this.get('diagnosticDelay'),
      enableInternalModes: this.get('internalMode.enabled'),
      telemetryEnabled: this.get('telemetry.enabled'),
      enterpriseLicenseKey: this.get('enterprise.licenseKey'),
      enterpriseServerUrl: this.get('enterprise.serverUrl'),
      localModelUrl: this.get('localModel.url'),
      debugEnabled: this.get('debug.enabled'),
      traceServer: this.get('trace.server')
    };
  }
  
  isEnterpriseEnabled(): boolean {
    return !!this.get('enterprise.licenseKey');
  }
  
  getProvider(): string {
    return this.get('provider') || 'openai';
  }
  
  getModel(): string {
    return this.get('model') || 'gpt-4';
  }
}