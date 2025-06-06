/** @format */

// ──────────────────────────────────────────────────────────────────────
// === drawCreatureP5.js ===
// (You can paste this directly into your main p5 sketch file, above `class Lifeform`)
// ──────────────────────────────────────────────────────────────────────

// 1) CONSTANTS & BASE PATTERN
const BLOCK_SIZE_DEFAULT = 16; // default block‐size; we’ll override at draw time if needed

const BASE_PATTERN_9x9 = [
	[0, 0, 0, 1, 1, 1, 0, 0, 0], // row0
	[0, 0, 1, 1, 1, 1, 1, 0, 0], // row1
	[0, 1, 1, 1, 1, 1, 1, 1, 0], // row2
	[1, 1, 1, 1, 1, 1, 1, 1, 1], // row3
	[1, 1, 1, 1, 1, 1, 1, 1, 1], // row4
	[0, 1, 1, 1, 1, 1, 1, 1, 0], // row5
	[0, 0, 1, 0, 1, 0, 1, 0, 0], // row6 (tentacle hints)
	[0, 1, 0, 0, 0, 0, 0, 1, 0], // row7 (tentacles)
	[1, 0, 1, 0, 1, 0, 1, 0, 1], // row8 (tentacle ends)
];
const PATTERN_W = BASE_PATTERN_9x9[0].length; // 9
const PATTERN_H = BASE_PATTERN_9x9.length; // 9

// A fixed 16‐color pool—we do NOT shuffle this in p5. We will pick three indices from it deterministically.
const GLOBAL_COLOR_POOL = [
	'#556B2F', // DarkOliveGreen (deep forest moss)
	'#8F9779', // Sage (soft leaf green)
	'#6B8E23', // OliveDrab (wild fern green)
	'#2E8B57', // SeaGreen (kelp and aquatic plants)
	'#4682B4', // SteelBlue (shallow stream water)
	'#87CEEB', // SkyBlue (daylight sky)
	'#708090', // SlateGrey (river stone)
	'#A0522D', // Sienna (rich bark brown)
	'#8B4513', // SaddleBrown (forest floor soil)
	'#DEB887', // BurlyWood (dry sand/earth)
	'#D2B48C', // Tan (leaf litter)
	'#F4A460', // SandyBrown (dry grass)
	'#FFFFE0', // LightYellow (pale pollen)
	'#FFB6C1', // LightPink (blossom petals)
	'#DDA0DD', // Plum (flower blossom)
	'#9932CC', // DarkOrchid (wildflower purple)
];

// ──────────────────────────────────────────────────────────────────────
// 2) DETERMINISTIC PRNG + HASH
// ──────────────────────────────────────────────────────────────────────

function hashFeatureArray(feat) {
	// Simple 32‐bit hash from JSON string
	const str = JSON.stringify(feat);
	let h = 0;
	for (let i = 0; i < str.length; i++) {
		h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
	}
	return h >>> 0;
}

function createLCGRandom(seed) {
	let state = seed >>> 0;
	return {
		next: function () {
			// Numerical Recipes LCG params:
			state = ((1664525 * state + 1013904223) & 0xffffffff) >>> 0;
			return state / 4294967296; // in [0,1)
		},
	};
}

// ──────────────────────────────────────────────────────────────────────
// 3) LINEAR REMAP UTILITY
// ──────────────────────────────────────────────────────────────────────

function remap(val, a, b, c, d) {
	if (val < a) val = a;
	if (val > b) val = b;
	return c + ((val - a) * (d - c)) / (b - a);
}

// ──────────────────────────────────────────────────────────────────────
// 4) CHOOSE 3 COLORS DETERMINISTICALLY FROM feat[0..2]
// ──────────────────────────────────────────────────────────────────────

function featureToMiniPalette(feat) {
	const poolLen = GLOBAL_COLOR_POOL.length;
	const idx0 = Math.floor(remap(feat[0], -1.2, 2.2, 0, poolLen - 1));
	const offset1 = Math.floor(remap(feat[1], -1.2, 2.2, 1, 5));
	const idx1 = (idx0 + offset1) % poolLen;
	const offset2 = Math.floor(remap(feat[2], -1.2, 2.2, 1, 4));
	const idx2 = (idx1 + offset2) % poolLen;
	return [GLOBAL_COLOR_POOL[idx0], GLOBAL_COLOR_POOL[idx1], GLOBAL_COLOR_POOL[idx2]];
}

// ──────────────────────────────────────────────────────────────────────
// 5) feat[3] → FLIP OR NOT
// ──────────────────────────────────────────────────────────────────────

function featureToFlip(feat) {
	return feat[3] > 0.5;
}

// ──────────────────────────────────────────────────────────────────────
// 6) MUTATE 9×9 PATTERN USING feat[4..6] (DETERMINISTICLY VIA rng)
// ──────────────────────────────────────────────────────────────────────

