import * as vscode from 'vscode';
export declare class MariaTelemetry implements vscode.Disposable {
    private context;
    private enabled;
    constructor(context: vscode.ExtensionContext);
    trackActivation(): void;
    trackEvent(eventName: string, properties?: any): void;
    trackError(error: Error, context: string): void;
    dispose(): void;
}
//# sourceMappingURL=MariaTelemetry.d.ts.map