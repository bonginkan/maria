"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MariaLicenseManager = void 0;
const vscode = __importStar(require("vscode"));
class MariaLicenseManager {
    constructor(configManager) {
        this.configManager = configManager;
        this.licenseServerUrl = configManager.get('enterprise.serverUrl') || 'https://license.bonginkan.ai';
    }
    async validateLicense() {
        const licenseKey = this.configManager.get('enterprise.licenseKey');
        if (!licenseKey) {
            return this.getFreeLicense();
        }
        try {
            const response = await this.validateEnterpriseLicense(licenseKey);
            return response;
        }
        catch (error) {
            console.error('License validation failed:', error);
            vscode.window.showWarningMessage('Failed to validate enterprise license. Falling back to free tier.');
            return this.getFreeLicense();
        }
    }
    async validateEnterpriseLicense(key) {
        // In production, this would make an actual API call to the license server
        // For now, we'll simulate validation
        try {
            // Simulate API call
            const isValid = key.match(/^ENT-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/);
            if (isValid) {
                return {
                    isValid: true,
                    isEnterprise: true,
                    tier: 'enterprise',
                    features: [
                        'advanced-ai',
                        'all-cognitive-modes',
                        'team-collaboration',
                        'priority-support',
                        'security-review',
                        'approval-system',
                        'custom-models',
                        'sla-guarantee'
                    ],
                    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
                };
            }
        }
        catch (error) {
            console.error('Error validating license:', error);
        }
        return this.getFreeLicense();
    }
    getFreeLicense() {
        return {
            isValid: true,
            isEnterprise: false,
            tier: 'free',
            features: [
                'basic-ai',
                'code-generation',
                'bug-analysis',
                'limited-cognitive-modes',
                'community-support'
            ]
        };
    }
    async checkFeature(feature) {
        const status = await this.validateLicense();
        return status.features.includes(feature);
    }
    async showUpgradeDialog() {
        const action = await vscode.window.showInformationMessage('This feature requires MARIA Enterprise. Upgrade to unlock advanced features.', 'Learn More', 'Contact Sales', 'Enter License Key');
        switch (action) {
            case 'Learn More':
                vscode.env.openExternal(vscode.Uri.parse('https://maria.bonginkan.ai/enterprise'));
                break;
            case 'Contact Sales':
                vscode.env.openExternal(vscode.Uri.parse('mailto:enterprise@bonginkan.ai'));
                break;
            case 'Enter License Key':
                const key = await vscode.window.showInputBox({
                    prompt: 'Enter your MARIA Enterprise license key',
                    placeHolder: 'ENT-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX',
                    password: true
                });
                if (key) {
                    await this.configManager.update('enterprise.licenseKey', key);
                    const status = await this.validateLicense();
                    if (status.isEnterprise) {
                        vscode.window.showInformationMessage('Enterprise license activated successfully!');
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }
                    else {
                        vscode.window.showErrorMessage('Invalid license key. Please check and try again.');
                    }
                }
                break;
        }
    }
}
exports.MariaLicenseManager = MariaLicenseManager;
//# sourceMappingURL=LicenseManager.js.map