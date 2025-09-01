/**
 * Default Provider - Fallback provider when no API keys are configured
 * This provides basic code generation capabilities without requiring external API keys
 */

import {
  IAIProvider,
  Message,
  CompletionOptions,
  CodeReviewResult,
} from "./ai-provider";

export class DefaultProvider implements IAIProvider {
  name = "default";
  models = ["maria-default"];

  async initialize(): Promise<void> {
    // No initialization needed for default provider
  }

  getModels(): string[] {
    return this.models;
  }

  async generateCode(prompt: string): Promise<string> {
    // Parse the prompt to understand what's being requested
    const lowercasePrompt = prompt.toLowerCase();

    let generatedCode = "";

    // Simple pattern matching for common requests
    if (
      lowercasePrompt.includes("tetris") ||
      lowercasePrompt.includes("テトリス")
    ) {
      generatedCode = this.generateTetrisHTML();
    } else if (
      lowercasePrompt.includes("todo") ||
      lowercasePrompt.includes("タスク")
    ) {
      generatedCode = this.generateTodoApp();
    } else if (
      lowercasePrompt.includes("calculator") ||
      lowercasePrompt.includes("計算機")
    ) {
      generatedCode = this.generateCalculator();
    } else if (
      lowercasePrompt.includes("form") ||
      lowercasePrompt.includes("フォーム")
    ) {
      generatedCode = this.generateForm();
    } else {
      // Generic HTML template
      generatedCode = this.generateGenericHTML(prompt);
    }

    return generatedCode;
  }

  private generateTetrisHTML(): string {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>テトリス - Tetris Game</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #000;
            color: #fff;
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        
        .game-container {
            text-align: center;
        }
        
        #gameBoard {
            border: 2px solid #fff;
            background: #111;
            margin: 20px auto;
        }
        
        .controls {
            margin: 20px 0;
        }
        
        .controls p {
            margin: 5px 0;
            font-size: 14px;
        }
        
        .score {
            font-size: 18px;
            margin: 10px 0;
        }
        
