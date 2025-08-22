import * as vscode from 'vscode';

export class MariaTelemetry implements vscode.Disposable {
  private context: vscode.ExtensionContext;
  private enabled: boolean;
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.enabled = vscode.workspace.getConfiguration('maria').get('telemetry.enabled', true);
  }
  
  public trackActivation(): void {
    this.trackEvent('extension-activated');
  }
  
  public trackEvent(eventName: string, properties?: any): void {
    if (!this.enabled) {
      return;
    }
    
    // Log event for debugging
    console.log(`[MARIA Telemetry] ${eventName}`, properties);
    
    // TODO: Send to telemetry service
  }
  
  public trackError(error: Error, context: string): void {
    this.trackEvent('error', {
      message: error.message,
      stack: error.stack,
      context
    });
  }
  
  public dispose(): void {
    this.trackEvent('extension-deactivated');
  }
}