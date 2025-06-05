/** @format */

const BASE_ENERGY = 300; // base energy for a newly created lifeform
const ENERGY_BONUS_PER_GEN = 10; // extra starting energy per generation
const CANNIBAL_GEN_THRESHOLD = 30; // generations allowed to eat weaker lifeforms
const MAX_ENERGY = BASE_ENERGY + 10 * ENERGY_BONUS_PER_GEN; // upper bound for energyconst NUM_LIFEFORMS = 50;
const NUM_LIFEFORMS = 40;
const MUTATION_RATE = 0.1; // mutation rate for offspring brains
const MAX_SPEED = 3.5; // maximum movement speed
// inputs: normalized food vector (dx, dy), current speed, angle difference
// to the closest food, normalized distance, current energy level, and
// heading orientation (cos(angle), sin(angle))
const NN_INPUTS = 8; // number of inputs for the neural network
let nextAncestorId = 1;
const ancestorGenerations = {};
const ancestorColors = {};
let lifeforms = [];
let foods = [];
let spawnCounter = 0;
let foodSpawnInterval = 60; // spawn food every 60 frames
const FOOD_PER_SPAWN = 3; // number of food items spawned each interval
const MIN_FOOD_SIZE = 8;
const MAX_FOOD_SIZE = 15;

let speedSlider; // DOM slider to control simulation speed

function startingEnergy(gen) {
	return Math.min(MAX_ENERGY, BASE_ENERGY + ENERGY_BONUS_PER_GEN * (gen - 1));
}

class Lifeform {
	constructor(brain, pos, angle, generation = 1, ancestorId) {
		this.pos = pos ? pos.copy() : createVector(random(width), random(height));
		this.angle = angle !== undefined ? angle : random(TWO_PI);
		this.speed = random(MAX_SPEED);
		this.size = 18;
		this.energy = startingEnergy(generation);
		this.generation = generation;
		this.ancestorId = ancestorId !== undefined ? ancestorId : nextAncestorId++;
		if (!ancestorGenerations[this.ancestorId] || ancestorGenerations[this.ancestorId] < this.generation) {
			ancestorGenerations[this.ancestorId] = this.generation;
		}
		if (!ancestorColors[this.ancestorId]) {
			ancestorColors[this.ancestorId] = color(random(60, 255), random(60, 255), random(60, 255));
		}
		this.baseColor = ancestorColors[this.ancestorId];
		this.col = this.baseColor;
		this.brain = brain ? brain.copy() : new NeuralNetwork(NN_INPUTS, 8, 2);
	}

	findClosestFoodVector() {
		if (foods.length === 0) return createVector(0, 0);
		let closest = foods[0];
		let dMin = p5.Vector.dist(this.pos, closest.pos);
		for (let i = 1; i < foods.length; i++) {
			const d = p5.Vector.dist(this.pos, foods[i].pos);
			if (d < dMin) {
				dMin = d;
				closest = foods[i];
			}
		}
		return p5.Vector.sub(closest.pos, this.pos);
	}

	update() {
		const dir = this.findClosestFoodVector();
		const dxNorm = dir.x / width;
		const dyNorm = dir.y / height;
		const distNorm = dir.mag() / Math.hypot(width, height);
		let angleDiff = dir.heading() - this.angle;
		while (angleDiff > PI) angleDiff -= TWO_PI;
		while (angleDiff < -PI) angleDiff += TWO_PI;
		const speedNorm = this.speed / MAX_SPEED;
		const energyNorm = this.energy / MAX_ENERGY;
		const inputs = [dxNorm, dyNorm, speedNorm, angleDiff / PI, distNorm, energyNorm, Math.cos(this.angle), Math.sin(this.angle)];
		const [oTurn, oAccel] = this.brain.predict(inputs);
		const turn = map(oTurn, -1, 1, -0.3, 0.3);
		const accel = map(oAccel, -1, 1, -0.05, 0.05);
		this.angle += turn;
		this.speed = constrain(this.speed + accel, 0, MAX_SPEED);
		const vel = p5.Vector.fromAngle(this.angle).mult(this.speed);
		this.pos.add(vel);
		// Wrap around edges so lifeforms do not get stuck
		if (this.pos.x < 0) this.pos.x = width;
		if (this.pos.x > width) this.pos.x = 0;
		if (this.pos.y < 0) this.pos.y = height;
		if (this.pos.y > height) this.pos.y = 0;

		const drain = 0.05 + this.speed; // slower drain when stationary, faster when moving
		this.energy -= drain;
		this.energy = max(this.energy, 0);
		this.size = map(this.energy, 0, MAX_ENERGY, 10, 26);
	}

