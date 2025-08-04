document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('boidCanvas');
    const ctx = canvas.getContext('2d');

    // Get control elements
    const numBoidsSlider = document.getElementById('numBoids');
    const numBoidsValueSpan = document.getElementById('numBoidsValue');
    const separationSlider = document.getElementById('separationSlider');
    const separationValueSpan = document.getElementById('separationValue');
    const alignmentSlider = document.getElementById('alignmentSlider');
    const alignmentValueSpan = document.getElementById('alignmentValue');
    const cohesionSlider = document.getElementById('cohesionSlider');
    const cohesionValueSpan = document.getElementById('cohesionValue');
    const resetButton = document.getElementById('resetButton');

    // Simulation parameters
    let NUM_BOIDS = parseInt(numBoidsSlider.value);
    let PERCEPTION_RADIUS = 100; // How far a boid "sees" other boids
    let MAX_FORCE = 0.5; // Max steering force
    let MAX_SPEED = 5;   // Max speed of a boid

    // Rule weights
    let SEPARATION_WEIGHT = parseFloat(separationSlider.value);
    let ALIGNMENT_WEIGHT = parseFloat(alignmentSlider.value);
    let COHESION_WEIGHT = parseFloat(cohesionSlider.value);

    let boids = [];
    let animationFrameId;

    // --- Vector Utility Class ---
    // A simple 2D vector class for easier calculations
    class Vector {
        constructor(x, y) {
            this.x = x || 0;
            this.y = y || 0;
        }

        add(other) {
            this.x += other.x;
            this.y += other.y;
            return this;
        }

        sub(other) {
            this.x -= other.x;
            this.y -= other.y;
            return this;
        }

        mult(scalar) {
            this.x *= scalar;
            this.y *= scalar;
            return this;
        }

        div(scalar) {
            this.x /= scalar;
            this.y /= scalar;
            return this;
        }

        mag() {
            return Math.sqrt(this.x * this.x + this.y * this.y);
        }

        normalize() {
            const m = this.mag();
            if (m > 0) {
                this.div(m);
            }
            return this;
        }

        setMag(mag) {
            return this.normalize().mult(mag);
        }

        limit(max) {
            if (this.mag() > max) {
                this.setMag(max);
            }
            return this;
        }

        copy() {
            return new Vector(this.x, this.y);
        }

        static dist(v1, v2) {
            return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2));
        }
    }

    // --- Boid Class ---
    class Boid {
        constructor() {
            // Random initial position within canvas bounds
            this.position = new Vector(Math.random() * canvas.width, Math.random() * canvas.height);
            // Random initial velocity
            this.velocity = new Vector(Math.random() * 4 - 2, Math.random() * 4 - 2);
            this.velocity.limit(MAX_SPEED); // Ensure initial velocity is within limits
            this.acceleration = new Vector(0, 0);
            this.size = 5; // Size of the boid triangle
            this.color = `hsl(${Math.random() * 360}, 70%, 70%)`; // Random color for each boid
        }

        // Apply a force to the boid's acceleration
        applyForce(force) {
            this.acceleration.add(force);
        }

        // --- Flocking Rules ---

        // 1. Separation: Steer to avoid crowding local flockmates
        separation(boids) {
            let steering = new Vector(0, 0);
            let total = 0;
            const desiredSeparation = this.size * 6; // Distance to maintain from other boids

            for (let other of boids) {
                if (other !== this) {
                    let d = Vector.dist(this.position, other.position);
                    if (d < desiredSeparation) {
                        let diff = this.position.copy().sub(other.position);
                        diff.div(d * d); // Weight by distance squared
                        steering.add(diff);
                        total++;
                    }
                }
            }
            if (total > 0) {
                steering.div(total);
                steering.setMag(MAX_SPEED);
                steering.sub(this.velocity);
                steering.limit(MAX_FORCE);
            }
            return steering;
        }

        // 2. Alignment: Steer towards the average heading of local flockmates
        alignment(boids) {
            let steering = new Vector(0, 0);
            let total = 0;

            for (let other of boids) {
                if (other !== this && Vector.dist(this.position, other.position) < PERCEPTION_RADIUS) {
                    steering.add(other.velocity);
                    total++;
                }
            }
            if (total > 0) {
                steering.div(total);
                steering.setMag(MAX_SPEED);
                steering.sub(this.velocity);
                steering.limit(MAX_FORCE);
            }
            return steering;
        }

        // 3. Cohesion: Steer to move towards the average position (center of mass) of local flockmates
        cohesion(boids) {
            let steering = new Vector(0, 0);
            let total = 0;

            for (let other of boids) {
                if (other !== this && Vector.dist(this.position, other.position) < PERCEPTION_RADIUS) {
                    steering.add(other.position);
                    total++;
                }
            }
            if (total > 0) {
                steering.div(total);
                steering.sub(this.position); // Vector from current position to center of mass
                steering.setMag(MAX_SPEED);
                steering.sub(this.velocity);
                steering.limit(MAX_FORCE);
            }
            return steering;
        }

        // Apply flocking rules
        flock(boids) {
            let sep = this.separation(boids);
            let ali = this.alignment(boids);
            let coh = this.cohesion(boids);

            // Apply weights to each rule
            sep.mult(SEPARATION_WEIGHT);
            ali.mult(ALIGNMENT_WEIGHT);
            coh.mult(COHESION_WEIGHT);

            this.applyForce(sep);
            this.applyForce(ali);
            this.applyForce(coh);
        }

        // Update boid's position and velocity
        update() {
            this.velocity.add(this.acceleration);
            this.velocity.limit(MAX_SPEED);
            this.position.add(this.velocity);
            this.acceleration.mult(0); // Reset acceleration for next frame
        }

        // Handle canvas boundaries (wrap around)
        edges() {
            if (this.position.x > canvas.width) {
                this.position.x = 0;
            } else if (this.position.x < 0) {
                this.position.x = canvas.width;
            }
            if (this.position.y > canvas.height) {
                this.position.y = 0;
            } else if (this.position.y < 0) {
                this.position.y = canvas.height;
            }
        }

        // Draw the boid as a triangle
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();

            // Calculate angle of velocity for rotation
            const angle = Math.atan2(this.velocity.y, this.velocity.x);

            // Draw a triangle pointing in the direction of velocity
            ctx.translate(this.position.x, this.position.y);
            ctx.rotate(angle);

            ctx.moveTo(this.size * 2, 0); // Tip of the triangle
            ctx.lineTo(-this.size, -this.size); // Bottom left
            ctx.lineTo(-this.size, this.size);  // Bottom right
            ctx.closePath();
            ctx.fill();

            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transformation
        }
    }

    // --- Simulation Initialization and Loop ---

    // Function to initialize/reset the simulation
    function initSimulation() {
        cancelAnimationFrame(animationFrameId); // Stop any existing animation
        boids = [];
        for (let i = 0; i < NUM_BOIDS; i++) {
            boids.push(new Boid());
        }
        animate(); // Start the new animation loop
    }

    // Animation loop
    function animate() {
        // Resize canvas to fit its current CSS dimensions
        // This is crucial for responsiveness and preventing blurriness
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

        for (let boid of boids) {
            boid.flock(boids); // Calculate flocking forces
            boid.update();     // Update position and velocity
            boid.edges();      // Handle boundaries
            boid.draw();       // Draw the boid
        }

        animationFrameId = requestAnimationFrame(animate); // Loop
    }

    // --- Event Listeners for Controls ---

    // Update number of boids
    numBoidsSlider.addEventListener('input', () => {
        NUM_BOIDS = parseInt(numBoidsSlider.value);
        numBoidsValueSpan.textContent = NUM_BOIDS;
        initSimulation(); // Re-initialize with new number of boids
    });

    // Update separation weight
    separationSlider.addEventListener('input', () => {
        SEPARATION_WEIGHT = parseFloat(separationSlider.value);
        separationValueSpan.textContent = SEPARATION_WEIGHT.toFixed(1);
    });

    // Update alignment weight
    alignmentSlider.addEventListener('input', () => {
        ALIGNMENT_WEIGHT = parseFloat(alignmentSlider.value);
        alignmentValueSpan.textContent = ALIGNMENT_WEIGHT.toFixed(1);
    });

    // Update cohesion weight
    cohesionSlider.addEventListener('input', () => {
        COHESION_WEIGHT = parseFloat(cohesionSlider.value);
        cohesionValueSpan.textContent = COHESION_WEIGHT.toFixed(1);
    });

    // Reset button
    resetButton.addEventListener('click', () => {
        // Reset sliders to default values
        numBoidsSlider.value = 100;
        separationSlider.value = 1.5;
        alignmentSlider.value = 1.0;
        cohesionSlider.value = 1.0;

        // Update displayed values
        numBoidsValueSpan.textContent = 100;
        separationValueSpan.textContent = 1.5;
        alignmentValueSpan.textContent = 1.0;
        cohesionValueSpan.textContent = 1.0;

        // Apply reset values to simulation parameters
        NUM_BOIDS = 100;
        SEPARATION_WEIGHT = 1.5;
        ALIGNMENT_WEIGHT = 1.0;
        COHESION_WEIGHT = 1.0;

        initSimulation(); // Re-initialize simulation
    });

    // Initial setup
    initSimulation();

    // Handle window resize to adjust canvas dimensions
    window.addEventListener('resize', () => {
        // The animate function already handles canvas resizing based on CSS
        // No explicit resize call needed here, as it's part of every frame.
    });
});