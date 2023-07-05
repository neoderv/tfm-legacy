import { constructUpdates } from './render.js';
import { generateTerrain } from './terrain.js';

const CHUNK_SIZE = 16;
const RENDER_DIAMETER = 5; // This must be an odd number.
const MAX_SAVE = 1000; // TODO: Save chunk data to server

const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;
const RENDER_RADIUS = (RENDER_DIAMETER - 1) / 2;
const RENDER_AREA = RENDER_DIAMETER * RENDER_DIAMETER;

let save = {};
let pos = [0, 20];
let vel = [0, 0];
let chunks = [];
let keys = {};

let chunkPos = (player, pos, chunks) => {
    let a = Math.floor(pos[0] / CHUNK_SIZE) + RENDER_RADIUS - Math.floor(player[0] / CHUNK_SIZE) +
        (Math.floor(pos[1] / CHUNK_SIZE) + RENDER_RADIUS - Math.floor(player[1] / CHUNK_SIZE)) * RENDER_DIAMETER;

    let x = pos[0];
    let y = pos[1];
    if (x < 0) x -= Math.floor(x / CHUNK_SIZE) * CHUNK_SIZE;
    if (y < 0) y -= Math.floor(y / CHUNK_SIZE) * CHUNK_SIZE;
    console.log(x,y)

    let r = Math.round(x % CHUNK_SIZE) + Math.round(y % CHUNK_SIZE) * CHUNK_SIZE

    let dat = chunks[a].chunk[r];

    if (!dat) return 0;

    return dat;
}

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

        chunk[i] = generateTerrain(lpos[0], lpos[1]);
    }

    return chunk;
}

// TODO: fix collision
let tick = () => {
    vel[0] /= 1.09;
    vel[1] /= 1.02;

    vel[0] -= ((keys['a'] ? 0.05 : 0) - (keys['d'] ? 0.05 : 0));
    vel[1] += 0.02;

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

    let left = Math.floor(pos[0] + -0.1);
    let right = Math.floor(pos[0] + 1.1);

    let left2 = Math.floor(pos[0] + 0);
    let right2 = Math.floor(pos[0] + 1);

    let bottom2 = Math.floor(pos[1] + 1.1);
    let top = Math.floor(pos[1] + 0.1);
    let top2 = Math.floor(pos[1] - 0.9);

    let ground = ((chunkPos(pos, [left2, bottom2], chunks) != 0 ||
        chunkPos(pos, [right2, bottom2], chunks) != 0));    

    if (ground && vel[1] <= 0) {
        pos[1] = Math.floor(pos[1]);
    }

    if (ground) {
        vel[1] = Math.min(vel[1], 0);
    }

    if (chunkPos(pos, [left2, top2], chunks) != 0 ||
        chunkPos(pos, [right2, top2], chunks) != 0) {
        vel[1] = Math.max(vel[1], 0);
        pos[1] = Math.ceil(pos[1]);
    }

    if (keys[' '] && ground)
        vel[1] = -0.5;

    if ((chunkPos(pos, [right + vel[0], top], chunks) != 0) ||
        (chunkPos(pos, [right + vel[0], top2], chunks) != 0)) {
        pos[0] = Math.round(pos[0]);
    }

    if ((chunkPos(pos, [right + vel[0], top], chunks) != 0 && vel[0] > 0) ||
        (chunkPos(pos, [left + vel[0], top], chunks) != 0 && vel[0] < 0) ||
        (chunkPos(pos, [right + vel[0], top2], chunks) != 0 && vel[0] > 0) ||
        (chunkPos(pos, [left + vel[0], top2], chunks) != 0 && vel[0] < 0)) {
        vel[0] = 0;
    }

    pos[0] += vel[0];
    pos[1] += vel[1];

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

window.addEventListener('keydown', down)
window.addEventListener('keyup', up)

setInterval(constructUpdates(tick), 1000 / 60);