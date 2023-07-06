import { constructUpdates, TILE_SIZE, canvas } from './render.js';
import { initChunk, CHUNK_SIZE, CHUNK_AREA } from './terrain.js';
import { addInventory, selectSlot, setInventory, getInventory } from './inventory.js';
import { structures } from './struct.js';

const RENDER_DIAMETER = 5; // This must be an odd number.
const MAX_SAVE = 1000; // TODO: Save chunk data to server
const MAX_BREAK = 5;

const RENDER_RADIUS = (RENDER_DIAMETER - 1) / 2;
const RENDER_AREA = RENDER_DIAMETER * RENDER_DIAMETER;

const INVENTORY_BINDS = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9'
];

let save = {};
let pos = [0, 20];
let vel = [0, 0];
let chunks = [];
let keys = {};
let selectedIndex = 0;
let isBreaking = false;
let offset = [0, 0];
let breakCounter = 0;
let doGravity = true;
let gravityQueue = [];

let boundModulo = (a, b) => {
    let result = Math.round(a % b);
    if (result < 0) result += b;
    if (result >= b) result -= b;
    return result;
}

let chunkPos = (player, pos, chunks, newData) => {
    let x = pos[0];
    let y = pos[1];

    let xMod = boundModulo(x, CHUNK_SIZE);
    let yMod = boundModulo(y, CHUNK_SIZE);

    let a = Math.round((pos[0] - xMod) / CHUNK_SIZE) + RENDER_RADIUS - Math.floor(player[0] / CHUNK_SIZE) +
        (Math.round((pos[1] - yMod) / CHUNK_SIZE) + RENDER_RADIUS - Math.floor(player[1] / CHUNK_SIZE)) * RENDER_DIAMETER;

    let r = xMod + yMod * CHUNK_SIZE

    if (newData || newData === 0) {
        chunks[a].chunk[r] = newData;
        return;
    }

    let dat = chunks[a].chunk[r];

    if (!dat) return 0;

    return dat;
}

let chunkPosGlobal = (pos, data) => {
    let chunkPos = [
        Math.floor(pos[0] / CHUNK_SIZE),
        Math.floor(pos[1] / CHUNK_SIZE)
    ];

    let xMod = boundModulo(pos[0], CHUNK_SIZE);
    let yMod = boundModulo(pos[1], CHUNK_SIZE);

    let chunk = loadChunk(chunkPos, false)

    if (data || data === 0) {
        chunk[xMod + yMod * CHUNK_SIZE] = data;
        return;
    }

    return chunk[xMod + yMod * CHUNK_SIZE];
}

// TODO: also clean this up
let loadChunk = (pos, doStructures, doGravity) => {
    let index = `${pos[0]},${pos[1]}`;

    let chunk = save[index];
    if (!chunk) {
        chunk = save[index] = initChunk(pos);
    }

    if (!doStructures) return chunk;
    chunk.forEach((block, i) => {
        let lpos = [
            i % CHUNK_SIZE + pos[0] * CHUNK_SIZE,
            Math.floor(i / CHUNK_SIZE) + pos[1] * CHUNK_SIZE
        ];

        if (block == 9) {
            let structData = structures[0];
            let base = structData.base;

            structData.struct.forEach((row, y) => {
                row.forEach((block, x) => {
                    chunkPosGlobal([lpos[0] + base[0] + x, lpos[1] + base[1] + y], block)
                })
            })

        } else if (block == 6 && doGravity) {
            let x2 = lpos[0];
            let y2 = lpos[1];
            let belowBlock = chunkPosGlobal([x2, y2 + 1]);
            if (belowBlock != 0) return;

            gravityQueue.push([x2, y2]);
        }
    })

    if (!doGravity) return chunk;

    return chunk;
}

