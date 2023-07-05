import SimplexNoise from "./noise.js";

const MIN_HILL = -32;
const MAX_HILL = 32;

const MIN_CAVE = -100;
const MAX_CAVE = 64; 
const NOISE_COUNT = 6;
const NOISE_DEPTH = [
    [25,1000],
    [50,1000],
    [75,1000],
    [25,50],
    [30,60], 
    [35,70]
];

let seed = Math.floor(Math.random() * 0xFFFF);
let noise = [];
let noiseVal = new Array(NOISE_COUNT);

for (let i = 0; i < NOISE_COUNT; i++) {
    noise[i] = new SimplexNoise(seed * NOISE_COUNT + i);
}

let hills = (val, y) => {
    let threshold = (y - MIN_HILL) / (MAX_HILL - MIN_HILL);
    threshold = Math.max(threshold,0);
    threshold = Math.min(threshold,1);
    return (threshold ** (val * 5 + 1)) ** 0.5;
}

let caves = (val, y) => {
    val = val ** 0.5;
    let threshold = (y - MIN_CAVE) / (MAX_CAVE - MIN_CAVE);
    threshold = Math.max(threshold,0);
    threshold = Math.min(threshold,1);
    return 1.0 - ((1.0 - val) * threshold);
}

let generateTerrain = (x,y) => {
    noise.forEach((e,i) => {
        noiseVal[i] = ((e.noise2D(x/NOISE_DEPTH[i][0],y/NOISE_DEPTH[i][1]) + 1) / 2);
    })

    let hillNoise = hills(noiseVal[0] / 3 + noiseVal[1] / 3 + noiseVal[2] / 3,y);
    let caveNoise = (caves(noiseVal[3],y) * caves(noiseVal[4],y/2) * caves(noiseVal[5],y/3)) ** (1/2);
    let layerA = (hillNoise * caveNoise > 0.5);

    return hillNoise * caveNoise > 0.5;
}

export {
    generateTerrain
};