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
exports.MariaTelemetry = void 0;
const vscode = __importStar(require("vscode"));
class MariaTelemetry {
    constructor(context) {
        this.events = [];
        this.context = context;
        this.enabled = vscode.workspace.getConfiguration('maria').get('telemetry.enabled', true);
        this.sessionId = this.generateSessionId();
        // Respect VS Code telemetry settings
        if (vscode.env.isTelemetryEnabled === false) {
            this.enabled = false;
        }
    }
    generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    trackEvent(eventName, properties) {
        if (!this.enabled) {
            return;
        }
        const event = {
            name: eventName,
            properties: {
                ...properties,
                sessionId: this.sessionId,
                timestamp: new Date().toISOString(),
                extensionVersion: this.context.extension.packageJSON.version,
                vscodeVersion: vscode.version,
                platform: process.platform
            }
        };
        this.events.push(event);
        // In production, this would send to analytics service
        console.log('Telemetry event:', event);
        // Batch send events every 100 events or on dispose
        if (this.events.length >= 100) {
            this.flush();
        }
    }
    trackError(error, context) {
        this.trackEvent('error', {
            message: error.message,
            stack: error.stack,
            context
        });
    }
    trackPerformance(operation, duration) {
        this.trackEvent('performance', {
            operation,
            duration
        });
    }
    flush() {
        if (this.events.length === 0) {
            return;
        }
        // In production, send events to analytics service
        // For now, just log them
        console.log(`Flushing ${this.events.length} telemetry events`);
        this.events = [];
    }
    dispose() {
        this.flush();
    }
}
exports.MariaTelemetry = MariaTelemetry;
//# sourceMappingURL=Telemetry.js.map