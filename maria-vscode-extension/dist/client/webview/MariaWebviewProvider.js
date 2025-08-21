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
exports.MariaWebviewProvider = void 0;
const vscode = __importStar(require("vscode"));
class MariaWebviewProvider {
    constructor(extensionUri, configManager, licenseStatus) {
        this._chatHistory = [];
        this._extensionUri = extensionUri;
        this._configManager = configManager;
        this._licenseStatus = licenseStatus;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'chat-message':
                    await this._handleChatMessage(data.message);
                    break;
                case 'command':
                    await this._handleCommand(data.command, data.args);
                    break;
                case 'clear-history':
                    this._chatHistory = [];
                    this._updateWebview();
                    break;
                case 'export-history':
                    await this._exportChatHistory();
                    break;
                case 'settings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'maria');
                    break;
            }
        });
        // Update webview when it becomes visible
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._updateWebview();
            }
        });
    }
    async _handleChatMessage(message) {
        // Add user message to history
        this._chatHistory.push({ role: 'user', content: message });
        this._updateWebview();
        // Show typing indicator
        this._view?.webview.postMessage({
            type: 'typing',
            isTyping: true
        });
        try {
            // Send message to MARIA AI through command
            const response = await vscode.commands.executeCommand('maria.chat', message, this._chatHistory);
            // Add AI response to history
            if (response) {
                this._chatHistory.push({ role: 'assistant', content: response });
            }
        }
        catch (error) {
            // Handle error
            this._chatHistory.push({
                role: 'error',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
        finally {
            // Hide typing indicator and update view
            this._view?.webview.postMessage({
                type: 'typing',
                isTyping: false
            });
            this._updateWebview();
        }
    }
    async _handleCommand(command, args) {
        try {
            const result = await vscode.commands.executeCommand(command, args);
            if (result) {
                this._chatHistory.push({
                    role: 'system',
                    content: `Command executed: ${command}`
                });
                if (typeof result === 'string') {
                    this._chatHistory.push({
                        role: 'assistant',
                        content: result
                    });
                }
                this._updateWebview();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to execute command: ${command}`);
        }
    }
    async _exportChatHistory() {
        const content = this._chatHistory
            .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
            .join('\n\n');
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('maria-chat-history.md'),
            filters: {
                'Markdown': ['md'],
                'Text': ['txt']
            }
        });
        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
            vscode.window.showInformationMessage('Chat history exported successfully');
        }
    }
    _updateWebview() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'update-history',
                history: this._chatHistory
            });
        }
    }
    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'chat.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'chat.css'));
        const nonce = this._getNonce();
        return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
      <link href="${styleUri}" rel="stylesheet">
      <title>MARIA AI Chat</title>
    </head>
    <body>
      <div class="chat-container">
        <div class="chat-header">
          <div class="header-content">
            <h2>MARIA AI Assistant</h2>
            <div class="header-status">
              ${this._licenseStatus.isEnterprise ? '<span class="badge enterprise">Enterprise</span>' : '<span class="badge free">Free</span>'}
              <span class="status-indicator online"></span>
            </div>
          </div>
          <div class="header-actions">
            <button class="icon-button" id="clear-btn" title="Clear History">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z"/>
              </svg>
            </button>
            <button class="icon-button" id="export-btn" title="Export History">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
              </svg>
            </button>
            <button class="icon-button" id="settings-btn" title="Settings">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
                <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="chat-messages" id="chat-messages">
          <div class="welcome-message">
            <h3>Welcome to MARIA AI Assistant!</h3>
            <p>I'm here to help you with:</p>
            <ul>
              <li>🚀 Code generation and completion</li>
              <li>🐛 Bug analysis and fixes</li>
              <li>🔍 Code review and improvements</li>
              <li>🔒 Security vulnerability detection</li>
              <li>📚 Documentation and explanations</li>
              <li>✅ Test generation</li>
            </ul>
            <p>Type your question or use slash commands to get started!</p>
            
            <div class="quick-actions">
              <button class="quick-action" data-command="maria.generateCode">Generate Code</button>
              <button class="quick-action" data-command="maria.analyzeBugs">Analyze Bugs</button>
              <button class="quick-action" data-command="maria.securityReview">Security Review</button>
              <button class="quick-action" data-command="maria.showDocumentation">Documentation</button>
            </div>
          </div>
        </div>
        
        <div class="typing-indicator" id="typing-indicator" style="display: none;">
          <span></span>
          <span></span>
          <span></span>
        </div>
        
        <div class="chat-input-container">
          <div class="input-wrapper">
            <textarea 
              id="chat-input" 
              class="chat-input" 
              placeholder="Type a message or / for commands..."
              rows="1"
            ></textarea>
            <button id="send-btn" class="send-button" title="Send (Enter)">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
              </svg>
            </button>
          </div>
          <div class="input-hints">
            <span>Enter to send • Shift+Enter for new line • / for commands</span>
          </div>
        </div>
      </div>
      
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const chatMessages = document.getElementById('chat-messages');
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        const clearBtn = document.getElementById('clear-btn');
        const exportBtn = document.getElementById('export-btn');
        const settingsBtn = document.getElementById('settings-btn');
        const typingIndicator = document.getElementById('typing-indicator');
        
        // Auto-resize textarea
        chatInput.addEventListener('input', function() {
          this.style.height = 'auto';
          this.style.height = (this.scrollHeight) + 'px';
        });
        
        // Send message
        function sendMessage() {
          const message = chatInput.value.trim();
          if (message) {
            vscode.postMessage({
              type: 'chat-message',
              message: message
            });
            chatInput.value = '';
            chatInput.style.height = 'auto';
          }
        }
        
        sendBtn.addEventListener('click', sendMessage);
        
        chatInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        });
        
        // Clear history
        clearBtn.addEventListener('click', () => {
          if (confirm('Clear chat history?')) {
            vscode.postMessage({ type: 'clear-history' });
          }
        });
        
        // Export history
        exportBtn.addEventListener('click', () => {
          vscode.postMessage({ type: 'export-history' });
        });
        
        // Open settings
        settingsBtn.addEventListener('click', () => {
          vscode.postMessage({ type: 'settings' });
        });
        
        // Quick actions
        document.querySelectorAll('.quick-action').forEach(btn => {
          btn.addEventListener('click', () => {
            const command = btn.dataset.command;
            vscode.postMessage({
              type: 'command',
              command: command
            });
          });
        });
        
        // Handle messages from extension
        window.addEventListener('message', event => {
          const message = event.data;
          
          switch (message.type) {
            case 'update-history':
              updateChatHistory(message.history);
              break;
              
            case 'typing':
              typingIndicator.style.display = message.isTyping ? 'flex' : 'none';
              break;
          }
        });
        
        function updateChatHistory(history) {
          // Clear welcome message if there's history
          if (history.length > 0) {
            const welcomeMsg = chatMessages.querySelector('.welcome-message');
            if (welcomeMsg) {
              welcomeMsg.remove();
            }
          }
          
          // Clear existing messages except welcome
          const existingMessages = chatMessages.querySelectorAll('.message');
          existingMessages.forEach(msg => msg.remove());
          
          // Add messages
          history.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + msg.role;
            
            const content = document.createElement('div');
            content.className = 'message-content';
            content.textContent = msg.content;
            
            messageDiv.appendChild(content);
            chatMessages.appendChild(messageDiv);
          });
          
          // Scroll to bottom
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      </script>
    </body>
    </html>`;
    }
    _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
exports.MariaWebviewProvider = MariaWebviewProvider;
MariaWebviewProvider.viewType = 'maria.chatView';
//# sourceMappingURL=MariaWebviewProvider.js.map