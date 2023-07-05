import SimplexNoise from "./noise.js";

const MAX_SEED = 0xFFFF;
const MIN_HILL = -32;
const MAX_HILL = 32;
const HILL_HEIGHT = 3;
const HILL_OFFSET = 17.5;
const MIN_CAVE = -128;
const MAX_CAVE = 100;

const NOISE_DEPTH = [
    // hills
    [50, 300],
    [100, 1000],
    [200, 1000],
    // caves
    [25, 25],
    [40, 40],
    [70, 70]
];

let masks = [0];

let sigmoid = (z) => {
    return 1 / (1 + Math.exp(-z));
}

let genMask = (type, replace) => {
    let maskLength = masks.length;

    masks.forEach((mask,i) => {
        if (replace.indexOf(mask) != -1) {
            masks[maskLength+i] = type;
        } else {
            masks[maskLength+i] = mask;
        }
    })
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

let generateTerrain = (x, y) => {
    noise.forEach((e, i) => {
        noiseVal[i] = ((e.noise2D(x / NOISE_DEPTH[i][0], y / NOISE_DEPTH[i][1]) + 1) / 2);
    })

    let dirtMask = true;
    let stoneMask = false;
    let grassMask = false;

    let hillNoise = hills(noiseVal[0], y) * 0.5 + hills(noiseVal[1], y) * 0.6 + hills(noiseVal[2], y) * 0.4;
    let hillFactor = (hills(noiseVal[0], y) - MAX_HILL + HILL_OFFSET) * HILL_HEIGHT;
    hillNoise += Math.min(hillFactor, 0);

    let caveNoise = (caves(noiseVal[3], y) * caves(noiseVal[4], y / 2) * caves(noiseVal[5], y / 3)) ** (1.5);

    dirtMask = dirtMask && !(y < hillNoise);
    dirtMask = dirtMask && !(caveNoise < 0.1);

    stoneMask = stoneMask || (caveNoise < 0.2);
    stoneMask = stoneMask || !(y < hillNoise + (40 * hillFactor /  HILL_HEIGHT / (MAX_HILL - HILL_OFFSET)) + 2);

    grassMask = grassMask || !(y > hillNoise + 1);

    return masks[compileMasks(grassMask,stoneMask,dirtMask)];
}

let seed = Math.floor(Math.random() * MAX_SEED);
let noise = [];
let noiseVal = new Array(NOISE_DEPTH.length);

for (let i = 0; i < NOISE_DEPTH.length; i++) {
    noise[i] = new SimplexNoise(seed * NOISE_DEPTH.length + i);
}

genMask(2,[0]);
genMask(3,[2]);
genMask(4,[2]);

export {
    generateTerrain
};