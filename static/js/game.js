import { constructUpdates, TILE_SIZE, canvas } from './render.js';
//import { Terrain, CHUNK_SIZE } from './terrain.js';
import { selectSlot, setInventory, expandInv, addRecipes } from './inventory.js';
const CHUNK_SIZE = 16;

const RENDER_DIAMETER = 5; // This must be an odd number.
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

const DECODER = new TextDecoder("utf-8");
const ENCODER = new TextEncoder("utf-8");

let save = {};
let pos = [0, 20];
let vel = [0, 0];
let chunks = [];
let keys = {};
let toggle = {};
let selectedIndex = 0;
let isBreaking = false;
let offset = [0, 0];
let breakCounter = 0;
let doGravity = true;
let players = {};

let posDelta = [0, 0];
let posDeltaOld = [0, 0];
let posOld = [0, 0];

let health = 100;

let boundModulo = (a, b) => {
    let result = Math.round(a % b);
    if (result < 0) result += b;
    if (result >= b) result -= b;
    return result;
}

let chunkPos = (player, pos, chunks, newData) => {
    if (newData === 'break') {
        socket.emit('break', pos)
        return;
    } else if (newData === 'place') {
        return;
    }
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

let loadChunk = async (pos, doStructures, doGravity, forceLoad) => {

    let index = `${pos[0]},${pos[1]}`;

    let chunk = save[index];
    if (!chunk || forceLoad) {
        if (!chunk) chunk = save[index] = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE);

        let data = await fetch(`/api/save/${saveI}/${pos[0]}/${pos[1]}`).then(x => x.text())

        if (data && data !== 'nothing') {
            chunk = save[index] = new Uint16Array(ENCODER.encode(data).buffer);
        }
    }

    return chunk;
}

// TODO: clean this up
let tick = async () => {
    posDeltaOld = [posDelta[0], posDelta[1]];
    posOld = [pos[0], pos[1]];

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

    document.querySelector('#text').textContent = `x = ${Math.round(pos[0])}\ny = ${Math.round(pos[1])}\nhealth = ${health}`

    let pingPos = [];
    for (let i = 0; i < RENDER_AREA; i++) {
        let chunkPos = [
            (i % RENDER_DIAMETER) - RENDER_RADIUS + Math.floor(pos[0] / CHUNK_SIZE),
            Math.floor(i / RENDER_DIAMETER) - RENDER_RADIUS + Math.floor(pos[1] / CHUNK_SIZE)
        ];
        chunks[i] = {
            pos: chunkPos,
            chunk: await loadChunk(chunkPos, true, doGravity)
        };


        if (doGravity) {
            pingPos.push([
                Math.floor(pos[0] / CHUNK_SIZE) + (i % RENDER_DIAMETER) - RENDER_RADIUS,
                Math.floor(pos[1] / CHUNK_SIZE) + Math.floor(i / RENDER_DIAMETER) - RENDER_RADIUS
            ])
        }
    }

    if (doGravity) socket.emit('ping', pingPos);

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

    let hurtBlocks = [12, 13, 14];

    let damage = false;
    hurtBlocks.forEach(x => {
        if ((chunkPos(posTemp, [right, top], chunks) == x) ||
            (chunkPos(posTemp, [left, top], chunks) == x) ||
            (chunkPos(posTemp, [right, bottom2], chunks) == x) ||
            (chunkPos(posTemp, [left, bottom2], chunks) == x) && doGravity) {
            damage = true;
        }
    })

    if (damage) socket.emit('damage')


    pos[0] += vel[0];
    pos[1] += vel[1];

    posDelta = [pos[0] - posOld[0], pos[1] - posOld[1]];
    let posDeltaDelta = [posDelta[0] - posDeltaOld[0], posDelta[1] - posDeltaOld[1]];

    socket.emit('move', pos)

    doGravity = false;

    Object.keys(players).forEach((id) => {
        players[id].x += players[id].xv;
        players[id].y += players[id].yv;
    })

    return {
        chunks,
        players,
        pos,
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

        chunkPos(pos, offset, chunks, 'break');
    }

}


let down = (e) => {
    keys[e.key.toLowerCase()] = true;
    toggle[e.key.toLowerCase()] = !toggle[e.key.toLowerCase()];
    expandInv(toggle['e']);
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

    selectedIndex = selectSlot();
    socket.emit('place', { pos: offset, slot: selectedIndex });
}

let dec2hex = (dec) => {
    return dec.toString(16).padStart(2, "0")
}

let generateId = (len) => {
    let arr = new Uint8Array((len || 40) / 2)
    window.crypto.getRandomValues(arr)
    return Array.from(arr, dec2hex).join('')
}

let saveI = new URLSearchParams(window.location.search).get('id');
let token = window.localStorage.getItem('token');
let idO = -1;
async function main() {

    if (!saveI) {
        saveI = generateId(36);
        window.location.search = `?id=${saveI}`
    }

    if (!token) {
        window.location.href = `https://auth.montidg.net/account/auth?scope=tfm&next=${window.location.origin}/auth.html`;
    }

    let seed = await fetch(`/api/world/${saveI}`).then(x => x.json()).then(y => y.seed);

    //terrain = new Terrain(seed);

    setInterval(constructUpdates(tick), 1000 / 60);
    setInterval(minorTick, 1000 / 10);

    socket.emit('join', { area: saveI, token });

    socket.on('move', ({ x, y, id }) => {
        players[id].x = x;
        players[id].y = y;
    })

    socket.on('health', (h) => {
        health = h;
    })


    socket.on('origin', ({ x, y, id }) => {
        players[id] = { x, y, xv: 0, yv: 0 };
        let xd = players[idO].x - pos[0];
        let yd = players[idO].y - pos[1];

        pos = [players[idO].x, players[idO].y];

    })

    socket.on('init', ({ id }) => {
        idO = id;
    })

    socket.on('update', ({ x, y }) => {
        loadChunk([x, y], false, false, true);
    })

    socket.on('recipes', (recipe) => {
        addRecipes(recipe);
    })

    socket.on('inventory', (inv) => {
        setInventory(inv);
    })
}

window.addEventListener('keydown', down)
window.addEventListener('keyup', up)
window.addEventListener('mousedown', mousedown)
window.addEventListener('mouseup', mouseup)
window.addEventListener('mousemove', mousemove)
window.addEventListener('contextmenu', rightclick)

main();

const socket = io();