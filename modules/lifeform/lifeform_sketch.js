/** @format */
const WIDTH = 980;
const HEIGHT = 700;
const BASE_ENERGY = 300; // base energy for a newly created lifeform
const ENERGY_BONUS_PER_GEN = 2; // extra starting energy per generation
const CANNIBAL_GEN_THRESHOLD = 3; // generations allowed to eat weaker lifeforms
const CANNIBAL_GEN_DIFF = 5; // prey must be this many generations older
const BASE_SIZE = 12; // minimum size of a lifeform
const SIZE_GAIN = 10; // size gained when at full energy
const IDLE_DECAY = 0.05; // energy lost even when idle
const SPEED_DECAY_FACTOR = 0.5; // extra energy lost per unit of speed
const MAX_ENERGY = BASE_ENERGY + 2000 * ENERGY_BONUS_PER_GEN; // upper bound for energy
const MAX_DIST = Math.hypot(WIDTH, HEIGHT);
const NUM_LIFEFORMS = 100;
const MUTATION_RATE = 0.3; // mutation rate for offspring brains
const MAX_SPEED = 2.5; // maximum movement speed
const HIDDEN_NODES = 12; // number of neurons in the first hidden layer
// inputs: normalized food vector (dx, dy), current speed, angle difference
// to the closest food, normalized distance, current energy level, generation
// number, and heading orientation (cos(angle), sin(angle))
const NN_INPUTS = 9; // number of inputs for the neural network
let nextAncestorId = 1;
const ancestorGenerations = {};
const ancestorColors = {};
let lifeforms = [];
let foods = [];
let spawnCounter = 0;
let foodSpawnInterval = 60; // spawn food roughly every 60 frames (random)
const FOOD_PER_SPAWN = 3; // number of food items spawned each interval
let speedSlider; // DOM slider to control simulation speed
let simTime = 0; // number of simulation steps elapsed

function startingEnergy(gen) {
	return Math.min(MAX_ENERGY, BASE_ENERGY + ENERGY_BONUS_PER_GEN * (gen - 1));
}

class Lifeform {
	constructor(brain, pos, angle, generation = 1, ancestorId) {
		this.pos = pos ? pos.copy() : createVector(random(WIDTH), random(HEIGHT));
		this.angle = angle !== undefined ? angle : random(TWO_PI);
		this.speed = random(MAX_SPEED);
		this.energy = startingEnergy(generation);
		this.birthEnergy = this.energy;
		const energyRatio = this.energy / BASE_ENERGY;
		this.size = BASE_SIZE + SIZE_GAIN * energyRatio;
		this.generation = generation;
		this.ancestorId = ancestorId !== undefined ? ancestorId : nextAncestorId++;
		if (!ancestorGenerations[this.ancestorId] || ancestorGenerations[this.ancestorId] < this.generation) {
			ancestorGenerations[this.ancestorId] = this.generation;
		}
		if (!ancestorColors[this.ancestorId]) {
			ancestorColors[this.ancestorId] = color(random(60, 255), random(60, 255), random(60, 255));
		}
		this.baseColor = 'black';
		this.col = this.baseColor;
		this.brain = brain ? brain.copy() : new NeuralNetwork(NN_INPUTS, HIDDEN_NODES, 2);
		this.feature = brain ? brain.feature() : [0, 0, 0, 0, 0, 0, 0, 0];
		console.log('this.feature  ->', this.feature);
	}

	findClosestFoodVector() {
		if (foods.length === 0) return { dx: 0, dy: 0, distSq: 0 };
		let dx = foods[0].pos.x - this.pos.x;
		let dy = foods[0].pos.y - this.pos.y;
		let distSq = dx * dx + dy * dy;
		for (let i = 1, n = foods.length; i < n; i++) {
			const fx = foods[i].pos.x - this.pos.x;
			const fy = foods[i].pos.y - this.pos.y;
			const dSq = fx * fx + fy * fy;
			if (dSq < distSq) {
				distSq = dSq;
				dx = fx;
				dy = fy;
			}
		}
		return { dx, dy, distSq };
	}

	update() {
		const { dx, dy, distSq } = this.findClosestFoodVector();
		const dist = Math.sqrt(distSq);
		const dxNorm = dx / WIDTH;
		const dyNorm = dy / HEIGHT;
		const distNorm = dist / MAX_DIST;
		let angleDiff = Math.atan2(dy, dx) - this.angle;
		while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
		while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
		const speedNorm = this.speed / MAX_SPEED;
		const energyNorm = this.energy / MAX_ENERGY;
		const generationNorm = this.generation / 20;
		const inputs = [dxNorm, dyNorm, speedNorm, angleDiff / PI, distNorm, energyNorm, generationNorm, Math.cos(this.angle), Math.sin(this.angle)];
		const [oTurn, oAccel] = this.brain.predict(inputs);
		const turn = map(oTurn, -1, 1, -0.3, 0.3);
		const accel = map(oAccel, -1, 1, -0.05, 0.05);
		this.angle += turn;
		this.speed = constrain(this.speed + accel, 0, MAX_SPEED);
		const vel = p5.Vector.fromAngle(this.angle).mult(this.speed);
		this.pos.add(vel);
		// Wrap around edges so lifeforms do not get stuck
		if (this.pos.x < 0) this.pos.x = WIDTH;
		if (this.pos.x > WIDTH) this.pos.x = 0;
		if (this.pos.y < 0) this.pos.y = HEIGHT;
		if (this.pos.y > HEIGHT) this.pos.y = 0;
		this.energy -= IDLE_DECAY + this.speed * SPEED_DECAY_FACTOR;
		const sizeRatio = this.energy / this.birthEnergy;
		this.size = BASE_SIZE + SIZE_GAIN * sizeRatio;
	}

