import SimplexNoise from "./noise.js";
import { alea } from "./random.js";
import { structures } from './struct.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const CHUNK_SIZE = 16;
const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;

const MIN_HILL = -32;
const MAX_HILL = 32;
const HILL_HEIGHT = 3;
const HILL_OFFSET = 17.5;
const MIN_CAVE = -128;
const MAX_CAVE = 100;
const BIOME_CUTOFF = 0.55;

const DECODER = new TextDecoder("utf-8");
const ENCODER = new TextEncoder("utf-8");
const prefix = `${process.cwd()}/db/world/`;

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


function isNumeric(n) {
    return !isNaN(parseInt(n)) && isFinite(n);
}


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

let boundModulo = (a, b) => {
    let result = Math.round(a % b);
    if (result < 0) result += b;
    if (result >= b) result -= b;
    return result;
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

    async pingChunk(pos, doGravity, doStructures) {
        if ( (+Date.now()) - this.timer < 1000 / 5) {

            doGravity = false;
        } else { 
            this.timer = (+Date.now())
        }
        let chunk = await this.loadChunk(pos);
        
        let save = false;

        if (!doGravity && !doStructures) return chunk;
        chunk.forEach(async (block, i) => {
            let lpos = [
                i % CHUNK_SIZE + pos[0] * CHUNK_SIZE,
                Math.floor(i / CHUNK_SIZE) + pos[1] * CHUNK_SIZE
            ];

            if (block == 9 && doStructures) {
                let structData = structures[0];
                let base = structData.base;

                structData.struct.forEach((row, y) => {
                    row.forEach((block, x) => {
                        chunk = this.chunkPosGlobal([lpos[0] + base[0] + x, lpos[1] + base[1] + y], block)
                        save = true;
                    })
                })


            } else if (block == 6 && doGravity) {
                let x2 = lpos[0];
                let y2 = lpos[1];
                let belowBlock = await this.chunkPosGlobal([x2, y2 + 1]);
                if (belowBlock != 0) return;

                this.gravityQueue.push([x2, y2]);
            }
        })

        if (doGravity) {
           this.gravityQueue.forEach(([x2, y2]) => {
                chunk = this.chunkPosGlobal([x2, y2], 0);
                chunk = this.chunkPosGlobal([x2, y2 + 1], 6);
                save = true;
            })
            this.gravityQueue = [];
        }

        if (save) this.saveChunk(pos);

        return chunk;
    }

    async loadChunk(pos, cast) {
        let [x, y] = pos;

        let coords = `${x}t${y}.bin`;

        try {
            let data = this.save[coords];
                        
            if (!data) {
                let data2 = await readFile(`${prefix}/${this.id}/terrain/${coords}`, 'utf8');

                let data3 = ENCODER.encode(data2);

                data = this.save[coords] = new Uint16Array(data3.buffer);

            }

            await writeFile(`${prefix}/${this.id}/terrain/${coords}`, data, 'utf8');

            if (!cast) {
                return data;
            } else {
                let data4 = new Uint8Array(data.buffer);
                let data5 = DECODER.decode(data4);

                return data5;
            }

        } catch (err) {
            let chunkData = this.initChunk([x, y]);

            let chunk = new Uint8Array(chunkData.buffer);
            let data = DECODER.decode(chunk);

            await writeFile(`${prefix}/${this.id}/terrain/${coords}`, data, 'utf8');
            if (!cast) {
                return chunkData;
            } else {
                return data;
            }
        }
    }

    async saveChunk(pos) {
        let utfData = new Uint8Array((await this.loadChunk(pos, false)).buffer);

        this.socket.emit('update', { x: pos[0], y: pos[1] })

        if (utfData.length != 512 || !isNumeric(pos[0]) || !isNumeric(pos[1])) {
            return 'What are you doing?';
        }
        try {
            await writeFile(`${prefix}/${this.id}/terrain/${coords}`, utfData, 'utf8');
            return 'success';
        } catch (err) {
            return 'you broke something';
        }
    }

    async chunkPosGlobal(pos, data, triggerLoad) {
        let chunkPos = [
            Math.floor(pos[0] / CHUNK_SIZE),
            Math.floor(pos[1] / CHUNK_SIZE)
        ];

        let xMod = boundModulo(pos[0], CHUNK_SIZE);
        let yMod = boundModulo(pos[1], CHUNK_SIZE);

        let chunk = await this.loadChunk(chunkPos, false)

        if (triggerLoad) {
            this.saveChunk(chunkPos);
        }

        if (data || data === 0) {
            chunk[xMod + yMod * CHUNK_SIZE] = data;
            return;
        }

        return chunk[xMod + yMod * CHUNK_SIZE];
    }

    constructor(seedI = 0, idI = 0, socketI) {
        this.seed = seedI;
        this.id = idI;
        this.socket = socketI;

        this.noise = [];
        this.gravityQueue = [];
        this.timer = (+Date.now());

        this.save = {};

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