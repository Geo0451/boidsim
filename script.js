// ===============================================
// 1. Setup Canvas and Game Variables
// ===============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameOver = false;
let score = 0;
let gameStarted = false;

// Variables for typing game logic
let currentTypedWord = ''; // Stores what the user is currently typing
let activePipeIndex = -1; // Index of the pipe the player needs to type for

// List of words for the game
const words = [
    "apple", "banana", "orange", "grape", "kiwi", "melon", "peach", "plum", "berry", "lemon",
    "house", "car", "tree", "river", "cloud", "ocean", "mountain", "forest", "desert", "island",
    "happy", "sad", "brave", "calm", "eager", "funny", "gentle", "humble", "jolly", "kind",
    "quick", "brown", "fox", "jumps", "over", "lazy", "dog", "the", "cat", "sun"
];

// ===============================================
// 2. Bird Object
// ===============================================

const bird = {
    x: 100,
    y: canvas.height / 2, // Bird's Y position is now controlled by typing
    width: 30,
    height: 30,
    // No gravity or velocity needed for this version
};

// ===============================================
// 3. Pipes Array and Word Assignment
// ===============================================

const pipes = [];
const pipeWidth = 100; // Wider pipes for words
const pipeGap = 180;   // Gap size for the bird to pass through
const pipeSpeed = 2;   // Slower speed for typing game

// Function to create a new set of pipes with a word
function createPipe() {
    // Random Y position for the top of the gap
    const minGapY = 50;
    const maxGapY = canvas.height - pipeGap - 50;
    const gapY = Math.floor(Math.random() * (maxGapY - minGapY + 1)) + minGapY;

    // Select a random word for this pipe set
    const randomWord = words[Math.floor(Math.random() * words.length)];

    pipes.push({
        x: canvas.width,
        gapY: gapY,
        width: pipeWidth,
        gapHeight: pipeGap,
        word: randomWord,
        passed: false // Flag to check if the bird has successfully passed this pipe
    });
}

let pipeSpawnTimer = 0;
const pipeSpawnInterval = 200; // How often new pipes appear (in frames)

// ===============================================
// 4. Input Handling
// ===============================================

document.addEventListener('keydown', e => {
    // Start the game with Spacebar
    if (!gameStarted && e.code === 'Space') {
        startGame();
        return; // Prevent further processing if just starting
    }

    if (gameOver) {
        if (e.code === 'Space') {
            startGame(); // Restart the game
        }
        return; // Do nothing else if game is over
    }

    const key = e.key.toLowerCase(); // Get the pressed key

    // If the key is a letter, append it to the typed word
    if (key.length === 1 && key.match(/[a-z]/i)) {
        currentTypedWord += key;
    }
    // Handle backspace to delete the last character
    else if (e.code === 'Backspace') {
        currentTypedWord = currentTypedWord.slice(0, -1);
    }
    // Handle Spacebar (only for game start/restart now)
    else if (e.code === 'Space') {
        // No action for space during active gameplay in this version
    }

    // Check if the current typed word matches the active pipe's word
    if (activePipeIndex !== -1 && pipes[activePipeIndex]) {
        const targetPipe = pipes[activePipeIndex];
        if (currentTypedWord === targetPipe.word) {
            // Correct word typed! Move the bird to pass through the gap
            bird.y = targetPipe.gapY + (targetPipe.gapHeight / 2) - (bird.height / 2);
            targetPipe.passed = true; // Mark this pipe as passed
            score++;
            currentTypedWord = ''; // Reset the typed word for the next pipe
            activePipeIndex = -1; // No active pipe until the next one comes into view
        }
    }
});

// ===============================================
// 5. Game Loop Functions
// ===============================================

function update() {
    if (!gameStarted || gameOver) return;

    // Bird's Y position is only changed by typing, not by physics

    // Pipe generation
    pipeSpawnTimer++;
    if (pipeSpawnTimer > pipeSpawnInterval) {
        createPipe();
        pipeSpawnTimer = 0;
    }

    // Move pipes
    pipes.forEach(pipe => {
        pipe.x -= pipeSpeed;
    });

    // Assign the next pipe to be typed
    // This logic ensures 'activePipeIndex' points to the first unpassed pipe
    if (activePipeIndex === -1 && pipes.length > 0) {
        // Find the first pipe that is approaching the bird and hasn't been passed
        const nextPipeToType = pipes.findIndex(p => p.x + p.width > bird.x && !p.passed);
        if (nextPipeToType !== -1) {
            activePipeIndex = nextPipeToType;
        }
    }


    // Remove pipes that are off-screen and check for game over if not passed
    if (pipes.length > 0 && pipes[0].x + pipes[0].width < 0) {
        // If the first pipe went off-screen and was NOT passed, it's game over
        if (!pipes[0].passed) {
            endGame();
            return; // Stop updating if game is over
        }
        pipes.shift(); // Remove the first pipe from the array
        // If the removed pipe was the active one, reset activePipeIndex
        if (activePipeIndex === 0) {
            activePipeIndex = -1;
        } else if (activePipeIndex > 0) {
            activePipeIndex--; // Shift index if pipes before it were removed
        }
    }

    // Check for "collision" (failure to type in time)
    checkCollision();
}

