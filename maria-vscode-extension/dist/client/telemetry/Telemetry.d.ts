import * as vscode from 'vscode';
export declare class MariaTelemetry {
    private context;
    private enabled;
    private sessionId;
    private events;
    constructor(context: vscode.ExtensionContext);
    private generateSessionId;
    trackEvent(eventName: string, properties?: any): void;
    trackError(error: Error, context?: string): void;
    trackPerformance(operation: string, duration: number): void;
    private flush;
    dispose(): void;
}
//# sourceMappingURL=Telemetry.d.ts.map