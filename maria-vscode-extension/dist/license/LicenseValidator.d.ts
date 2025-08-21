export declare class LicenseValidator {
    private licenseKey?;
    constructor();
    validateCurrentLicense(): Promise<{
        tier: string;
        features: string[];
    }>;
    private validateEnterpriseLicense;
    private getFreeTierInfo;
    private getEnterpriseTierInfo;
}
//# sourceMappingURL=LicenseValidator.d.ts.map