function draw() {
    // Clear the canvas for redrawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = 'skyblue';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the bird
    ctx.fillStyle = 'gold';
    ctx.fillRect(bird.x, bird.y, bird.width, bird.height);

    // Draw the pipes and their words
    ctx.fillStyle = 'green';
    pipes.forEach((pipe, index) => {
        // Draw top part of the pipe
        ctx.fillRect(pipe.x, 0, pipe.width, pipe.gapY);
        // Draw bottom part of the pipe
        ctx.fillRect(pipe.x, pipe.gapY + pipe.gapHeight, pipe.width, canvas.height - (pipe.gapY + pipe.gapHeight));

        // Draw the word on the pipe
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; // Center text vertically in the gap

        // Highlight the word if it's the active one to type
        if (index === activePipeIndex) {
            // Draw the correctly typed part in one color (e.g., green)
            ctx.fillStyle = 'lime';
            const typedPart = pipe.word.substring(0, currentTypedWord.length);
            const untypedPart = pipe.word.substring(currentTypedWord.length);
            
            const typedWidth = ctx.measureText(typedPart).width;
            const totalWidth = ctx.measureText(pipe.word).width;

            // Position the text to be centered
            const startX = pipe.x + pipe.width / 2 - totalWidth / 2;
            
            ctx.fillText(typedPart, startX + typedWidth / 2, pipe.gapY + pipe.gapHeight / 2);

            // Draw the remaining untyped part in another color (e.g., red)
            ctx.fillStyle = 'red';
            ctx.fillText(untypedPart, startX + typedWidth + ctx.measureText(untypedPart).width / 2, pipe.gapY + pipe.gapHeight / 2);

        } else {
            // Draw regular word for non-active pipes
            ctx.fillStyle = 'white';
            ctx.fillText(pipe.word, pipe.x + pipe.width / 2, pipe.gapY + pipe.gapHeight / 2);
        }
    });

    // Draw the score
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 10, 30);

    // Draw the current typed word
    ctx.fillText('Typing: ' + currentTypedWord, 10, 60);


    // Draw game over screen
    if (gameOver) {
        ctx.font = '48px Arial';
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 50);
        ctx.font = '24px Arial';
        ctx.fillText('Your Score: ' + score, canvas.width / 2, canvas.height / 2);
        ctx.fillText('Press Space to Restart', canvas.width / 2, canvas.height / 2 + 50);
    }

    // Draw start screen
    if (!gameStarted && !gameOver) {
        ctx.font = '48px Arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.fillText('Typing Bird', canvas.width / 2, canvas.height / 2 - 50);
        ctx.font = '24px Arial';
        ctx.fillText('Type the words to pass!', canvas.width / 2, canvas.height / 2);
        ctx.fillText('Press Space to Start', canvas.width / 2, canvas.height / 2 + 50);
    }
}

function checkCollision() {
    // Collision in this game means failing to type the word in time
    if (activePipeIndex !== -1 && pipes[activePipeIndex]) {
        const pipe = pipes[activePipeIndex];
        // If the bird's front edge passes the pipe's back edge AND the pipe wasn't passed
        if (bird.x > pipe.x + pipe.width && !pipe.passed) {
            endGame();
        }
    }
}

function endGame() {
    gameOver = true;
    gameStarted = false; // Ensure gameStarted is false on game over
}

function startGame() {
    gameStarted = true;
    gameOver = false;
    score = 0;
    bird.y = canvas.height / 2; // Reset bird position
    pipes.length = 0; // Clear all pipes
    pipeSpawnTimer = 0;
    currentTypedWord = ''; // Clear typed word
    activePipeIndex = -1; // Reset active pipe
    createPipe(); // Create the first pipe immediately
}

// Main game loop using requestAnimationFrame for smooth animation
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the game loop when the script loads
gameLoop();