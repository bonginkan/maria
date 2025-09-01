/**
 * TemplateManager - Ultra-fast template matching for common code requests
 * Returns pre-built templates in <100ms for instant responses
 */

import * as fs from "fs";
import * as path from "path";

export interface Template {
  id: string;
  keywords: string[];
  content: string;
  language: string;
  description: string;
}

/**
 * Template manager for instant code generation
 */
export class TemplateManager {
  private templates: Map<string, Template> = new Map();
  private keywordIndex: Map<string, Set<string>> = new Map();
  private loaded = false;

  constructor() {
    // Initialize with built-in templates
    this.initializeBuiltinTemplates();
  }

  /**
   * Initialize built-in templates for common requests
   */
  private initializeBuiltinTemplates(): void {
    const builtinTemplates: Template[] = [
      {
        id: "tetris",
        keywords: ["tetris", "game", "テトリス"],
        language: "html",
        description: "Complete Tetris game in HTML5",
        content: this.getTetrisTemplate(),
      },
      {
        id: "todo",
        keywords: ["todo", "task", "list", "タスク"],
        language: "html",
        description: "Todo list application",
        content: this.getTodoTemplate(),
      },
      {
        id: "calculator",
        keywords: ["calculator", "calc", "計算", "電卓"],
        language: "html",
        description: "Calculator application",
        content: this.getCalculatorTemplate(),
      },
      {
        id: "rest-api",
        keywords: ["rest", "api", "crud", "endpoint"],
        language: "typescript",
        description: "REST API with CRUD operations",
        content: this.getRestApiTemplate(),
      },
      {
        id: "login-form",
        keywords: ["login", "auth", "authentication", "signin", "ログイン"],
        language: "html",
        description: "Login form with validation",
        content: this.getLoginFormTemplate(),
      },
      {
        id: "chat-app",
        keywords: ["chat", "message", "チャット"],
        language: "html",
        description: "Simple chat application",
        content: this.getChatTemplate(),
      },
      {
        id: "invaders",
        keywords: ["invader", "space invaders", "インベーダー", "シューティング"],
        language: "html",
        description: "Space Invaders game",
        content: this.getInvadersTemplate(),
      },
    ];

    // Load templates into memory
    for (const template of builtinTemplates) {
      this.addTemplate(template);
    }

    this.loaded = true;
  }

  /**
   * Add a template to the manager
   */
  private addTemplate(template: Template): void {
    this.templates.set(template.id, template);

    // Build keyword index for fast matching
    for (const keyword of template.keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      if (!this.keywordIndex.has(normalizedKeyword)) {
        this.keywordIndex.set(normalizedKeyword, new Set());
      }
      this.keywordIndex.get(normalizedKeyword)!.add(template.id);
    }
  }

  /**
   * Match a prompt to a template (ultra-fast <1ms)
   */
  async match(prompt: string): Promise<string | null> {
    const normalizedPrompt = prompt.toLowerCase();
    const words = normalizedPrompt.split(/\s+/);

    // Score each template based on keyword matches
    const scores = new Map<string, number>();

    for (const word of words) {
      // Check exact matches
      if (this.keywordIndex.has(word)) {
        for (const templateId of this.keywordIndex.get(word)!) {
          scores.set(templateId, (scores.get(templateId) || 0) + 2);
        }
      }

      // Check partial matches
      for (const [keyword, templateIds] of this.keywordIndex) {
        if (keyword.includes(word) || word.includes(keyword)) {
          for (const templateId of templateIds) {
            scores.set(templateId, (scores.get(templateId) || 0) + 1);
          }
        }
      }
    }

    // Find best matching template
    let bestTemplate: string | null = null;
    let bestScore = 0;

    for (const [templateId, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestTemplate = templateId;
      }
    }

    // Require minimum score threshold
    if (bestScore >= 2 && bestTemplate) {
      const template = this.templates.get(bestTemplate);
      return template?.content || null;
    }

    return null;
  }

