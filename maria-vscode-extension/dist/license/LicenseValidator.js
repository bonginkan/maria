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
exports.LicenseValidator = void 0;
const vscode = __importStar(require("vscode"));
class LicenseValidator {
    constructor() {
        this.licenseKey = vscode.workspace.getConfiguration('maria').get('licenseKey');
    }
    async validateCurrentLicense() {
        if (!this.licenseKey) {
            return this.getFreeTierInfo();
        }
        // Validate enterprise license
        if (this.licenseKey.startsWith('ENT-')) {
            const isValid = await this.validateEnterpriseLicense(this.licenseKey);
            if (isValid) {
                return this.getEnterpriseTierInfo();
            }
        }
        return this.getFreeTierInfo();
    }
    async validateEnterpriseLicense(key) {
        // TODO: Implement actual license validation with server
        // For now, check format
        const pattern = /^ENT-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/;
        return pattern.test(key);
    }
    getFreeTierInfo() {
        return {
            tier: 'free',
            features: [
                'basic-code-generation',
                'bug-analysis',
                'limited-models',
                'community-support'
            ]
        };
    }
    getEnterpriseTierInfo() {
        return {
            tier: 'enterprise',
            features: [
                'advanced-code-generation',
                'bug-analysis',
                'security-review',
                'all-models',
                'priority-support',
                'team-collaboration',
                'custom-models',
                'api-access'
            ]
        };
    }
}
exports.LicenseValidator = LicenseValidator;
//# sourceMappingURL=LicenseValidator.js.map