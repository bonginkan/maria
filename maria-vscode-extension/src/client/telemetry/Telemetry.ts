import * as vscode from 'vscode';

export class MariaTelemetry {
  private context: vscode.ExtensionContext;
  private enabled: boolean;
  private sessionId: string;
  private events: Array<any> = [];
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.enabled = vscode.workspace.getConfiguration('maria').get('telemetry.enabled', true);
    this.sessionId = this.generateSessionId();
    
    // Respect VS Code telemetry settings
    if (vscode.env.isTelemetryEnabled === false) {
      this.enabled = false;
    }
  }
  
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  trackEvent(eventName: string, properties?: any): void {
    if (!this.enabled) {
      return;
    }
    
    const event = {
      name: eventName,
      properties: {
        ...properties,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        extensionVersion: this.context.extension.packageJSON.version,
        vscodeVersion: vscode.version,
        platform: process.platform
      }
    };
    
    this.events.push(event);
    
    // In production, this would send to analytics service
    console.log('Telemetry event:', event);
    
    // Batch send events every 100 events or on dispose
    if (this.events.length >= 100) {
      this.flush();
    }
  }
  
  trackError(error: Error, context?: string): void {
    this.trackEvent('error', {
      message: error.message,
      stack: error.stack,
      context
    });
  }
  
  trackPerformance(operation: string, duration: number): void {
    this.trackEvent('performance', {
      operation,
      duration
    });
  }
  
  private flush(): void {
    if (this.events.length === 0) {
      return;
    }
    
    // In production, send events to analytics service
    // For now, just log them
    console.log(`Flushing ${this.events.length} telemetry events`);
    this.events = [];
  }
  
  dispose(): void {
    this.flush();
  }
}