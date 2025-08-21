import { Connection } from 'vscode-languageserver/node';
export interface CompletionSuggestion {
    label: string;
    insertText: string;
    description: string;
}
export interface FixSuggestion {
    title: string;
    replacement: string;
}
export declare class MariaAIEngine {
    private connection;
    private providers;
    private activeProvider;
    private configuration;
    constructor(connection: Connection);
    private initializeProviders;
    updateConfiguration(config: any): void;
    private configureProvider;
    private getActiveProvider;
    generateCode(prompt: string, language?: string): Promise<string>;
    analyzeCode(code: string, analysisType: string, language?: string): Promise<any>;
    chat(message: string, history?: any[]): Promise<string>;
    getCompletions(context: string, language: string): Promise<CompletionSuggestion[]>;
    suggestFix(code: string, issue: string, language: string): Promise<FixSuggestion | null>;
    getDocumentation(symbol: string, language: string): Promise<string | null>;
    integrateWithCLI(): Promise<void>;
}
//# sourceMappingURL=MariaAIEngine.d.ts.map