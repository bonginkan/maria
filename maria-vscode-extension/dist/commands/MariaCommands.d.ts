export declare class MariaCommands {
    private licenseInfo;
    private telemetry;
    constructor(licenseInfo: {
        tier: string;
        features: string[];
    }, telemetry: any);
    generateCode(): Promise<void>;
    analyzeBugs(): Promise<void>;
    lintAnalysis(): Promise<void>;
    typecheckAnalysis(): Promise<void>;
    securityReview(): Promise<void>;
    paperProcessing(): Promise<void>;
    openChat(): Promise<void>;
    showStatus(): Promise<void>;
    listModels(): Promise<void>;
    switchMode(): Promise<void>;
}
//# sourceMappingURL=MariaCommands.d.ts.map