  /**
   * Preload templates from disk (if any)
   */
  async preloadTemplates(): Promise<void> {
    const templateDir = path.join(__dirname, "../../../templates");

    if (!fs.existsSync(templateDir)) {
      return; // No external templates
    }

    try {
      const files = fs.readdirSync(templateDir);

      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(templateDir, file);
          const content = fs.readFileSync(filePath, "utf8");
          const template = JSON.parse(content) as Template;
          this.addTemplate(template);
        }
      }
    } catch (error) {
      console.warn("Failed to load external templates:", error);
    }
  }

  /**
   * Get statistics about loaded templates
   */
  getStats(): {
    totalTemplates: number;
    totalKeywords: number;
    languages: string[];
  } {
    const languages = new Set<string>();
    for (const template of this.templates.values()) {
      languages.add(template.language);
    }

    return {
      totalTemplates: this.templates.size,
      totalKeywords: this.keywordIndex.size,
      languages: Array.from(languages),
    };
  }

  // Template content methods

  private getTetrisTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tetris</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #111;
            font-family: monospace;
        }
        #game {
            display: flex;
            gap: 20px;
        }
        canvas {
            border: 2px solid #fff;
        }
        #info {
            color: #fff;
            font-size: 18px;
        }
        #info div {
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div id="game">
        <canvas id="tetris" width="240" height="400"></canvas>
        <div id="info">
            <div>Score: <span id="score">0</span></div>
            <div>Level: <span id="level">1</span></div>
            <div>Lines: <span id="lines">0</span></div>
            <div>Controls:</div>
            <div>← → Move</div>
            <div>↓ Soft Drop</div>
            <div>↑ Rotate</div>
            <div>Space: Hard Drop</div>
        </div>
    </div>
    <script>
        const canvas = document.getElementById('tetris');
        const ctx = canvas.getContext('2d');
        const COLS = 12;
        const ROWS = 20;
        const BLOCK_SIZE = 20;
        
        const PIECES = [
            [[1,1,1,1]],
            [[1,1],[1,1]],
            [[1,1,1],[0,1,0]],
            [[1,1,1],[1,0,0]],
            [[1,1,1],[0,0,1]],
            [[1,1,0],[0,1,1]],
            [[0,1,1],[1,1,0]]
        ];
        
        const COLORS = ['#0ff', '#ff0', '#f0f', '#00f', '#fa0', '#0f0', '#f00'];
        
        let board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
        let score = 0;
        let lines = 0;
        let level = 1;
        let dropTime = 1000;
        let lastDrop = 0;
        
        class Piece {
            constructor() {
                const type = Math.floor(Math.random() * PIECES.length);
                this.matrix = PIECES[type];
                this.color = COLORS[type];
                this.x = Math.floor(COLS / 2) - Math.floor(this.matrix[0].length / 2);
                this.y = 0;
            }
            
            rotate() {
                const rotated = this.matrix[0].map((_, i) =>
                    this.matrix.map(row => row[i]).reverse()
                );
                if (!collision(board, rotated, this.x, this.y)) {
                    this.matrix = rotated;
                }
            }
        }
        
        let currentPiece = new Piece();
        
        function collision(board, piece, x, y) {
            for (let row = 0; row < piece.length; row++) {
                for (let col = 0; col < piece[row].length; col++) {
                    if (piece[row][col]) {
                        const newX = x + col;
                        const newY = y + row;
                        if (newX < 0 || newX >= COLS || newY >= ROWS ||
                            (newY >= 0 && board[newY][newX])) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }
        
        function merge() {
            currentPiece.matrix.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        board[currentPiece.y + y][currentPiece.x + x] = currentPiece.color;
                    }
                });
            });
        }
        
        function clearLines() {
            let cleared = 0;
            for (let row = ROWS - 1; row >= 0; row--) {
                if (board[row].every(cell => cell !== 0)) {
                    board.splice(row, 1);
                    board.unshift(Array(COLS).fill(0));
                    cleared++;
                    row++;
                }
            }
            if (cleared > 0) {
                lines += cleared;
                score += cleared * 100 * level;
                level = Math.floor(lines / 10) + 1;
                dropTime = Math.max(100, 1000 - (level - 1) * 100);
                updateInfo();
            }
        }
        
        function updateInfo() {
            document.getElementById('score').textContent = score;
            document.getElementById('level').textContent = level;
            document.getElementById('lines').textContent = lines;
        }
        
        function draw() {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw board
            board.forEach((row, y) => {
                row.forEach((cell, x) => {
                    if (cell) {
                        ctx.fillStyle = cell;
                        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
                    }
                });
            });
            
            // Draw current piece
            currentPiece.matrix.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        ctx.fillStyle = currentPiece.color;
                        ctx.fillRect(
                            (currentPiece.x + x) * BLOCK_SIZE,
                            (currentPiece.y + y) * BLOCK_SIZE,
                            BLOCK_SIZE - 1,
                            BLOCK_SIZE - 1
                        );
                    }
                });
            });
        }
        
        function drop() {
            if (!collision(board, currentPiece.matrix, currentPiece.x, currentPiece.y + 1)) {
                currentPiece.y++;
            } else {
                merge();
                clearLines();
                currentPiece = new Piece();
                if (collision(board, currentPiece.matrix, currentPiece.x, currentPiece.y)) {
                    alert('Game Over! Score: ' + score);
                    board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
                    score = 0;
                    lines = 0;
                    level = 1;
                    updateInfo();
                }
            }
        }
        
        function hardDrop() {
            while (!collision(board, currentPiece.matrix, currentPiece.x, currentPiece.y + 1)) {
                currentPiece.y++;
                score += 2;
            }
            drop();
        }
        
        function gameLoop(time = 0) {
            if (time - lastDrop > dropTime) {
                drop();
                lastDrop = time;
            }
            draw();
            requestAnimationFrame(gameLoop);
        }
        
        document.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft' && !collision(board, currentPiece.matrix, currentPiece.x - 1, currentPiece.y)) {
                currentPiece.x--;
            } else if (e.key === 'ArrowRight' && !collision(board, currentPiece.matrix, currentPiece.x + 1, currentPiece.y)) {
                currentPiece.x++;
            } else if (e.key === 'ArrowDown') {
                drop();
                score++;
            } else if (e.key === 'ArrowUp') {
                currentPiece.rotate();
            } else if (e.key === ' ') {
                hardDrop();
            }
        });
        
        gameLoop();
    </script>
