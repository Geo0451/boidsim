// ===============================================
// 1. Setup Canvas and Game Variables
// ===============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state variables
let gameOver = false;
let score = 0;
let gameStarted = false;

// ===============================================
// 2. Bird Object
// ===============================================

const bird = {
    x: 100,
    y: canvas.height / 2,
    width: 30,
    height: 30,
    velocity: 0,
    gravity: 0.5,
    jumpStrength: -10
};

// ===============================================
// 3. Pipes Array
// ===============================================

const pipes = [];
const pipeWidth = 50;
const pipeGap = 150;
const pipeSpeed = 3;

// Function to generate new pipes
function createPipe() {
    const minHeight = 50;
    const maxHeight = canvas.height - pipeGap - minHeight;
    const topPipeHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

    pipes.push({
        x: canvas.width,
        y: 0,
        width: pipeWidth,
        height: topPipeHeight,
        passed: false
    });

    pipes.push({
        x: canvas.width,
        y: topPipeHeight + pipeGap,
        width: pipeWidth,
        height: canvas.height - topPipeHeight - pipeGap,
        passed: false
    });
}

let pipeSpawnTimer = 0;
const pipeSpawnInterval = 120; // Time in frames (e.g., 60 frames = 1 second)

// ===============================================
// 4. Input Handling
// ===============================================

document.addEventListener('keydown', e => {
    if (e.code === 'Space') {
        if (!gameStarted) {
            startGame();
        }
        if (!gameOver) {
            bird.velocity = bird.jumpStrength;
        }
    }
});

// ===============================================
// 5. Game Loop Functions
// ===============================================

function update() {
    if (!gameStarted || gameOver) return;

    // Bird physics
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;

    // Pipe generation and movement
    pipeSpawnTimer++;
    if (pipeSpawnTimer > pipeSpawnInterval) {
        createPipe();
        pipeSpawnTimer = 0;
    }

    pipes.forEach(pipe => {
        pipe.x -= pipeSpeed;
    });

    // Remove pipes that are off-screen
    if (pipes.length > 0 && pipes[0].x + pipes[0].width < 0) {
        pipes.splice(0, 2); // Remove both the top and bottom pipe
    }

    // Collision detection
    checkCollision();

    // Score update
    checkScore();
}

function draw() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background (optional)
    ctx.fillStyle = 'skyblue';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the bird
    ctx.fillStyle = 'yellow';
    ctx.fillRect(bird.x, bird.y, bird.width, bird.height);

    // Draw the pipes
    ctx.fillStyle = 'green';
    pipes.forEach(pipe => {
        ctx.fillRect(pipe.x, pipe.y, pipe.width, pipe.height);
    });

    // Draw the score
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.fillText('Score: ' + score, 10, 30);

    // Draw game over screen
    if (gameOver) {
        ctx.font = '48px Arial';
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 25);
        ctx.font = '24px Arial';
        ctx.fillText('Press Space to Restart', canvas.width / 2, canvas.height / 2 + 25);
    }
    
    // Draw start screen
    if (!gameStarted) {
        ctx.font = '48px Arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.fillText('Flappy Bird', canvas.width / 2, canvas.height / 2 - 25);
        ctx.font = '24px Arial';
        ctx.fillText('Press Space to Start', canvas.width / 2, canvas.height / 2 + 25);
    }
}

function checkCollision() {
    // Collision with top/bottom of canvas
    if (bird.y + bird.height > canvas.height || bird.y < 0) {
        endGame();
    }

    // Collision with pipes
    pipes.forEach(pipe => {
        if (
            bird.x < pipe.x + pipe.width &&
            bird.x + bird.width > pipe.x &&
            bird.y < pipe.y + pipe.height &&
            bird.y + bird.height > pipe.y
        ) {
            endGame();
        }
    });
}

function checkScore() {
    pipes.forEach(pipe => {
        // Check if the bird has passed the pipe and it hasn't been scored yet
        if (bird.x > pipe.x + pipe.width && !pipe.passed) {
            pipe.passed = true;
            score++;
        }
    });
}

function endGame() {
    gameOver = true;
}

function startGame() {
    gameStarted = true;
    gameOver = false;
    score = 0;
    bird.y = canvas.height / 2;
    bird.velocity = 0;
    pipes.length = 0; // Clear the pipes array
    pipeSpawnTimer = 0;
}

// Main game loop using requestAnimationFrame
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();