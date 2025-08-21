export declare class MariaConfigurationManager {
    private configuration;
    constructor();
    initialize(): Promise<void>;
    get<T>(key: string): T | undefined;
    update(key: string, value: any, global?: boolean): Promise<void>;
    reload(): Promise<void>;
    getAll(): any;
    isEnterpriseEnabled(): boolean;
    getProvider(): string;
    getModel(): string;
}
//# sourceMappingURL=ConfigurationManager.d.ts.map