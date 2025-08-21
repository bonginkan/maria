import { MariaConfigurationManager } from '../config/ConfigurationManager';
export interface LicenseStatus {
    isValid: boolean;
    isEnterprise: boolean;
    tier: 'free' | 'enterprise';
    features: string[];
    expiresAt?: Date;
}
export declare class MariaLicenseManager {
    private configManager;
    private licenseServerUrl;
    constructor(configManager: MariaConfigurationManager);
    validateLicense(): Promise<LicenseStatus>;
    private validateEnterpriseLicense;
    private getFreeLicense;
    checkFeature(feature: string): Promise<boolean>;
    showUpgradeDialog(): Promise<void>;
}
//# sourceMappingURL=LicenseManager.d.ts.map