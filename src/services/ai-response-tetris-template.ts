/**
 * Complete Tetris Template with Dynamic Theming
 * This is the corrected template for generateTetrisGame method
 */

export function generateTetrisGameTemplate(input: string): string {
  // Detect theme based on keywords
  const hasBlackBackground = /\b(black|dark)\b/i.test(input);

  // Define theme variables
  const bgBody = hasBlackBackground ? "#000" : "#f7f7f7";
  const panelBg = hasBlackBackground ? "#111" : "#fff";
  const border = hasBlackBackground ? "#333" : "#ddd";
  const text = hasBlackBackground ? "#fff" : "#222";
  const subText = hasBlackBackground ? "#ccc" : "#555";
  const stroke = hasBlackBackground ? "#fff" : "#444";
  const canvasBg = hasBlackBackground ? "#000" : "#fafafa";
  const scoreDisplayBg = hasBlackBackground ? "#222" : "#f0f0f0";

  return `Perfect! I'll create a complete Tetris game with HTML5, CSS, and JavaScript all in one file.

Here's your complete index.html${hasBlackBackground ? " with black background" : ""}:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tetris Game${hasBlackBackground ? " - Black Theme" : ""}</title>
    <style>
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background-color: ${bgBody};
            font-family: 'Courier New', monospace;
            color: ${text};
        }
        .game-container {
            display: flex;
            gap: 30px;
            padding: 20px;
            background-color: ${panelBg};
            border: 2px solid ${border};
            border-radius: 10px;
        }
        canvas {
            border: 2px solid ${stroke};
            background-color: ${canvasBg};
            display: block;
        }
        .game-info {
            min-width: 200px;
        }
        .score-display {
            background-color: ${scoreDisplayBg};
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border: 1px solid ${border};
        }
        .controls {
            background-color: ${scoreDisplayBg};
            padding: 15px;
            border-radius: 5px;
            border: 1px solid ${border};
        }
        h2 { margin: 0 0 15px 0; text-align: center; color: ${text}; }
        h3 { margin: 0 0 10px 0; color: ${subText}; }
        .score-item { margin: 8px 0; font-size: 16px; }
        p { margin: 5px 0; color: ${subText}; }
        .game-over {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, ${hasBlackBackground ? "0.9" : "0.8"});
            color: #fff;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            display: none;
        }
    </style>
</head>
<body>
    <div class="game-container">
        <canvas id="tetris" width="300" height="600"></canvas>
        <div class="game-info">
            <h2>🎮 TETRIS</h2>
            <div class="score-display">
                <div class="score-item">Score: <span id="score">0</span></div>
                <div class="score-item">Lines: <span id="lines">0</span></div>
                <div class="score-item">Level: <span id="level">1</span></div>
            </div>
            <div class="controls">
                <h3>Controls:</h3>
                <p>← → Move</p>
                <p>↓ Soft Drop</p>
                <p>Space: Hard Drop</p>
                <p>Z: Rotate</p>
                <p>R: Restart</p>
            </div>
        </div>
    </div>
    
    <div class="game-over" id="gameOver">
        <h2>Game Over!</h2>
        <p>Final Score: <span id="finalScore">0</span></p>
        <p>Press R to restart</p>
    </div>

    <script>
        // Complete Tetris Game Implementation
        const canvas = document.getElementById('tetris');
        const ctx = canvas.getContext('2d');
        const BLOCK_SIZE = 30;
        const BOARD_WIDTH = 10;
        const BOARD_HEIGHT = 20;

        // Tetris pieces with all rotations
        const PIECES = {
            I: [
                [[1,1,1,1]],
                [[1],[1],[1],[1]]
            ],
            O: [
                [[1,1],[1,1]]
            ],
            T: [
                [[0,1,0],[1,1,1]],
                [[1,0],[1,1],[1,0]],
                [[1,1,1],[0,1,0]],
                [[0,1],[1,1],[0,1]]
            ],
            S: [
                [[0,1,1],[1,1,0]],
                [[1,0],[1,1],[0,1]]
            ],
            Z: [
                [[1,1,0],[0,1,1]],
                [[0,1],[1,1],[1,0]]
            ],
            J: [
                [[1,0,0],[1,1,1]],
                [[1,1],[1,0],[1,0]],
                [[1,1,1],[0,0,1]],
                [[0,1],[0,1],[1,1]]
            ],
            L: [
                [[0,0,1],[1,1,1]],
                [[1,0],[1,0],[1,1]],
                [[1,1,1],[1,0,0]],
                [[1,1],[0,1],[0,1]]
            ]
        };

        // Bright colors for pieces
        const COLORS = [
            '#000000', // 0: empty
            '#FF0D72', // 1: pink
            '#0DC2FF', // 2: cyan  
            '#0DFF72', // 3: green
            '#F538FF', // 4: purple
            '#FF8E0D', // 5: orange
            '#FFE138', // 6: yellow
            '#3877FF'  // 7: blue
        ];

        // Game state
        let board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
        let currentPiece = null;
        let score = 0;
        let lines = 0;
        let level = 1;
        let dropCounter = 0;
        let dropInterval = 1000;
        let lastTime = 0;
        let gameRunning = true;

        // Create a new piece
        function createPiece() {
            const pieces = Object.keys(PIECES);
            const type = pieces[Math.floor(Math.random() * pieces.length)];
            return {
                shape: PIECES[type][0],
                x: Math.floor(BOARD_WIDTH / 2) - Math.floor(PIECES[type][0][0].length / 2),
                y: 0,
                type: type,
                rotation: 0,
                color: Math.floor(Math.random() * 7) + 1
            };
        }

        // Draw the game
        function draw() {
            // Clear canvas
            ctx.fillStyle = '${canvasBg}';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw board
            for (let y = 0; y < BOARD_HEIGHT; y++) {
                for (let x = 0; x < BOARD_WIDTH; x++) {
                    if (board[y][x]) {
                        ctx.fillStyle = COLORS[board[y][x]];
                        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                        ctx.strokeStyle = '${stroke}';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    }
                }
            }

            // Draw current piece
            if (currentPiece && gameRunning) {
                ctx.fillStyle = COLORS[currentPiece.color];
                currentPiece.shape.forEach((row, y) => {
                    row.forEach((value, x) => {
                        if (value) {
                            const drawX = (currentPiece.x + x) * BLOCK_SIZE;
                            const drawY = (currentPiece.y + y) * BLOCK_SIZE;
                            ctx.fillRect(drawX, drawY, BLOCK_SIZE, BLOCK_SIZE);
                            ctx.strokeStyle = '${stroke}';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(drawX, drawY, BLOCK_SIZE, BLOCK_SIZE);
                        }
                    });
                });
            }
        }

        // Check if move is valid
        function isValidMove(piece, dx = 0, dy = 0, rotation = null) {
            const shape = rotation !== null ? PIECES[piece.type][rotation] : piece.shape;
            return shape.every((row, y) =>
                row.every((value, x) => {
                    if (!value) return true;
                    const newX = piece.x + x + dx;
                    const newY = piece.y + y + dy;
                    return newX >= 0 && newX < BOARD_WIDTH && 
                           newY < BOARD_HEIGHT && 
                           (newY < 0 || !board[newY][newX]);
                })
            );
        }

        // Place piece on board
        function placePiece() {
            currentPiece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        const boardX = currentPiece.x + x;
                        const boardY = currentPiece.y + y;
                        if (boardY >= 0) {
                            board[boardY][boardX] = currentPiece.color;
                        }
                    }
                });
            });
        }

        // Clear completed lines
        function clearLines() {
            let linesCleared = 0;
            for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
                if (board[y].every(cell => cell !== 0)) {
                    board.splice(y, 1);
                    board.unshift(Array(BOARD_WIDTH).fill(0));
                    linesCleared++;
                    y++;
                }
            }
            if (linesCleared > 0) {
                lines += linesCleared;
                score += linesCleared * 100 * level;
                level = Math.floor(lines / 10) + 1;
                dropInterval = Math.max(50, 1000 - (level - 1) * 50);
                updateScore();
            }
        }

        // Update score display
        function updateScore() {
            document.getElementById('score').textContent = score;
            document.getElementById('lines').textContent = lines;
            document.getElementById('level').textContent = level;
        }

        // Game over
        function gameOver() {
            gameRunning = false;
            document.getElementById('finalScore').textContent = score;
            document.getElementById('gameOver').style.display = 'block';
        }

        // Restart game
        function resetGame() {
            board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
            score = 0;
            lines = 0;
            level = 1;
            dropInterval = 1000;
            gameRunning = true;
            document.getElementById('gameOver').style.display = 'none';
            updateScore();
            currentPiece = createPiece();
        }

        // Main game loop
        function gameLoop(time = 0) {
            const deltaTime = time - lastTime;
            lastTime = time;
            
            if (gameRunning) {
                dropCounter += deltaTime;

                if (dropCounter > dropInterval) {
                    if (isValidMove(currentPiece, 0, 1)) {
                        currentPiece.y++;
                    } else {
                        placePiece();
                        clearLines();
                        currentPiece = createPiece();
                        if (!isValidMove(currentPiece)) {
                            gameOver();
                        }
                    }
                    dropCounter = 0;
                }
            }
            
            draw();
            requestAnimationFrame(gameLoop);
        }

        // Controls
        document.addEventListener('keydown', (e) => {
            if (!gameRunning && e.code !== 'KeyR') return;
            
            switch (e.code) {
                case 'ArrowLeft':
                    e.preventDefault();
                    if (isValidMove(currentPiece, -1, 0)) {
                        currentPiece.x--;
                    }
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (isValidMove(currentPiece, 1, 0)) {
                        currentPiece.x++;
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (isValidMove(currentPiece, 0, 1)) {
                        currentPiece.y++;
                        score++;
                        updateScore();
                    }
                    break;
                case 'Space':
                    e.preventDefault();
                    while (isValidMove(currentPiece, 0, 1)) {
                        currentPiece.y++;
                        score += 2;
                    }
                    updateScore();
                    break;
                case 'KeyZ':
                    e.preventDefault();
                    const nextRotation = (currentPiece.rotation + 1) % PIECES[currentPiece.type].length;
                    if (isValidMove(currentPiece, 0, 0, nextRotation)) {
                        currentPiece.rotation = nextRotation;
                        currentPiece.shape = PIECES[currentPiece.type][nextRotation];
                    }
                    break;
                case 'KeyR':
                    e.preventDefault();
                    resetGame();
                    break;
            }
        });

        // Initialize game
        currentPiece = createPiece();
        updateScore();
        requestAnimationFrame(gameLoop);
    </script>
</body>
</html>
\`\`\`

This is a complete, fully functional Tetris game with:

✅ **${hasBlackBackground ? "Black background theme" : "Light theme"}** as ${hasBlackBackground ? "requested" : "default"}
✅ **Complete game mechanics**: piece movement, rotation, line clearing
✅ **All standard Tetris pieces**: I, O, T, S, Z, J, L with proper rotations  
✅ **Scoring system**: points, lines cleared, level progression
✅ **Full keyboard controls**: arrow keys, space, Z for rotation, R for restart
✅ **Game over detection** with restart functionality
✅ **Modern styling** with clean UI

Save this as \`index.html\` and open it in any browser to play immediately!`;
}
