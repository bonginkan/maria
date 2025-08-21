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
exports.MariaStatusBar = void 0;
const vscode = __importStar(require("vscode"));
class MariaStatusBar {
    constructor(context) {
        this.context = context;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'maria.openChat';
        this.statusBarItem.tooltip = 'MARIA AI Assistant';
        this.statusBarItem.show();
        context.subscriptions.push(this.statusBarItem);
    }
    update(text, state = 'ready') {
        const icons = {
            ready: '$(check)',
            loading: '$(sync~spin)',
            error: '$(error)',
            info: '$(info)'
        };
        this.statusBarItem.text = `${icons[state]} MARIA: ${text}`;
        // Update color based on state
        switch (state) {
            case 'ready':
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'loading':
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                break;
            case 'error':
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                break;
            case 'info':
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
                break;
        }
    }
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.MariaStatusBar = MariaStatusBar;
//# sourceMappingURL=StatusBar.js.map