	show() {
		push();
		translate(this.pos.x, this.pos.y);
		rotate(this.angle + HALF_PI);
		fill(this.col);
		noStroke();
		beginShape();
		vertex(-this.size * 0.4, this.size * 0.5);
		vertex(this.size * 0.4, this.size * 0.5);
		vertex(0, -this.size * 0.5);
		endShape(CLOSE);
		pop();
		// display energy and generation above the lifeform
		push();
		fill(this.baseColor);
		noStroke();
		textAlign(CENTER, CENTER);
		textSize(10);
		text(Math.floor(this.energy), this.pos.x, this.pos.y - this.size - 10);
		text('g' + this.generation, this.pos.x, this.pos.y - this.size);
		pop();
	}
	eat(food) {
		const d = dist(this.pos.x, this.pos.y, food.pos.x, food.pos.y);
		if (d < (this.size + food.size) / 2) {
			this.energy = startingEnergy(this.generation);
			const r = min(red(this.baseColor) + 60, 255);
			const g = min(green(this.baseColor) + 60, 255);
			const b = min(blue(this.baseColor) + 60, 255);
			this.col = color(r, g, b);
			const childBrain = this.brain.copy();
			childBrain.mutate(MUTATION_RATE);
			const child = new Lifeform(childBrain, this.pos, this.angle, this.generation + 1, this.ancestorId);
			lifeforms.push(child);
			return true;
		}
		return false;
	}

	cannibalize(other) {
		if (this.generation >= CANNIBAL_GEN_THRESHOLD && (this.generation > other.generation || this.energy > other.energy)) {
			const d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
			if (d < (this.size + other.size) / 2) {
				this.energy = Math.min(startingEnergy(this.generation) * 1.5, this.energy + startingEnergy(this.generation) * 0.5);
				const childBrain = this.brain.copy();
				childBrain.mutate(MUTATION_RATE);
				lifeforms.push(new Lifeform(childBrain, this.pos, this.angle, this.generation + 1, this.ancestorId));
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
		this.size = random(MIN_FOOD_SIZE, MAX_FOOD_SIZE);
		this.energyValue = map(this.size, MIN_FOOD_SIZE, MAX_FOOD_SIZE, MAX_ENERGY * 0.2, MAX_ENERGY);
	}

	show() {
		fill(150, 255, 150);
		noStroke();
		ellipse(this.pos.x, this.pos.y, this.size);
	}
}

function setup() {
	const canv = createCanvas(600, 600);
	canv.parent('lifeform-sketch');
	speedSlider = document.getElementById('speed-slider');
	for (let i = 0; i < NUM_LIFEFORMS; i++) {
		lifeforms.push(new Lifeform());
	}
}

function simulationStep() {
	spawnCounter++;
	if (spawnCounter >= foodSpawnInterval) {
		for (let f = 0; f < FOOD_PER_SPAWN; f++) {
			foods.push(new Food());
		}
		spawnCounter = 0;
	}

	for (let i = foods.length - 1; i >= 0; i--) {
		for (let j = lifeforms.length - 1; j >= 0; j--) {
			if (lifeforms[j].eat(foods[i])) {
				foods.splice(i, 1);
				break;
			}
		}
	}

	for (let j = lifeforms.length - 1; j >= 0; j--) {
		const lf = lifeforms[j];
		lf.update();
		for (let k = lifeforms.length - 1; k >= 0; k--) {
			if (j !== k && lf.cannibalize(lifeforms[k])) {
				lifeforms.splice(k, 1);
				if (k < j) j--;
			}
		}
		if (lf.isDead()) {
			lf.dispose();
			lifeforms.splice(j, 1);
		}
	}
}

function renderSimulation() {
	background(30);
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

	fill(255);
	noStroke();
	textAlign(LEFT, TOP);
	textSize(14);
	let y = 10;
	text('Population: ' + lifeforms.length, 10, y);
	y += 16;
	for (const id in stats) {
		const s = stats[id];
		const gen = ancestorGenerations[id] || 1;
		fill(ancestorColors[id] || 255);
		text('A' + id + ' G' + gen + ' P' + s.count, 10, y);
		y += 14;
	}

	if (lifeforms.length === 0) {
		noLoop();
		fill(255);
		textAlign(CENTER, CENTER);
		textSize(32);
		text('All lifeforms have died!', width / 2, height / 2);
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