function randomizePatternWithFeatures(basePattern, feat, rng) {
	// Copy it
	const newPat = basePattern.map((row) => row.slice());

	// Map feat[4] → removeProb ∈ [0.10..0.50]
	const removeProb = remap(feat[4], -1.0, 2.0, 0.1, 0.5);
	// Map feat[5] → addProb ∈ [0.05..0.35]
	const addProb = remap(feat[5], -1.0, 2.0, 0.05, 0.35);
	// Map feat[6] → biasRow7 ∈ [0.3..0.7]
	const biasRow7 = remap(feat[6], -1.0, 2.0, 0.3, 0.7);

	for (let r = 6; r < PATTERN_H; r++) {
		for (let c = 0; c < PATTERN_W; c++) {
			if (newPat[r][c] === 1) {
				// Possibly remove an existing tentacle
				if (rng.next() < removeProb) {
					newPat[r][c] = 0;
				}
			} else {
				// Possibly add a new tentacle pixel
				const rowBias = r === 7 ? biasRow7 : 1.0 - biasRow7;
				if (rng.next() < addProb * rowBias) {
					newPat[r][c] = 1;
				}
			}
		}
	}
	return newPat;
}

// ──────────────────────────────────────────────────────────────────────
// 7) OPTIONAL HORIZONTAL FLIP
// ──────────────────────────────────────────────────────────────────────

function maybeFlip(pattern2D, shouldFlip) {
	if (!shouldFlip) return pattern2D;
	return pattern2D.map((row) => row.slice().reverse());
}

// ──────────────────────────────────────────────────────────────────────
// 8) THE MAIN FUNCTION: drawCreatureP5
// ──────────────────────────────────────────────────────────────────────

/**
 * Draw exactly one 9×9 “pixel microorganism” onto p5’s current canvas.
 *
 *   feat: array of 8 floats
 *   xOff: x‐offset (in p5 pixels) of the top-left corner of this creature
 *   yOff: y‐offset (…)
 *   size: desired “height” (in p5 pixels) of the entire creature. We will compute
 *         blockSize = size / PATTERN_H, so the creature fits within [0..size]×[0..size].
 *
 * Steps:
 *   1. Seed an LCG from hashFeatureArray(feat) so that all “random” calls are deterministic.
 *   2. Map feat[0..2] → a deterministic triple of hex‐colors.
 *   3. Mutate the 9×9 base pattern via feat[4..6], using rng.next() for “randomness.”
 *   4. Optionally flip the 9×9 horizontally if feat[3] > 0.5.
 *   5. Map feat[7] → highlightChance ∈ [0.05..0.30].
 *   6. Loop over each of the 9×9 cells: if it’s “1,” choose between primary/secondary/highlight:
 *         • 60% → primary
 *         • 30% → secondary
 *         • 10% → “highlight attempt” → actually highlight with probability highlightChance.
 *   7. Draw a p5 `rect()` at the correct (xOff + c*blockSize, yOff + r*blockSize).
 */
function drawCreatureP5(feat, xOff, yOff, size) {
	// 8.1) Seeded RNG
	const seed = hashFeatureArray(feat);
	const rng = createLCGRandom(seed);

	// 8.2) Mini‐palette from feat[0..2]
	const [primaryColor, secondaryColor, highlightColor] = featureToMiniPalette(feat);

	// 8.3) Mutate the 9×9 base pattern
	let pat = randomizePatternWithFeatures(BASE_PATTERN_9x9, feat, rng);

	// 8.4) Flip horizontally if feat[3] says so
	pat = maybeFlip(pat, featureToFlip(feat));

	// 8.5) Determine highlight density from feat[7]
	const highlightChance = remap(feat[7], -1.0, 2.5, 0.05, 0.3);

	// 8.6) Decide blockSize so that PATTERN_H × blockSize = size
	//      (We assume size is the full height of the 9×9 creature in p5 pixels)
	const blockSize = size / PATTERN_H;

	// 8.7) Draw each “1” in the 9×9 pattern
	for (let r = 0; r < PATTERN_H; r++) {
		for (let c = 0; c < PATTERN_W; c++) {
			if (pat[r][c] === 1) {
				const p = rng.next();
				let fillCol;
				if (p < 0.6) {
					fillCol = primaryColor;
				} else if (p < 0.9) {
					fillCol = secondaryColor;
				} else {
					// Highlight branch
					fillCol = rng.next() < highlightChance ? highlightColor : secondaryColor;
				}
				fill(fillCol);
				noStroke();
				// Note: in p5, rect(x,y,w,h) draws from top-left corner
				rect(xOff + c * blockSize, yOff + r * blockSize, blockSize, blockSize);
			}
		}
	}
}
