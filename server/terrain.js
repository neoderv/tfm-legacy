import SimplexNoise from "./noise.js";
import { alea } from "./random.js";

const CHUNK_SIZE = 16;
const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;

const MIN_HILL = -32;
const MAX_HILL = 32;
const HILL_HEIGHT = 3;
const HILL_OFFSET = 17.5;
const MIN_CAVE = -128;
const MAX_CAVE = 100;
const BIOME_CUTOFF = 0.55;

const NOISE_DEPTH = [
    // hills
    [50, 300],
    [100, 1000],
    [200, 1000],
    // caves
    [25, 25],
    [40, 40],
    [70, 70],
    // temperature
    [500, 300],
    [1000, 1000],
    [2000, 1000]
];

let masks = [0];

let sigmoid = (z) => {
    return 1 / (1 + Math.exp(-z));
}

let genMask = (masks, type, replace) => {
    let maskLength = masks.length;

    masks.forEach((mask, i) => {
        if (replace.indexOf(mask) != -1) {
            masks[maskLength + i] = type;
        } else {
            masks[maskLength + i] = mask;
        }
    })

    return masks;
}

let compileMasks = (...masks) => {
    let num = 0;
    for (let i = 0; i < masks.length; i++) {
        num = num * 2 + masks[i];
    }
    return num;
}

let hills = (val, y) => {
    return sigmoid(Math.sqrt(val) * 2) * (MAX_HILL - MIN_HILL) + MIN_HILL;
}

let caves = (val, y) => {
    val = val ** 0.5;
    let threshold = (y - MIN_CAVE) / (MAX_CAVE - MIN_CAVE);
    threshold = Math.max(threshold, 0);
    threshold = Math.min(threshold, 1);
    return 1.0 - ((1.0 - val) * threshold);
}

class Terrain {
    // TODO: biome datatypes, cleanup
    generateTerrain(x, y) {
        let noiseVal = [];
        this.noise.forEach((e, i) => {
            noiseVal[i] = ((e.noise2D(x / NOISE_DEPTH[i][0], y / NOISE_DEPTH[i][1]) + 1) / 2);
        })

        let dirtMask = true;
        let stoneMask = false;
        let grassMask = false;
        let sandMask = false;
        let snowMask = false;

        let hillNoise = hills(noiseVal[0], y) * 0.5 + hills(noiseVal[1], y) * 0.6 + hills(noiseVal[2], y) * 0.4;
        let hillFactor = (hills(noiseVal[0], y) - MAX_HILL + HILL_OFFSET) * HILL_HEIGHT;
        hillNoise += Math.min(hillFactor, 0);

        let caveNoise = (caves(noiseVal[3], y) * caves(noiseVal[4], y / 2) * caves(noiseVal[5], y / 3)) ** (1.5);

        let tempFactor = noiseVal[6] * 0.3 + noiseVal[7] * 0.3 + noiseVal[8] * 0.4;
        let tempType = (tempFactor > BIOME_CUTOFF) - (tempFactor < (1.0 - BIOME_CUTOFF))

        dirtMask = dirtMask && !(y < hillNoise);
        dirtMask = dirtMask && !(caveNoise < 0.1);

        stoneMask = stoneMask || (caveNoise < 0.2);
        stoneMask = stoneMask || !(y < hillNoise + (40 * hillFactor / HILL_HEIGHT / (MAX_HILL - HILL_OFFSET)) + 2);

        grassMask = grassMask || !(y > hillNoise + 1);

        sandMask = (tempType == 1);
        snowMask = (tempType == -1);

        return {
            block: masks[compileMasks(snowMask, sandMask, grassMask, stoneMask, dirtMask)],
            valid: (y == Math.floor(hillNoise)) && !sandMask
        };
    }

    initChunk(pos) {
        let seedGenA = alea(this.seed);
        let seedGenB = alea(seedGenA() + pos[0]);
        let seedGenC = alea(seedGenB() + pos[1]);

        let chunk = new Uint16Array(CHUNK_AREA);

        for (let i = 0; i < CHUNK_AREA; i++) {
            let lpos = [
                i % CHUNK_SIZE + pos[0] * CHUNK_SIZE,
                Math.floor(i / CHUNK_SIZE) + pos[1] * CHUNK_SIZE
            ];

            let dat = this.generateTerrain(lpos[0], lpos[1]);

            chunk[i] = dat.block;

            if (dat.valid) {
                let rand = seedGenC();

                if (rand < 0.98) continue;
                chunk[i] = 9;
            }
        }

        return chunk;
    }

    constructor(seedI = 0) {
        this.seed = seedI;

        this.noise = [];

        for (let i = 0; i < NOISE_DEPTH.length; i++) {
            this.noise[i] = new SimplexNoise(this.seed * NOISE_DEPTH.length + i);
        }
    }

}

masks = genMask(masks, 2, [0]);
masks = genMask(masks, 3, [2]);
masks = genMask(masks, 4, [2]);
masks = genMask(masks, 6, [4]);

masks = masks.map((i, j) => (i == 2 && j > masks.length / 2) ? 7 : i);

masks = genMask(masks, 8, [4]);

export {
    Terrain,
    CHUNK_SIZE,
    CHUNK_AREA
};