</body>
</html>`;
  }

  private getTodoTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Todo List</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
        }
        .todo-input {
            display: flex;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            border-radius: 10px;
            overflow: hidden;
        }
        input[type="text"] {
            flex: 1;
            padding: 15px 20px;
            font-size: 16px;
            border: none;
            outline: none;
        }
        button {
            padding: 15px 30px;
            background: #4CAF50;
            color: white;
            border: none;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.3s;
        }
        button:hover {
            background: #45a049;
        }
        .todo-list {
            background: white;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .todo-item {
            padding: 15px 20px;
            border-bottom: 1px solid #eee;
            display: flex;
            align-items: center;
            transition: background 0.3s;
        }
        .todo-item:hover {
            background: #f5f5f5;
        }
        .todo-item.completed {
            opacity: 0.6;
        }
        .todo-item.completed span {
            text-decoration: line-through;
        }
        .todo-item input[type="checkbox"] {
            margin-right: 15px;
            width: 20px;
            height: 20px;
            cursor: pointer;
        }
        .todo-item span {
            flex: 1;
            font-size: 16px;
        }
        .delete-btn {
            background: #f44336;
            color: white;
            border: none;
            padding: 5px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        .delete-btn:hover {
            background: #da190b;
        }
        .stats {
            margin-top: 20px;
            text-align: center;
            color: white;
            font-size: 14px;
        }
        .filter-buttons {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-bottom: 20px;
        }
        .filter-btn {
            padding: 8px 20px;
            background: white;
            color: #333;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s;
        }
        .filter-btn.active {
            background: #4CAF50;
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📝 Todo List</h1>
        
        <div class="filter-buttons">
            <button class="filter-btn active" data-filter="all">All</button>
            <button class="filter-btn" data-filter="active">Active</button>
            <button class="filter-btn" data-filter="completed">Completed</button>
        </div>
        
        <div class="todo-input">
            <input type="text" id="todoInput" placeholder="What needs to be done?">
            <button onclick="addTodo()">Add</button>
        </div>
        
        <div class="todo-list" id="todoList"></div>
        
        <div class="stats" id="stats"></div>
    </div>
    
    <script>
        let todos = JSON.parse(localStorage.getItem('todos')) || [];
        let currentFilter = 'all';
        
        function saveTodos() {
            localStorage.setItem('todos', JSON.stringify(todos));
        }
        
        function addTodo() {
            const input = document.getElementById('todoInput');
            const text = input.value.trim();
            
            if (text) {
                todos.push({
                    id: Date.now(),
                    text: text,
                    completed: false
                });
                input.value = '';
                saveTodos();
                render();
            }
        }
        
        function toggleTodo(id) {
            const todo = todos.find(t => t.id === id);
            if (todo) {
                todo.completed = !todo.completed;
                saveTodos();
                render();
            }
        }
        
        function deleteTodo(id) {
            todos = todos.filter(t => t.id !== id);
            saveTodos();
            render();
        }
        
        function getFilteredTodos() {
            switch(currentFilter) {
                case 'active':
                    return todos.filter(t => !t.completed);
                case 'completed':
                    return todos.filter(t => t.completed);
                default:
                    return todos;
            }
        }
        
        function render() {
            const todoList = document.getElementById('todoList');
            const filteredTodos = getFilteredTodos();
            
            todoList.innerHTML = filteredTodos.map(todo => \`
                <div class="todo-item \${todo.completed ? 'completed' : ''}">
                    <input type="checkbox" 
                           \${todo.completed ? 'checked' : ''} 
                           onchange="toggleTodo(\${todo.id})">
                    <span>\${todo.text}</span>
                    <button class="delete-btn" onclick="deleteTodo(\${todo.id})">Delete</button>
                </div>
            \`).join('');
            
            updateStats();
        }
        
        function updateStats() {
            const active = todos.filter(t => !t.completed).length;
            const completed = todos.filter(t => t.completed).length;
            const stats = document.getElementById('stats');
            stats.innerHTML = \`\${active} active, \${completed} completed, \${todos.length} total\`;
        }
        
        document.getElementById('todoInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addTodo();
            }
        });
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                render();
            });
        });
        
        render();
    </script>
</body>
</html>`;
  }

  private getCalculatorTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calculator</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .calculator {
            background: #fff;
            padding: 20px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .display {
            background: #333;
            color: white;
            font-size: 2em;
            padding: 10px;
            text-align: right;
            margin-bottom: 10px;
            border-radius: 10px;
            min-height: 40px;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .buttons {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
        }
        button {
            padding: 25px;
            font-size: 1.2em;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            background: #f0f0f0;
            transition: all 0.3s;
        }
        button:hover {
            background: #e0e0e0;
            transform: translateY(-2px);
        }
        button:active {
            transform: translateY(0);
        }
        .operator {
            background: #ff9500;
            color: white;
        }
        .operator:hover {
            background: #ffb143;
        }
        .equals {
            background: #4CAF50;
            color: white;
            grid-column: span 2;
        }
        .equals:hover {
            background: #5cbf60;
        }
        .clear {
            background: #f44336;
            color: white;
        }
        .clear:hover {
            background: #f66;
        }
        .zero {
            grid-column: span 2;
        }
    </style>
</head>
<body>
    <div class="calculator">
        <div class="display" id="display">0</div>
        <div class="buttons">
            <button class="clear" onclick="clearDisplay()">C</button>
            <button onclick="appendToDisplay('/')" class="operator">÷</button>
            <button onclick="appendToDisplay('*')" class="operator">×</button>
            <button onclick="deleteLast()">←</button>
            
            <button onclick="appendToDisplay('7')">7</button>
            <button onclick="appendToDisplay('8')">8</button>
            <button onclick="appendToDisplay('9')">9</button>
            <button onclick="appendToDisplay('-')" class="operator">-</button>
            
            <button onclick="appendToDisplay('4')">4</button>
            <button onclick="appendToDisplay('5')">5</button>
            <button onclick="appendToDisplay('6')">6</button>
            <button onclick="appendToDisplay('+')" class="operator">+</button>
            
            <button onclick="appendToDisplay('1')">1</button>
            <button onclick="appendToDisplay('2')">2</button>
            <button onclick="appendToDisplay('3')">3</button>
            <button onclick="appendToDisplay('.')">.</button>
            
            <button onclick="appendToDisplay('0')" class="zero">0</button>
            <button onclick="calculate()" class="equals">=</button>
        </div>
    </div>
    
    <script>
        let display = document.getElementById('display');
        let currentInput = '0';
        let shouldResetDisplay = false;
        
        function updateDisplay() {
            display.textContent = currentInput;
        }
        
        function clearDisplay() {
            currentInput = '0';
            shouldResetDisplay = false;
            updateDisplay();
        }
        
        function appendToDisplay(value) {
            if (shouldResetDisplay) {
                currentInput = '0';
                shouldResetDisplay = false;
            }
            
            if (currentInput === '0' && value !== '.') {
                currentInput = value;
            } else {
                currentInput += value;
            }
            
            updateDisplay();
        }
        
        function deleteLast() {
            if (currentInput.length > 1) {
                currentInput = currentInput.slice(0, -1);
            } else {
                currentInput = '0';
            }
            updateDisplay();
        }
        
        function calculate() {
            try {
                // Replace display symbols with JS operators
                let expression = currentInput.replace(/×/g, '*').replace(/÷/g, '/');
                let result = eval(expression);
                currentInput = result.toString();
                shouldResetDisplay = true;
                updateDisplay();
            } catch (error) {
                currentInput = 'Error';
                shouldResetDisplay = true;
                updateDisplay();
            }
        }
        
        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key >= '0' && e.key <= '9') {
                appendToDisplay(e.key);
            } else if (e.key === '.') {
                appendToDisplay('.');
            } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
                appendToDisplay(e.key);
            } else if (e.key === 'Enter' || e.key === '=') {
                calculate();
            } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
                clearDisplay();
            } else if (e.key === 'Backspace') {
                deleteLast();
            }
        });
    </script>