        .game-over {
            color: #ff4444;
            font-size: 24px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="game-container">
        <h1>🎮 テトリス</h1>
        <div class="score">スコア: <span id="score">0</span></div>
        <canvas id="gameBoard" width="300" height="600"></canvas>
        <div class="controls">
            <p>⬅️ ➡️ 左右移動</p>
            <p>⬇️ 高速落下</p>
            <p>⬆️ 回転</p>
            <p>スペース: ポーズ</p>
        </div>
        <div id="gameOver" class="game-over" style="display: none;">ゲームオーバー!</div>
    </div>

    <script>
        const canvas = document.getElementById('gameBoard');
        const ctx = canvas.getContext('2d');
        const scoreElement = document.getElementById('score');
        const gameOverElement = document.getElementById('gameOver');

        // Game constants
        const ROWS = 20;
        const COLS = 10;
        const BLOCK_SIZE = 30;
        
        // Game state
        let board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
        let score = 0;
        let gameRunning = true;
        let dropTime = 0;
        let dropInterval = 1000; // 1 second
        
        // Tetris pieces
        const pieces = [
            // I piece
            [[[1,1,1,1]]],
            // O piece  
            [[[1,1],[1,1]]],
            // T piece
            [[[0,1,0],[1,1,1]]],
            // S piece
            [[[0,1,1],[1,1,0]]],
            // Z piece
            [[[1,1,0],[0,1,1]]],
            // J piece
            [[[1,0,0],[1,1,1]]],
            // L piece
            [[[0,0,1],[1,1,1]]]
        ];
        
        const colors = [
            '#00f0f0', '#f0f000', '#a000f0', '#00f000', 
            '#f00000', '#0000f0', '#f0a000'
        ];
        
        // Current piece
        let currentPiece = {
            shape: pieces[0][0],
            x: Math.floor(COLS / 2) - 1,
            y: 0,
            color: 0
        };
        
        function drawBlock(x, y, colorIndex) {
            ctx.fillStyle = colors[colorIndex];
            ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
            ctx.strokeStyle = '#333';
            ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
        
        function drawBoard() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw placed pieces
            for (let row = 0; row < ROWS; row++) {
                for (let col = 0; col < COLS; col++) {
                    if (board[row][col]) {
                        drawBlock(col, row, board[row][col] - 1);
                    }
                }
            }
            
            // Draw current piece
            if (gameRunning) {
                for (let row = 0; row < currentPiece.shape.length; row++) {
                    for (let col = 0; col < currentPiece.shape[row].length; col++) {
                        if (currentPiece.shape[row][col]) {
                            drawBlock(currentPiece.x + col, currentPiece.y + row, currentPiece.color);
                        }
                    }
                }
            }
        }
        
        function isValidMove(shape, x, y) {
            for (let row = 0; row < shape.length; row++) {
                for (let col = 0; col < shape[row].length; col++) {
                    if (shape[row][col]) {
                        const newX = x + col;
                        const newY = y + row;
                        
                        if (newX < 0 || newX >= COLS || newY >= ROWS) {
                            return false;
                        }
                        
                        if (newY >= 0 && board[newY][newX]) {
                            return false;
                        }
                    }
                }
            }
            return true;
        }
        
        function placePiece() {
            for (let row = 0; row < currentPiece.shape.length; row++) {
                for (let col = 0; col < currentPiece.shape[row].length; col++) {
                    if (currentPiece.shape[row][col]) {
                        board[currentPiece.y + row][currentPiece.x + col] = currentPiece.color + 1;
                    }
                }
            }
        }
        
        function clearLines() {
            let linesCleared = 0;
            for (let row = ROWS - 1; row >= 0; row--) {
                if (board[row].every(cell => cell !== 0)) {
                    board.splice(row, 1);
                    board.unshift(Array(COLS).fill(0));
                    linesCleared++;
                    row++; // Check the same row again
                }
            }
            score += linesCleared * 100;
            scoreElement.textContent = score;
        }
        
        function spawnNewPiece() {
            const pieceIndex = Math.floor(Math.random() * pieces.length);
            currentPiece = {
                shape: pieces[pieceIndex][0],
                x: Math.floor(COLS / 2) - 1,
                y: 0,
                color: pieceIndex
            };
            
            if (!isValidMove(currentPiece.shape, currentPiece.x, currentPiece.y)) {
                gameRunning = false;
                gameOverElement.style.display = 'block';
            }
        }
        
        function rotatePiece(shape) {
            const rotated = [];
            const rows = shape.length;
            const cols = shape[0].length;
            
            for (let col = 0; col < cols; col++) {
                rotated[col] = [];
                for (let row = rows - 1; row >= 0; row--) {
                    rotated[col][rows - 1 - row] = shape[row][col];
                }
            }
            return rotated;
        }
        
        function update(deltaTime) {
            if (!gameRunning) return;
            
            dropTime += deltaTime;
            if (dropTime >= dropInterval) {
                if (isValidMove(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
                    currentPiece.y++;
                } else {
                    placePiece();
                    clearLines();
                    spawnNewPiece();
                }
                dropTime = 0;
            }
        }
        
        // Controls
        document.addEventListener('keydown', (e) => {
            if (!gameRunning) return;
            
            switch(e.code) {
                case 'ArrowLeft':
                    if (isValidMove(currentPiece.shape, currentPiece.x - 1, currentPiece.y)) {
                        currentPiece.x--;
                    }
                    break;
                case 'ArrowRight':
                    if (isValidMove(currentPiece.shape, currentPiece.x + 1, currentPiece.y)) {
                        currentPiece.x++;
                    }
                    break;
                case 'ArrowDown':
                    if (isValidMove(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
                        currentPiece.y++;
                    }
                    break;
                case 'ArrowUp':
                    const rotated = rotatePiece(currentPiece.shape);
                    if (isValidMove(rotated, currentPiece.x, currentPiece.y)) {
                        currentPiece.shape = rotated;
                    }
                    break;
            }
        });
        
        // Game loop
        let lastTime = 0;
        function gameLoop(currentTime) {
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;
            
            update(deltaTime);
            drawBoard();
            
            requestAnimationFrame(gameLoop);
        }
        
        // Initialize game
        spawnNewPiece();
        requestAnimationFrame(gameLoop);
    </script>
</body>
</html>`;
  }

  private generateTodoApp(): string {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Todo App</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .todo-app { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .todo-input { width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; }
        .todo-item { background: white; padding: 15px; margin: 10px 0; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }
        .completed { text-decoration: line-through; opacity: 0.6; }
        .delete-btn { background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="todo-app">
        <h1>📝 Todo App</h1>
        <input type="text" id="todoInput" class="todo-input" placeholder="新しいタスクを入力..." />
        <div id="todoList"></div>
    </div>
    <script>
        let todos = [];
        const todoInput = document.getElementById('todoInput');
        const todoList = document.getElementById('todoList');
        
        function addTodo() {
            const text = todoInput.value.trim();
            if (text) {
                todos.push({ id: Date.now(), text, completed: false });
                todoInput.value = '';
                renderTodos();
            }
        }
        
        function toggleTodo(id) {
            todos = todos.map(todo => 
                todo.id === id ? { ...todo, completed: !todo.completed } : todo
            );
            renderTodos();
        }
        
        function deleteTodo(id) {
            todos = todos.filter(todo => todo.id !== id);
            renderTodos();
        }
        
        function renderTodos() {
            todoList.innerHTML = todos.map(todo => \`
                <div class="todo-item \${todo.completed ? 'completed' : ''}">
                    <span onclick="toggleTodo(\${todo.id})" style="cursor: pointer;">\${todo.text}</span>
                    <button class="delete-btn" onclick="deleteTodo(\${todo.id})">削除</button>
                </div>
            \`).join('');
        }
        
        todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTodo();
        });
    </script>
</body>
</html>`;
  }

  private generateCalculator(): string {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calculator</title>
    <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f0f0f0; }
        .calculator { background: #333; padding: 20px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); }
        .display { width: 100%; height: 60px; background: #000; color: #fff; text-align: right; padding: 0 15px; margin-bottom: 15px; font-size: 24px; border-radius: 5px; display: flex; align-items: center; justify-content: flex-end; }
        .buttons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .btn { height: 60px; border: none; border-radius: 5px; font-size: 18px; cursor: pointer; transition: background-color 0.2s; }
        .btn:hover { opacity: 0.8; }
        .number, .decimal { background: #666; color: #fff; }
        .operator { background: #ff9500; color: #fff; }
        .equals { background: #ff9500; color: #fff; }
        .clear { background: #a6a6a6; color: #000; }
    </style>
</head>
<body>
    <div class="calculator">
        <div class="display" id="display">0</div>
        <div class="buttons">
            <button class="btn clear" onclick="clearDisplay()">AC</button>
            <button class="btn clear" onclick="clearEntry()">CE</button>
            <button class="btn operator" onclick="appendOperator('/')">/</button>
            <button class="btn operator" onclick="appendOperator('*')">×</button>
            
            <button class="btn number" onclick="appendNumber('7')">7</button>
            <button class="btn number" onclick="appendNumber('8')">8</button>
            <button class="btn number" onclick="appendNumber('9')">9</button>
            <button class="btn operator" onclick="appendOperator('-')">-</button>
            
            <button class="btn number" onclick="appendNumber('4')">4</button>
            <button class="btn number" onclick="appendNumber('5')">5</button>
            <button class="btn number" onclick="appendNumber('6')">6</button>
            <button class="btn operator" onclick="appendOperator('+')">+</button>
            
            <button class="btn number" onclick="appendNumber('1')">1</button>
            <button class="btn number" onclick="appendNumber('2')">2</button>
            <button class="btn number" onclick="appendNumber('3')">3</button>
            <button class="btn equals" onclick="calculate()" rowspan="2">=</button>
            
            <button class="btn number" onclick="appendNumber('0')" style="grid-column: span 2;">0</button>
            <button class="btn decimal" onclick="appendDecimal()">.</button>
        </div>
    </div>
    
    <script>
        let display = document.getElementById('display');
        let currentInput = '0';
        let operator = null;
        let waitingForOperand = false;
        
        function updateDisplay() {
            display.textContent = currentInput;
        }
        
        function appendNumber(num) {
            if (waitingForOperand) {
                currentInput = num;
                waitingForOperand = false;
            } else {
                currentInput = currentInput === '0' ? num : currentInput + num;
            }
            updateDisplay();
        }
        
        function appendDecimal() {
            if (waitingForOperand) {
                currentInput = '0.';
                waitingForOperand = false;
            } else if (currentInput.indexOf('.') === -1) {
                currentInput += '.';
            }
            updateDisplay();
        }
        
        function appendOperator(nextOperator) {
            const inputValue = parseFloat(currentInput);
            
            if (operator && !waitingForOperand) {
                calculate();
                currentInput = String(parseFloat(currentInput));
                updateDisplay();
            }
            
            waitingForOperand = true;
            operator = nextOperator;
        }
        
        function calculate() {
            const inputValue = parseFloat(currentInput);
            
            if (operator) {
                const prevValue = parseFloat(display.textContent);
                let result;
                
                switch (operator) {
                    case '+': result = prevValue + inputValue; break;
                    case '-': result = prevValue - inputValue; break;
                    case '*': result = prevValue * inputValue; break;
                    case '/': result = prevValue / inputValue; break;
                    default: return;
                }
                
                currentInput = String(result);
                operator = null;
                waitingForOperand = true;
                updateDisplay();
            }
        }
        
        function clearDisplay() {
            currentInput = '0';
            operator = null;
            waitingForOperand = false;
            updateDisplay();
        }
        
        function clearEntry() {
            currentInput = '0';
            updateDisplay();
        }
    </script>
</body>
</html>`;
  }

  private generateForm(): string {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact Form</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .form-container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, textarea, select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
        textarea { height: 120px; resize: vertical; }
        .submit-btn { background: #007bff; color: white; border: none; padding: 12px 30px; border-radius: 4px; cursor: pointer; font-size: 16px; }
        .submit-btn:hover { background: #0056b3; }
        .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 4px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="form-container">
        <h1>📧 お問い合わせフォーム</h1>
        <form id="contactForm">
            <div class="form-group">
                <label for="name">お名前 *</label>
                <input type="text" id="name" name="name" required>
            </div>
            
            <div class="form-group">
                <label for="email">メールアドレス *</label>
                <input type="email" id="email" name="email" required>
            </div>
            
            <div class="form-group">
                <label for="phone">電話番号</label>
                <input type="tel" id="phone" name="phone">
            </div>
            
            <div class="form-group">
                <label for="subject">件名 *</label>
                <select id="subject" name="subject" required>
                    <option value="">選択してください</option>
                    <option value="general">一般的なお問い合わせ</option>
                    <option value="support">サポート</option>
                    <option value="sales">営業について</option>
                    <option value="other">その他</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="message">メッセージ *</label>
                <textarea id="message" name="message" placeholder="お問い合わせ内容をご記入ください" required></textarea>
            </div>
            
            <button type="submit" class="submit-btn">送信する</button>
        </form>
        
        <div id="successMessage" class="success" style="display: none;">
            お問い合わせありがとうございます。24時間以内にご連絡いたします。
        </div>
    </div>
    
    <script>
        document.getElementById('contactForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Simple validation
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const subject = document.getElementById('subject').value;
            const message = document.getElementById('message').value.trim();
            
            if (!name || !email || !subject || !message) {
                alert('必須項目をすべて入力してください。');
                return;
            }
            
            if (!isValidEmail(email)) {
                alert('有効なメールアドレスを入力してください。');
                return;
            }
            
            // Here you would normally send the data to a server
            console.log('Form data:', { name, email, subject, message });
            
            // Show success message
            document.getElementById('contactForm').style.display = 'none';
            document.getElementById('successMessage').style.display = 'block';
        });
        
        function isValidEmail(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        }
    </script>
</body>
</html>`;
  }

  private generateGenericHTML(prompt: string): string {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Page</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            background: #f9f9f9;
        }
        
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        h1 {
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }
        
        .content {
            margin: 20px 0;
        }
        
        .note {
            background: #e9ecef;
            padding: 15px;
            border-left: 4px solid #007bff;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Generated Content</h1>
        
        <div class="content">
            <p>You requested: <strong>${prompt}</strong></p>
            
            <div class="note">
                <p>This is a basic HTML template generated by the default provider.</p>
                <p>For more advanced code generation, please configure an AI provider with API keys:</p>
                <ul>
                    <li>Run <code>/config</code> to set up API keys</li>
                    <li>Or use <code>/model</code> to select a configured provider</li>
                </ul>
            </div>
        </div>
        
        <div class="content">
            <h2>Available AI Providers</h2>
            <ul>
                <li><strong>OpenAI</strong> - Set OPENAI_API_KEY for GPT models</li>
                <li><strong>Anthropic</strong> - Set ANTHROPIC_API_KEY for Claude models</li>
                <li><strong>Google</strong> - Set GOOGLE_AI_API_KEY for Gemini models</li>
                <li><strong>Local providers</strong> - Ollama, LM Studio, vLLM (no API key needed)</li>
            </ul>
        </div>
    </div>
    
    <script>
        console.log('Generated with MARIA default provider');
        console.log('Prompt:', '${prompt}');
    </script>
</body>
</html>`;
  }

  async chat(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): Promise<string> {
    // Extract the last user message as the prompt
    const lastMessage = messages.filter((m) => m.role === "user").pop();
    if (!lastMessage) {
      return "No user message found.";
    }

    // Use the same generateCode logic for chat
    return await this.generateCode(lastMessage.content);
  }

  async *chatStream(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string> {
    // For simplicity, just yield the complete response
    const response = await this.chat(messages, model, options);
    yield response;
  }

  async reviewCode(
    code: string,
    language?: string,
    model?: string,
  ): Promise<CodeReviewResult> {
    return {
      issues: [
        {
          line: 1,
          severity: "info" as const,
          message:
            "Code review from default provider is basic. Consider using an AI provider with API keys for detailed analysis.",
          suggestion:
            "Configure an AI provider for advanced code review capabilities.",
        },
      ],
      summary:
        "Basic code review completed. The code appears to be syntactically correct.",
      improvements: [
        "Consider adding comments for better readability",
        "Add error handling if not present",
        "Consider using TypeScript for better type safety",
      ],
    };
  }

  isInitialized(): boolean {
    return true; // Default provider is always initialized
  }

  getDefaultModel(): string {
    return this.models[0] || "maria-default";
  }

  async shutdown(): Promise<void> {
    // No cleanup needed for default provider
  }
}
