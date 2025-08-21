import * as vscode from 'vscode';

export class MariaWebviewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  
  constructor(private readonly _extensionUri: vscode.Uri) {}
  
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    
    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.type) {
        case 'chat':
          vscode.window.showInformationMessage(data.message);
          break;
      }
    });
  }
  
  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MARIA Chat</title>
        <style>
          body { 
            padding: 10px;
            font-family: var(--vscode-font-family);
          }
          .chat-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
          }
          .messages {
            flex: 1;
            overflow-y: auto;
            margin-bottom: 10px;
          }
          .input-area {
            display: flex;
            gap: 5px;
          }
          input {
            flex: 1;
            padding: 5px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
          }
          button {
            padding: 5px 10px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
          }
          button:hover {
            background: var(--vscode-button-hoverBackground);
          }
        </style>
    </head>
    <body>
        <div class="chat-container">
            <h2>MARIA AI Assistant</h2>
            <div class="messages" id="messages">
                <p>Welcome to MARIA! How can I help you today?</p>
            </div>
            <div class="input-area">
                <input type="text" id="messageInput" placeholder="Type your message...">
                <button onclick="sendMessage()">Send</button>
            </div>
        </div>
        <script>
            const vscode = acquireVsCodeApi();
            
            function sendMessage() {
                const input = document.getElementById('messageInput');
                const message = input.value;
                if (message) {
                    vscode.postMessage({
                        type: 'chat',
                        message: message
                    });
                    
                    const messagesDiv = document.getElementById('messages');
                    messagesDiv.innerHTML += '<p><b>You:</b> ' + message + '</p>';
                    input.value = '';
                }
            }
            
            document.getElementById('messageInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        </script>
    </body>
    </html>`;
  }
}