</body>
</html>`;
  }

  private getRestApiTemplate(): string {
    return `import express from 'express';
import { Router } from 'express';

// Define types
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateUserDto {
  name: string;
  email: string;
}

interface UpdateUserDto {
  name?: string;
  email?: string;
}

// In-memory database
class UserRepository {
  private users: Map<string, User> = new Map();
  private nextId = 1;

  findAll(): User[] {
    return Array.from(this.users.values());
  }

  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  create(dto: CreateUserDto): User {
    const user: User = {
      id: String(this.nextId++),
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(user.id, user);
    return user;
  }

  update(id: string, dto: UpdateUserDto): User | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;

    Object.assign(user, dto, { updatedAt: new Date() });
    this.users.set(id, user);
    return user;
  }

  delete(id: string): boolean {
    return this.users.delete(id);
  }
}

// Create router
function createUserRouter(): Router {
  const router = Router();
  const repository = new UserRepository();

  // GET /users
  router.get('/', (req, res) => {
    const users = repository.findAll();
    res.json(users);
  });

  // GET /users/:id
  router.get('/:id', (req, res) => {
    const user = repository.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  });

  // POST /users
  router.post('/', (req, res) => {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const user = repository.create({ name, email });
    res.status(201).json(user);
  });

  // PUT /users/:id
  router.put('/:id', (req, res) => {
    const { name, email } = req.body;
    const user = repository.update(req.params.id, { name, email });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  });

  // DELETE /users/:id
  router.delete('/:id', (req, res) => {
    const deleted = repository.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(204).send();
  });

  return router;
}

