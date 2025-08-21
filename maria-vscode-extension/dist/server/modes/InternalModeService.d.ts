import { Connection } from 'vscode-languageserver/node';
export interface InternalMode {
    id: string;
    displayName: string;
    description: string;
    category: string;
    icon: string;
}
export declare class MariaInternalModeService {
    private connection;
    private currentMode;
    private modes;
    private isActive;
    constructor(connection: Connection);
    private initializeModes;
    start(): void;
    stop(): void;
    switchMode(modeId: string): void;
    getCurrentMode(): InternalMode;
    getAllModes(): InternalMode[];
    private startContextAnalysis;
    private notifyModeChange;
    analyzeContext(text: string): string;
}
//# sourceMappingURL=InternalModeService.d.ts.map