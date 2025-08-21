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
exports.MariaConfigurationManager = void 0;
const vscode = __importStar(require("vscode"));
class MariaConfigurationManager {
    constructor() {
        this.configuration = vscode.workspace.getConfiguration('maria');
    }
    async initialize() {
        // Check for required configuration
        const apiKey = this.get('apiKey');
        if (!apiKey && !this.get('localModel.url')) {
            const action = await vscode.window.showWarningMessage('MARIA AI Assistant requires an API key or local model configuration.', 'Configure Now', 'Later');
            if (action === 'Configure Now') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'maria.apiKey');
            }
        }
    }
    get(key) {
        return this.configuration.get(key);
    }
    async update(key, value, global = true) {
        await this.configuration.update(key, value, global);
    }
    async reload() {
        this.configuration = vscode.workspace.getConfiguration('maria');
    }
    getAll() {
        return {
            apiKey: this.get('apiKey'),
            provider: this.get('provider'),
            model: this.get('model'),
            enableDiagnostics: this.get('enableDiagnostics'),
            diagnosticDelay: this.get('diagnosticDelay'),
            enableInternalModes: this.get('internalMode.enabled'),
            telemetryEnabled: this.get('telemetry.enabled'),
            enterpriseLicenseKey: this.get('enterprise.licenseKey'),
            enterpriseServerUrl: this.get('enterprise.serverUrl'),
            localModelUrl: this.get('localModel.url'),
            debugEnabled: this.get('debug.enabled'),
            traceServer: this.get('trace.server')
        };
    }
    isEnterpriseEnabled() {
        return !!this.get('enterprise.licenseKey');
    }
    getProvider() {
        return this.get('provider') || 'openai';
    }
    getModel() {
        return this.get('model') || 'gpt-4';
    }
}
exports.MariaConfigurationManager = MariaConfigurationManager;
//# sourceMappingURL=ConfigurationManager.js.map