// Create and configure app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', createUserRouter());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
  console.log('Available endpoints:');
  console.log('  GET    /api/users');
  console.log('  GET    /api/users/:id');
  console.log('  POST   /api/users');
  console.log('  PUT    /api/users/:id');
  console.log('  DELETE /api/users/:id');
  console.log('  GET    /health');
});

export default app;`;
  }

  private getLoginFormTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Form</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 400px;
        }
        h2 {
            text-align: center;
            margin-bottom: 30px;
            color: #333;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            color: #666;
            font-size: 14px;
        }
        input {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        .error {
            color: #f44336;
            font-size: 12px;
            margin-top: 5px;
            display: none;
        }
        .error.show {
            display: block;
        }
        button {
            width: 100%;
            padding: 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            transition: background 0.3s;
        }
        button:hover {
            background: #5a67d8;
        }
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .success {
            background: #4CAF50;
            color: white;
            padding: 10px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 20px;
            display: none;
        }
        .success.show {
            display: block;
        }
        .forgot-password {
            text-align: center;
            margin-top: 20px;
        }
        .forgot-password a {
            color: #667eea;
            text-decoration: none;
            font-size: 14px;
        }
        .forgot-password a:hover {
            text-decoration: underline;
        }
        .loading {
            display: none;
            text-align: center;
            margin-top: 10px;
        }
        .loading.show {
            display: block;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <h2>🔐 Login</h2>
        <div class="success" id="successMessage">Login successful!</div>
        <form id="loginForm">
            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" required placeholder="Enter your email">
                <div class="error" id="emailError">Please enter a valid email address</div>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" required placeholder="Enter your password">
                <div class="error" id="passwordError">Password must be at least 8 characters</div>
            </div>
            <button type="submit" id="submitBtn">Login</button>
            <div class="loading" id="loading">Logging in...</div>
        </form>
        <div class="forgot-password">
            <a href="#">Forgot password?</a>
        </div>
    </div>

    <script>
        const form = document.getElementById('loginForm');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const emailError = document.getElementById('emailError');
        const passwordError = document.getElementById('passwordError');
        const successMessage = document.getElementById('successMessage');
        const submitBtn = document.getElementById('submitBtn');
        const loading = document.getElementById('loading');

        function validateEmail(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        }

        function validatePassword(password) {
            return password.length >= 8;
        }

        emailInput.addEventListener('blur', () => {
            if (!validateEmail(emailInput.value)) {
                emailError.classList.add('show');
            } else {
                emailError.classList.remove('show');
            }
        });

        passwordInput.addEventListener('blur', () => {
            if (!validatePassword(passwordInput.value)) {
                passwordError.classList.add('show');
            } else {
                passwordError.classList.remove('show');
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Reset errors
            emailError.classList.remove('show');
            passwordError.classList.remove('show');
            successMessage.classList.remove('show');

            // Validate
            let isValid = true;
            if (!validateEmail(emailInput.value)) {
                emailError.classList.add('show');
                isValid = false;
            }
            if (!validatePassword(passwordInput.value)) {
                passwordError.classList.add('show');
                isValid = false;
            }

            if (!isValid) return;

            // Show loading
            submitBtn.disabled = true;
            loading.classList.add('show');

            // Simulate API call
            setTimeout(() => {
                loading.classList.remove('show');
                submitBtn.disabled = false;
                
                // Simulate successful login
                successMessage.classList.add('show');
                form.reset();
                
                // Redirect after 2 seconds
                setTimeout(() => {
                    console.log('Redirecting to dashboard...');
                    // window.location.href = '/dashboard';
                }, 2000);
            }, 1500);
        });
    </script>
</body>
</html>`;
  }

  private getChatTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat App</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f0f2f5;
            height: 100vh;
            display: flex;
        }
        .sidebar {
            width: 300px;
            background: white;
            border-right: 1px solid #ddd;
            display: flex;
            flex-direction: column;
        }
        .sidebar-header {
            padding: 20px;
            background: #075e54;
            color: white;
        }
        .user-list {
            flex: 1;
            overflow-y: auto;
        }
        .user-item {
            padding: 15px 20px;
            border-bottom: 1px solid #f0f0f0;
            cursor: pointer;
            transition: background 0.3s;
        }
        .user-item:hover {
            background: #f5f5f5;
        }
        .user-item.active {
            background: #e3f2fd;
        }
        .chat-container {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        .chat-header {
            padding: 20px;
            background: white;
            border-bottom: 1px solid #ddd;
        }
        .chat-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f0f2f5"/><circle cx="50" cy="50" r="1" fill="%23ddd"/></svg>');
        }
        .message {
            margin-bottom: 15px;
            display: flex;
        }
        .message.sent {
            justify-content: flex-end;
        }
        .message-bubble {
            max-width: 60%;
            padding: 10px 15px;
            border-radius: 18px;
            word-wrap: break-word;
        }
        .message.received .message-bubble {
            background: white;
            border: 1px solid #ddd;
        }
        .message.sent .message-bubble {
            background: #0084ff;
            color: white;
        }
        .message-time {
            font-size: 11px;
            color: #999;
            margin-top: 5px;
        }
        .message.sent .message-time {
            color: rgba(255,255,255,0.7);
            text-align: right;
        }
        .chat-input {
            padding: 20px;
            background: white;
            border-top: 1px solid #ddd;
            display: flex;
            gap: 10px;
        }
        .chat-input input {
            flex: 1;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 24px;
            outline: none;
            font-size: 14px;
        }
        .chat-input button {
            padding: 0 20px;
            background: #0084ff;
            color: white;
            border: none;
            border-radius: 24px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s;
        }
        .chat-input button:hover {
            background: #0073e6;
        }
        .typing-indicator {
            padding: 10px 15px;
            background: #e0e0e0;
            border-radius: 18px;
            display: inline-block;
            margin-bottom: 10px;
            display: none;
        }
        .typing-indicator.show {
            display: inline-block;
        }
        .typing-indicator span {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #999;
            margin: 0 2px;
            animation: typing 1.4s infinite;
        }
        .typing-indicator span:nth-child(2) {
            animation-delay: 0.2s;
        }
        .typing-indicator span:nth-child(3) {
            animation-delay: 0.4s;
        }
        @keyframes typing {
            0%, 60%, 100% {
                transform: translateY(0);
            }
            30% {
                transform: translateY(-10px);
            }
        }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-header">
            <h3>Chat App</h3>
        </div>
        <div class="user-list" id="userList">
            <div class="user-item active" data-user="Alice">Alice</div>
            <div class="user-item" data-user="Bob">Bob</div>
            <div class="user-item" data-user="Charlie">Charlie</div>
            <div class="user-item" data-user="Diana">Diana</div>
        </div>
    </div>
    
    <div class="chat-container">
        <div class="chat-header">
            <h3 id="currentUser">Alice</h3>
        </div>
        <div class="chat-messages" id="chatMessages">
            <div class="message received">
                <div class="message-bubble">
                    Hey! How are you doing?
                    <div class="message-time">10:30 AM</div>
                </div>
            </div>
            <div class="message sent">
                <div class="message-bubble">
                    I'm good! Just working on some code. You?
                    <div class="message-time">10:32 AM</div>
                </div>
            </div>
            <div class="typing-indicator" id="typingIndicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
        <div class="chat-input">
            <input type="text" id="messageInput" placeholder="Type a message...">
            <button onclick="sendMessage()">Send</button>
        </div>
    </div>
    
    <script>
        const messageInput = document.getElementById('messageInput');
        const chatMessages = document.getElementById('chatMessages');
        const typingIndicator = document.getElementById('typingIndicator');
        const currentUserEl = document.getElementById('currentUser');
        let currentUser = 'Alice';
        
        // Store messages for each user
        const userMessages = {
            'Alice': [
                { text: "Hey! How are you doing?", sent: false, time: "10:30 AM" },
                { text: "I'm good! Just working on some code. You?", sent: true, time: "10:32 AM" }
            ],
            'Bob': [
                { text: "Did you see the game last night?", sent: false, time: "9:15 PM" }
            ],
            'Charlie': [
                { text: "Meeting at 3pm today?", sent: false, time: "2:00 PM" },
                { text: "Yes, see you there!", sent: true, time: "2:01 PM" }
            ],
            'Diana': []
        };
        
        function formatTime() {
            const now = new Date();
            let hours = now.getHours();
            const minutes = now.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const minutesStr = minutes < 10 ? '0' + minutes : minutes;
            return hours + ':' + minutesStr + ' ' + ampm;
        }
        
        function sendMessage() {
            const text = messageInput.value.trim();
            if (!text) return;
            
            const message = {
                text: text,
                sent: true,
                time: formatTime()
            };
            
            userMessages[currentUser].push(message);
            addMessageToChat(message);
            messageInput.value = '';
            
            // Simulate response
            simulateResponse();
        }
        
        function addMessageToChat(message) {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${message.sent ? 'sent' : 'received'}\`;
            messageDiv.innerHTML = \`
                <div class="message-bubble">
                    \${message.text}
                    <div class="message-time">\${message.time}</div>
                </div>
            \`;
            chatMessages.insertBefore(messageDiv, typingIndicator);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        function simulateResponse() {
            typingIndicator.classList.add('show');
            
            setTimeout(() => {
                typingIndicator.classList.remove('show');
                
                const responses = [
                    "That's interesting!",
                    "Tell me more about that.",
                    "I see what you mean.",
                    "That sounds great!",
                    "Thanks for sharing!",
                    "How did that work out?",
                    "I totally agree!"
                ];
                
                const response = {
                    text: responses[Math.floor(Math.random() * responses.length)],
                    sent: false,
                    time: formatTime()
                };
                
                userMessages[currentUser].push(response);
                addMessageToChat(response);
            }, 1000 + Math.random() * 2000);
        }
        
        function loadUserChat(userName) {
            currentUser = userName;
            currentUserEl.textContent = userName;
            chatMessages.innerHTML = '<div class="typing-indicator" id="typingIndicator"><span></span><span></span><span></span></div>';
            typingIndicator = document.getElementById('typingIndicator');
            
            const messages = userMessages[userName];
            messages.forEach(message => addMessageToChat(message));
        }
        
        // User selection
        document.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', function() {
                document.querySelectorAll('.user-item').forEach(u => u.classList.remove('active'));
                this.classList.add('active');
                loadUserChat(this.dataset.user);
            });
        });
        
        // Enter key support
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    </script>
</body>
</html>`;
  }

  private getInvadersTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Space Invaders</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: 'Courier New', monospace;
        }
        #gameContainer {
            text-align: center;
        }
        #gameCanvas {
            border: 2px solid #0f0;
            box-shadow: 0 0 20px #0f0;
        }
        #scoreBoard {
            color: #0f0;
            font-size: 20px;
            margin-bottom: 10px;
        }
        #gameOver {
            color: #f00;
            font-size: 30px;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: none;
        }
        .controls {
            color: #0f0;
            margin-top: 10px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div id="gameContainer">
        <div id="scoreBoard">
            SCORE: <span id="score">0</span> | LIVES: <span id="lives">3</span>
        </div>
        <canvas id="gameCanvas" width="800" height="600"></canvas>
        <div class="controls">
            Arrow Keys: Move | Space: Shoot | R: Restart
        </div>
        <div id="gameOver">GAME OVER<br>Press R to Restart</div>
    </div>

    <script>
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const scoreEl = document.getElementById('score');
        const livesEl = document.getElementById('lives');
        const gameOverEl = document.getElementById('gameOver');

        // Game state
        let score = 0;
        let lives = 3;
        let gameActive = true;
        let keys = {};

        // Player
        const player = {
            x: canvas.width / 2 - 20,
            y: canvas.height - 60,
            width: 40,
            height: 30,
            speed: 5
        };

        // Bullets
        const bullets = [];
        const bulletSpeed = 7;
        const bulletWidth = 3;
        const bulletHeight = 10;

        // Enemy bullets
        const enemyBullets = [];
        const enemyBulletSpeed = 3;

        // Invaders
        const invaders = [];
        const invaderRows = 5;
        const invaderCols = 11;
        const invaderWidth = 30;
        const invaderHeight = 25;
        const invaderSpeed = 0.5;
        let invaderDirection = 1;
        let invaderDropDistance = 40;

        // Initialize invaders
        function initInvaders() {
            invaders.length = 0;
            for (let row = 0; row < invaderRows; row++) {
                for (let col = 0; col < invaderCols; col++) {
                    invaders.push({
                        x: col * (invaderWidth + 15) + 80,
                        y: row * (invaderHeight + 15) + 50,
                        width: invaderWidth,
                        height: invaderHeight,
                        alive: true,
                        type: row < 2 ? 30 : row < 4 ? 20 : 10 // Points value
                    });
                }
            }
        }

        // Draw player
        function drawPlayer() {
            ctx.fillStyle = '#0f0';
            ctx.fillRect(player.x, player.y, player.width, 5);
            ctx.fillRect(player.x + 10, player.y - 10, 20, 10);
            ctx.fillRect(player.x + 15, player.y - 20, 10, 10);
            ctx.fillRect(player.x + 18, player.y - 25, 4, 5);
        }

        // Draw invader
        function drawInvader(invader) {
            if (!invader.alive) return;
            
            ctx.fillStyle = invader.type === 30 ? '#f00' : invader.type === 20 ? '#ff0' : '#0ff';
            
            // Simple invader shape
            ctx.fillRect(invader.x, invader.y, invader.width, invader.height * 0.6);
            ctx.fillRect(invader.x + 5, invader.y + invader.height * 0.6, 5, invader.height * 0.4);
            ctx.fillRect(invader.x + invader.width - 10, invader.y + invader.height * 0.6, 5, invader.height * 0.4);
            ctx.fillRect(invader.x + invader.width / 2 - 2, invader.y - 5, 4, 5);
            
            // Eyes
            ctx.fillStyle = '#000';
            ctx.fillRect(invader.x + 8, invader.y + 5, 3, 3);
            ctx.fillRect(invader.x + invader.width - 11, invader.y + 5, 3, 3);
        }

        // Draw bullets
        function drawBullets() {
            ctx.fillStyle = '#fff';
            bullets.forEach(bullet => {
                ctx.fillRect(bullet.x, bullet.y, bulletWidth, bulletHeight);
            });
            
            ctx.fillStyle = '#f00';
            enemyBullets.forEach(bullet => {
                ctx.fillRect(bullet.x, bullet.y, bulletWidth, bulletHeight);
            });
        }

        // Update player
        function updatePlayer() {
            if (keys['ArrowLeft'] && player.x > 0) {
                player.x -= player.speed;
            }
            if (keys['ArrowRight'] && player.x < canvas.width - player.width) {
                player.x += player.speed;
            }
        }

        // Update bullets
        function updateBullets() {
            // Player bullets
            for (let i = bullets.length - 1; i >= 0; i--) {
                bullets[i].y -= bulletSpeed;
                
                if (bullets[i].y < 0) {
                    bullets.splice(i, 1);
                    continue;
                }
                
                // Check collision with invaders
                for (let invader of invaders) {
                    if (invader.alive &&
                        bullets[i].x < invader.x + invader.width &&
                        bullets[i].x + bulletWidth > invader.x &&
                        bullets[i].y < invader.y + invader.height &&
                        bullets[i].y + bulletHeight > invader.y) {
                        
                        invader.alive = false;
                        score += invader.type;
                        scoreEl.textContent = score;
                        bullets.splice(i, 1);
                        break;
                    }
                }
            }
            
            // Enemy bullets
            for (let i = enemyBullets.length - 1; i >= 0; i--) {
                enemyBullets[i].y += enemyBulletSpeed;
                
                if (enemyBullets[i].y > canvas.height) {
                    enemyBullets.splice(i, 1);
                    continue;
                }
                
                // Check collision with player
                if (enemyBullets[i].x < player.x + player.width &&
                    enemyBullets[i].x + bulletWidth > player.x &&
                    enemyBullets[i].y < player.y + player.height &&
                    enemyBullets[i].y + bulletHeight > player.y) {
                    
                    enemyBullets.splice(i, 1);
                    lives--;
                    livesEl.textContent = lives;
                    
                    if (lives <= 0) {
                        gameOver();
                    }
                }
            }
        }

        // Update invaders
        function updateInvaders() {
            let shouldDrop = false;
            
            // Check if any invader reached the edge
            for (let invader of invaders) {
                if (!invader.alive) continue;
                
                if ((invaderDirection > 0 && invader.x + invader.width >= canvas.width - 10) ||
                    (invaderDirection < 0 && invader.x <= 10)) {
                    shouldDrop = true;
                    break;
                }
            }
            
            // Move invaders
            for (let invader of invaders) {
                if (!invader.alive) continue;
                
                if (shouldDrop) {
                    invader.y += invaderDropDistance;
                } else {
                    invader.x += invaderSpeed * invaderDirection;
                }
                
                // Check if invaders reached player
                if (invader.y + invader.height >= player.y) {
                    gameOver();
                }
            }
            
            if (shouldDrop) {
                invaderDirection *= -1;
            }
            
            // Random enemy shooting
            if (Math.random() < 0.01 && enemyBullets.length < 3) {
                const aliveInvaders = invaders.filter(i => i.alive);
                if (aliveInvaders.length > 0) {
                    const shooter = aliveInvaders[Math.floor(Math.random() * aliveInvaders.length)];
                    enemyBullets.push({
                        x: shooter.x + shooter.width / 2,
                        y: shooter.y + shooter.height
                    });
                }
            }
            
            // Check win condition
            if (invaders.every(i => !i.alive)) {
                nextWave();
            }
        }

        // Shoot bullet
        function shoot() {
            if (bullets.length < 3 && gameActive) {
                bullets.push({
                    x: player.x + player.width / 2 - bulletWidth / 2,
                    y: player.y
                });
            }
        }

        // Game over
        function gameOver() {
            gameActive = false;
            gameOverEl.style.display = 'block';
        }

        // Next wave
        function nextWave() {
            initInvaders();
            invaderSpeed *= 1.2;
        }

        // Restart game
        function restartGame() {
            score = 0;
            lives = 3;
            gameActive = true;
            invaderSpeed = 0.5;
            invaderDirection = 1;
            bullets.length = 0;
            enemyBullets.length = 0;
            player.x = canvas.width / 2 - 20;
            scoreEl.textContent = score;
            livesEl.textContent = lives;
            gameOverEl.style.display = 'none';
            initInvaders();
        }

        // Game loop
        function gameLoop() {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (gameActive) {
                updatePlayer();
                updateBullets();
                updateInvaders();
            }
            
            drawPlayer();
            invaders.forEach(drawInvader);
            drawBullets();
            
            requestAnimationFrame(gameLoop);
        }

        // Event listeners
        document.addEventListener('keydown', (e) => {
            keys[e.key] = true;
            
            if (e.key === ' ') {
                e.preventDefault();
                shoot();
            }
            
            if (e.key === 'r' || e.key === 'R') {
                restartGame();
            }
        });

        document.addEventListener('keyup', (e) => {
            keys[e.key] = false;
        });

        // Initialize game
        initInvaders();
        gameLoop();
    </script>
</body>
</html>`;
  }
}

/**
 * Export singleton instance
 */
export const templateManager = new TemplateManager();
