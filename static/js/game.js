import { constructUpdates } from './render.js';
import { generateTerrain } from './terrain.js';

const CHUNK_SIZE = 16;
const RENDER_DIAMETER = 5; // This must be an odd number.
const MAX_SAVE = 1000; // TODO: Save chunk data to server

const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;
const RENDER_RADIUS = (RENDER_DIAMETER - 1) / 2;
const RENDER_AREA = RENDER_DIAMETER * RENDER_DIAMETER;

let save = {};
let pos = [0,0];
let chunks = [];
let keys = [];

let loadChunk = (pos) => {
    let index = `${pos[0]},${pos[1]}`;

    let chunk = save[index];
    if (chunk) return chunk;

    chunk = save[index] = new Uint16Array(CHUNK_AREA);

    for (let i = 0; i < CHUNK_AREA; i++) {
        let lpos = [
            i % CHUNK_SIZE + pos[0] * CHUNK_SIZE,
            Math.floor(i / CHUNK_SIZE) + pos[1] * CHUNK_SIZE
        ];
        
        chunk[i] = generateTerrain(lpos[0],lpos[1]);
    }

    return chunk;
}

let tick = () => {
    pos[0] -= ((keys['a'] ? 0.5 : 0) - (keys['d'] ? 0.5 : 0));
    pos[1] -= ((keys['w'] ? 0.5 : 0) - (keys['s'] ? 0.5 : 0));

    document.querySelector('#text').textContent = `x = ${pos[0]}\ny = ${pos[1]}`

    for (let i = 0; i < RENDER_AREA; i++) {
        let chunkPos = [
            (i % RENDER_DIAMETER) - RENDER_RADIUS + Math.floor(pos[0] / CHUNK_SIZE),
            Math.floor(i / RENDER_DIAMETER) - RENDER_RADIUS + Math.floor(pos[1] / CHUNK_SIZE)
        ];
        chunks[i] = {
            pos: chunkPos,
            chunk: loadChunk(chunkPos)
        };
    }
    return {
        chunks,
        pos,
        CHUNK_SIZE
    };
}


let down = (e) => {
    keys[e.key.toLowerCase()] = true;
};

let up = (e) => {
    keys[e.key.toLowerCase()] = false;
};

window.addEventListener('keydown',down)
window.addEventListener('keyup',up)

setInterval(constructUpdates(tick),1000/60);