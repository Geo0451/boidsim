document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('boidCanvas');
    const ctx = canvas.getContext('2d');

    // Get control elements
    const numBoidsSlider = document.getElementById('numBoids');
    const numBoidsValueSpan = document.getElementById('numBoidsValue');
    const percepSlider = document.getElementById("percepSlider");
    const percepValueSpan = document.getElementById("percepValue");
    const separationSlider = document.getElementById('separationSlider');
    const separationValueSpan = document.getElementById('separationValue');
    const alignmentSlider = document.getElementById('alignmentSlider');
    const alignmentValueSpan = document.getElementById('alignmentValue');
    const cohesionSlider = document.getElementById('cohesionSlider');
    const cohesionValueSpan = document.getElementById('cohesionValue');
    const resetButton = document.getElementById('resetButton');
    const wrapAround = document.getElementById('toggleWrap');

    // Simulation parameters
    let NUM_BOIDS = parseInt(numBoidsSlider.value);
    let PERCEPTION_RADIUS = 50; // How far a boid "sees" other boids
    let MAX_FORCE = 0.5; // Max steering force
    let MAX_SPEED = 5;   // Max speed of a boid
    let wrap = true;

    // Rule weights
    let SEPARATION_WEIGHT = parseFloat(separationSlider.value);
    let ALIGNMENT_WEIGHT = parseFloat(alignmentSlider.value);
    let COHESION_WEIGHT = parseFloat(cohesionSlider.value);

    // Orb parameters
    const ORB_RADIUS = 10;
    const ORB_STRENGTH = 40; // Strength of orb

    let boids = [];
    let orbs = []; // Array to store attractor/repulsor orbs
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
            this.size = 2; // Size of the boid triangle
            this.color = `hsl(${Math.random() * 360}, 70%, 65%)`; // Random color for each boid
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

        // Apply forces from attractors/repulsors
        applyOrbForces(orbs) {
            for (let orb of orbs) {
                let force = new Vector(0, 0);
                let d = Vector.dist(this.position, orb.position);

                // Apply force if within a certain range and not at the exact center (to avoid division by zero)
                if (d > 1 && d < PERCEPTION_RADIUS * 2) {
                    let diff = orb.position.copy().sub(this.position);
                    diff.normalize(); // Direction vector

                    let strength;
                    // Force strength decreases with distance (inverse proportion to distance/radius ratio)
                    if (orb.type === 'attractor') {
                        strength = ORB_STRENGTH / d;
                    } else {
                        strength = -ORB_STRENGTH / d; // Negative for repulsion
                    }
                    force = diff.mult(strength);
                    this.applyForce(force.limit(MAX_FORCE));
                }
            }
        }

        // Update boid's position and velocity
        update() {
            this.velocity.add(this.acceleration);
            this.velocity.limit(MAX_SPEED);
            this.position.add(this.velocity);
            this.acceleration.mult(0); // Reset acceleration for next frame
        }
        

        // Handle canvas boundaries (wrap around)
        edges(wrap) {
            if (wrap)
            {
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

            else {
            // Check for horizontal boundaries
            if (this.position.x > canvas.width) {
                // Bounce off the right wall and move back inside
                this.position.x = canvas.width - 1; 
                this.velocity.x *= -1;
            } else if (this.position.x < 0) {
                // Bounce off the left wall and move back inside
                this.position.x = 1;
                this.velocity.x *= -1;
            }

            // Check for vertical boundaries
            if (this.position.y > canvas.height) {
                // Bounce off the bottom wall and move back inside
                this.position.y = canvas.height - 1;
                this.velocity.y *= -1;
            } else if (this.position.y < 0) {
                // Bounce off the top wall and move back inside
                this.position.y = 1;
                this.velocity.y *= -1;
            }
            }} 

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
        orbs = []; // Clear orbs on reset
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
            boid.applyOrbForces(orbs); // Apply forces from attractors/repulsors
            boid.update();     // Update position and velocity
            boid.edges(wrap);      // Handle boundaries
            boid.draw();       // Draw the boid
        }

        // Draw orbs
        for (let orb of orbs) {
            ctx.beginPath();
            ctx.arc(orb.position.x, orb.position.y, orb.radius, 0, Math.PI * 2);
            ctx.fillStyle = orb.color;
            ctx.fill();
            ctx.strokeStyle = orb.type === 'attractor' ? 'blue' : 'red';
            ctx.lineWidth = 2;
            ctx.stroke();
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

    percepSlider.addEventListener('input', () => {
        PERCEPTION_RADIUS = parseInt(percepSlider.value);
        percepValueSpan.textContent = PERCEPTION_RADIUS;
    })
    

    wrapAround.addEventListener('click', () => {
        wrap = !wrap;
        if (wrap) {
            wrapAround.style.backgroundColor = "green";
        }
        else wrapAround.style.backgroundColor = "red";
    });

    // Reset button
    resetButton.addEventListener('click', () => {
        // Reset sliders to default values
        numBoidsSlider.value = 500;
        separationSlider.value = 1.5;
        alignmentSlider.value = 1.0;
        cohesionSlider.value = 1.0;
        percepSlider.value = 50;

        // Update displayed values
        numBoidsValueSpan.textContent = 500;
        separationValueSpan.textContent = 1.5;
        alignmentValueSpan.textContent = 1.0;
        cohesionValueSpan.textContent = 1.0;
        percepValueSpan.textContent = 50;

        // Apply reset values to simulation parameters
        NUM_BOIDS = 500;
        SEPARATION_WEIGHT = 1.5;
        ALIGNMENT_WEIGHT = 1.0;
        COHESION_WEIGHT = 1.0;
        PERCEPTION_RADIUS = 50;

        initSimulation(); // Re-initialize simulation
    });

    // --- Mouse Event Listeners for Orbs ---
    canvas.addEventListener('mousedown', (event) => {
        // Get mouse coordinates relative to the canvas
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        if (event.button === 2) { // Left click for attractor
            orbs.push({
                position: new Vector(mouseX, mouseY),
                radius: ORB_RADIUS,
                type: 'attractor',
                color: 'rgba(0, 100, 255, 0.5)' // Blue with transparency
            });
        } else if (event.button === 0) { // Right click for repulsor
            orbs.push({
                position: new Vector(mouseX, mouseY),
                radius: ORB_RADIUS,
                type: 'repulsor',
                color: 'rgba(255, 0, 0, 0.5)' // Red with transparency
            });
        }
    });

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Initial setup
    initSimulation();

    // Handle window resize to adjust canvas dimensions
    window.addEventListener('resize', () => {
        // The animate function already handles canvas resizing based on CSS
        // No explicit resize call needed here, as it's part of every frame.
    });
});