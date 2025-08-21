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
exports.MariaTreeItem = exports.MariaTreeViewProvider = void 0;
const vscode = __importStar(require("vscode"));
class MariaTreeViewProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Root items
            return Promise.resolve([
                new MariaTreeItem('Commands', vscode.TreeItemCollapsibleState.Expanded),
                new MariaTreeItem('AI Models', vscode.TreeItemCollapsibleState.Collapsed),
                new MariaTreeItem('Settings', vscode.TreeItemCollapsibleState.Collapsed)
            ]);
        }
        else if (element.label === 'Commands') {
            return Promise.resolve([
                new MariaTreeItem('Generate Code', vscode.TreeItemCollapsibleState.None, {
                    command: 'maria.generateCode',
                    title: 'Generate Code'
                }),
                new MariaTreeItem('Analyze Bugs', vscode.TreeItemCollapsibleState.None, {
                    command: 'maria.analyzeBugs',
                    title: 'Analyze Bugs'
                }),
                new MariaTreeItem('Security Review', vscode.TreeItemCollapsibleState.None, {
                    command: 'maria.securityReview',
                    title: 'Security Review'
                })
            ]);
        }
        else if (element.label === 'AI Models') {
            return Promise.resolve([
                new MariaTreeItem('GPT-4', vscode.TreeItemCollapsibleState.None),
                new MariaTreeItem('Claude', vscode.TreeItemCollapsibleState.None),
                new MariaTreeItem('Local LLM', vscode.TreeItemCollapsibleState.None)
            ]);
        }
        return Promise.resolve([]);
    }
}
exports.MariaTreeViewProvider = MariaTreeViewProvider;
class MariaTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, command) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.tooltip = this.label;
        this.contextValue = 'mariaItem';
    }
}
exports.MariaTreeItem = MariaTreeItem;
//# sourceMappingURL=MariaTreeViewProvider.js.map