	show() {
		push();
		translate(this.pos.x, this.pos.y);
		rotate(this.angle + HALF_PI);
		//Creation of the lifeform. This is where we should draw the creature
		const creatureSize = this.size; // overall height in px
		const halfSize = this.size * 0.5;
		// top-left corner relative to (0,0):
		const xOff = -halfSize;
		const yOff = -halfSize;
		drawCreatureP5(this.feature, xOff, yOff, creatureSize);
		//
		pop();
		// display generation number above the lifeform
		push();
		fill(this.baseColor);
		noStroke();
		textAlign(CENTER, CENTER);
		textSize(7);

		// draw a red heart, then the energy number
		fill(255, 0, 0); // make the heart red
		text('♥ ' + int(this.energy), this.pos.x, this.pos.y - this.size - 10);
		textSize(6);
		// reset fill before drawing the generation text
		fill('black');
		text('Gen ' + this.generation, this.pos.x, this.pos.y - this.size);

		pop();
	}

	eat(food) {
		const dx = this.pos.x - food.pos.x;
		const dy = this.pos.y - food.pos.y;
		const radius = (this.size + food.size) / 2;
		if (dx * dx + dy * dy < radius * radius) {
			this.energy = startingEnergy(this.generation);
			const r = min(red(this.baseColor) + 60, 255);
			const g = min(green(this.baseColor) + 60, 255);
			const b = min(blue(this.baseColor) + 60, 255);
			this.col = color(r, g, b);
			if (this.energy > startingEnergy(this.generation) / 2) {
				const childBrain = this.brain.copy();
				childBrain.mutate(MUTATION_RATE);
				const child = new Lifeform(childBrain, this.pos, this.angle, this.generation + 1, this.ancestorId);
				lifeforms.push(child);
			}
			return true;
		}
		return false;
	}

	cannibalize(other) {
		if (this.generation - other.generation >= CANNIBAL_GEN_DIFF && this.energy > 2 * other.energy) {
			const dx = this.pos.x - other.pos.x;
			const dy = this.pos.y - other.pos.y;
			const radius = (this.size + other.size) / 2;
			if (dx * dx + dy * dy < radius * radius) {
				this.energy = Math.min(startingEnergy(this.generation) * 1.5, this.energy + startingEnergy(this.generation) * 0.5);
				if (this.energy > startingEnergy(this.generation) / 2) {
					const childBrain = this.brain.copy();
					childBrain.mutate(MUTATION_RATE);
					lifeforms.push(new Lifeform(childBrain, this.pos, this.angle, this.generation + 1, this.ancestorId));
				}
				other.dispose();
				return true;
			}
		}
		return false;
	}

	isDead() {
		return this.energy <= 0;
	}

	dispose() {
		this.brain.dispose();
	}
}

class Food {
	constructor() {
		this.pos = createVector(random(width), random(height));
		this.size = 10; // 10×10 pixels total
	}

	show() {
		// A 10×10 “pixel pizza” drawn as a circle with crust, cheese, and pepperoni.
		//
		// For each pixel (x=0..9, y=0..9):
		//   • Compute its distance from center (4.5, 4.5).
		//   • If dist > 4.5  → no fill (off‐pizza).
		//   • Else if dist > 3.5 → crust (light brown).
		//   • Else:
		//       – cheese (yellow)
		//       – plus a few red “pepperoni” spots at fixed positions inside the circle.
		//
		// Center of the 10×10 grid is at (4.5, 4.5). Each “pixel” is 1×1 p5‐pixel.

		const crustColor = color('#d2a679'); // light brown
		const cheeseColor = color('#f4e04d'); // golden cheese
		const pepperoniColor = color('#c0392b'); // red

		// Pre‐defined pepperoni “dots” inside the 10×10 circle
		// These are (x,y) coordinates (0–9) where we’ll draw pepperoni if inside the cheese zone.
		const pepperoniSpots = [
			[4, 3],
			[6, 5],
			[3, 6],
			[5, 4],
			[7, 7],
		];

		// A quick lookup set for pepperoni positions
		const pepperoniSet = new Set(pepperoniSpots.map(([px, py]) => `${px},${py}`));

		push();
		noStroke();
		// Translate so that the 10×10 block’s top-left is at (this.pos.x - 5, this.pos.y - 5)
		translate(this.pos.x - this.size / 2, this.pos.y - this.size / 2);

		for (let y = 0; y < 10; y++) {
			for (let x = 0; x < 10; x++) {
				// Compute distance from the center of the 10×10 block (4.5, 4.5)
				const dx = x - 4.5;
				const dy = y - 4.5;
				const dist = sqrt(dx * dx + dy * dy);

				if (dist > 4.5) {
					// Outside the circular pizza—skip drawing
					continue;
				} else if (dist > 3.5) {
					// Crust ring
					fill(crustColor);
				} else {
					// Inside cheese area
					// Check if this (x,y) is one of our pepperoni spots
					if (pepperoniSet.has(`${x},${y}`)) {
						fill(pepperoniColor);
					} else {
						fill(cheeseColor);
					}
				}
				// Draw a 1×1 rectangle at (x,y)
				rect(x, y, 1, 1);
			}
		}

		pop();
	}
}