// TODO: clean this up
let tick = () => {
    vel[0] /= 1.09;
    vel[1] /= 1.02;

    vel[0] -= ((keys['a'] ? 0.02 : 0) - (keys['d'] ? 0.02 : 0));
    vel[1] += 0.02;

    let binded = false;
    INVENTORY_BINDS.forEach((bind, i) => {
        if (keys[bind]) {
            binded = true;
            selectedIndex = i;
        }
    })

    if (binded) selectSlot(selectedIndex);

    document.querySelector('#text').textContent = `x = ${pos[0]}\ny = ${pos[1]}`

    for (let i = 0; i < RENDER_AREA; i++) {
        let chunkPos = [
            (i % RENDER_DIAMETER) - RENDER_RADIUS + Math.floor(pos[0] / CHUNK_SIZE),
            Math.floor(i / RENDER_DIAMETER) - RENDER_RADIUS + Math.floor(pos[1] / CHUNK_SIZE)
        ];
        chunks[i] = {
            pos: chunkPos,
            chunk: loadChunk(chunkPos, true, doGravity)
        };
    }

    if (doGravity) {
        gravityQueue.forEach(([x2, y2]) => {
            chunkPosGlobal([x2, y2],0);
            chunkPosGlobal([x2, y2 + 1],6);
        })
        gravityQueue = [];
    }

    doGravity = false;

    let posTemp = [pos[0], pos[1]];

    let left = Math.floor(pos[0] + 0);
    let right = Math.floor(pos[0] + 1);

    let left2 = Math.floor(pos[0] + 0.2);
    let right2 = Math.floor(pos[0] + 0.8);

    let bottom2 = Math.floor(pos[1] + 1.1);
    let top = Math.floor(pos[1] + 0.1);
    let top2 = Math.floor(pos[1] - 0.9);

    let ground = ((chunkPos(posTemp, [left2, bottom2], chunks) != 0 ||
        chunkPos(posTemp, [right2, bottom2], chunks) != 0));

    if (ground) {
        pos[1] = Math.floor(posTemp[1]);

        bottom2 = Math.floor(pos[1] + 1.1);
        top = Math.floor(pos[1] + 0.1);
        top2 = Math.floor(pos[1] - 0.9);
        vel[1] = Math.min(vel[1], 0);
    }

    if (chunkPos(posTemp, [left2, top2], chunks) != 0 ||
        chunkPos(posTemp, [right2, top2], chunks) != 0) {
        vel[1] = Math.max(vel[1], 0);
        pos[1] = Math.ceil(posTemp[1]);

        bottom2 = Math.floor(pos[1] + 1.1);
        top = Math.floor(pos[1] + 0.1);
        top2 = Math.floor(pos[1] - 0.9);
    }

    if (keys[' '] && ground)
        vel[1] = -0.5;

    if ((chunkPos(posTemp, [right, top], chunks) != 0) ||
        (chunkPos(posTemp, [right, top2], chunks) != 0) ||
        (chunkPos(posTemp, [right, top2], chunks) != 0) ||
        (chunkPos(posTemp, [left, top], chunks) != 0)) {
        pos[0] = Math.round(posTemp[0]);
    }

    if ((chunkPos(posTemp, [right + vel[0], top], chunks) != 0 && vel[0] > 0) ||
        (chunkPos(posTemp, [left + vel[0], top], chunks) != 0 && vel[0] < 0) ||
        (chunkPos(posTemp, [right + vel[0], top2], chunks) != 0 && vel[0] > 0) ||
        (chunkPos(posTemp, [left + vel[0], top2], chunks) != 0 && vel[0] < 0)) {
        vel[0] = 0;
    }

    pos[0] += vel[0];
    pos[1] += vel[1];

    return {
        chunks,
        pos,
        vel,
        CHUNK_SIZE
    };
}

let minorTick = () => {
    doGravity = true;
    if (isBreaking) {
        let newBlock = chunkPos(pos, offset, chunks);
        if (newBlock == 0) return;

        new Audio('./audio/break.wav').play();

        breakCounter++;
        if (breakCounter < MAX_BREAK) return;
        breakCounter = 0;

        addInventory(newBlock);

        chunkPos(pos, offset, chunks, 0);
    }

}


let down = (e) => {
    keys[e.key.toLowerCase()] = true;
};

let up = (e) => {
    keys[e.key.toLowerCase()] = false;
};

let mousemove = (e) => {
    let x = Math.floor(pos[0] + (e.clientX - canvas.width / 2) / TILE_SIZE);
    let y = Math.floor(pos[1] + (e.clientY - canvas.height / 2) / TILE_SIZE);

    if (offset[0] != x || offset[1] != y) breakCounter = 0;

    offset = [
        x,
        y,
    ];
}

let mouseup = (e) => {
    isBreaking = false
}

let mousedown = (e) => {
    isBreaking = true;
}

let rightclick = (e) => {
    e.preventDefault();
    isBreaking = false;

    let offset = [
        Math.floor(pos[0] + (e.clientX - canvas.width / 2) / TILE_SIZE),
        Math.floor(pos[1] + (e.clientY - canvas.height / 2) / TILE_SIZE),
    ]

    let oldBlock = chunkPos(pos, offset, chunks);
    if (oldBlock != 0) return;

    let inv = getInventory();
    let newBlock = inv[selectedIndex];

    if (!newBlock.amount || !newBlock.type) return;
    inv[selectedIndex].amount--;

    setInventory(inv);

    chunkPos(pos, offset, chunks, newBlock.type);
}

window.addEventListener('keydown', down)
window.addEventListener('keyup', up)
window.addEventListener('mousedown', mousedown)
window.addEventListener('mouseup', mouseup)
window.addEventListener('mousemove', mousemove)
window.addEventListener('contextmenu', rightclick)

setInterval(constructUpdates(tick), 1000 / 60);
setInterval(minorTick, 1000 / 10);