function setup() {
	const canv = createCanvas(WIDTH, HEIGHT);
	canv.parent('lifeform-sketch');
	speedSlider = document.getElementById('speed-slider');
	for (let i = 0; i < NUM_LIFEFORMS; i++) {
		lifeforms.push(new Lifeform());
	}
}

function simulationStep() {
	spawnCounter++;
	simTime++;
	if (spawnCounter >= foodSpawnInterval) {
		const amount = Math.floor(random(1, FOOD_PER_SPAWN * 2 + 1));
		for (let f = 0; f < amount; f++) {
			foods.push(new Food());
		}
		spawnCounter = 0;
		foodSpawnInterval = int(random(40, 80));
	}

	for (let i = foods.length - 1; i >= 0; i--) {
		const food = foods[i];
		let eaten = false;
		for (let j = lifeforms.length - 1; j >= 0; j--) {
			if (lifeforms[j].eat(food)) {
				eaten = true;
				break;
			}
		}
		if (eaten) {
			foods[i] = foods[foods.length - 1];
			foods.pop();
		}
	}

	for (let j = lifeforms.length - 1; j >= 0; j--) {
		const lf = lifeforms[j];
		lf.update();
		for (let k = lifeforms.length - 1; k >= 0; k--) {
			if (j !== k && lf.cannibalize(lifeforms[k])) {
				lifeforms[k] = lifeforms[lifeforms.length - 1];
				lifeforms.pop();
				if (k < j) j--;
			}
		}
		if (lf.isDead()) {
			lf.dispose();
			lifeforms[j] = lifeforms[lifeforms.length - 1];
			lifeforms.pop();
		}
	}
}

function renderSimulation() {
	background(240);
	for (let i = foods.length - 1; i >= 0; i--) {
		foods[i].show();
	}
	for (const lf of lifeforms) {
		lf.show();
	}

	const stats = {};
	for (const lf of lifeforms) {
		if (!stats[lf.ancestorId]) {
			stats[lf.ancestorId] = { count: 0 };
		}
		stats[lf.ancestorId].count++;
	}

	fill(25);
	noStroke();
	textAlign(LEFT, TOP);
	textSize(14);
	let y = 10;
	// Display elapsed time in the top-right corner
	textAlign(RIGHT, TOP);
	text(simTime.toLocaleString() + ' 🕒', WIDTH - 10, y);
	y += 20;
	text(lifeforms.length + '🪼', WIDTH - 10, y);
	textAlign(LEFT, TOP);

	// Draw portrait of the highest generation lifeform
	if (lifeforms.length > 0) {
		let best = lifeforms[0];
		for (const lf of lifeforms) {
			if (lf.generation > best.generation) {
				best = lf;
			}
		}

		const previewSize = 60; // height and width of the portrait
		push();
		translate(20, y + previewSize / 2);
		drawCreatureP5(best.feature, 0, -previewSize / 2, previewSize);
		pop();
		y += previewSize + 5;
		textSize(10);
		text('Generation: ' + best.generation, 15, y);
		text('DNA0: ' + best.feature[0].toFixed(5), 15, y + 15);
		text('DNA1: ' + best.feature[1].toFixed(5), 15, y + 30);
		text('DNA2: ' + best.feature[2].toFixed(5), 15, y + 45);
		text('DNA3: ' + best.feature[3].toFixed(5), 15, y + 60);
		text('DNA4: ' + best.feature[4].toFixed(5), 15, y + 75);
		text('DNA5: ' + best.feature[5].toFixed(5), 15, y + 90);
		text('DNA6: ' + best.feature[6].toFixed(5), 15, y + 105);
		text('DNA7: ' + best.feature[7].toFixed(5), 15, y + 120);
	}

	if (lifeforms.length === 0) {
		noLoop();
		fill(255);
		textAlign(CENTER, CENTER);
		textSize(32);
		text('All lifeforms have died!', WIDTH / 2, HEIGHT / 2);
	}
}

function draw() {
	const steps = speedSlider ? int(speedSlider.value) : 1;
	for (let s = 0; s < steps; s++) {
		simulationStep();
		if (lifeforms.length === 0) break;
	}
	renderSimulation();
}
