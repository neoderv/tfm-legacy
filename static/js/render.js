import { tiles } from './tiles.js';

const TILE_SIZE = 32;
const DIVIDER_SIZE = 16;

const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext("2d");

let constructUpdates = (tick) => {
    return () => {
        let { chunks, pos, CHUNK_SIZE, vel } = tick();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;

        chunks.forEach((datWrapper) => {
            datWrapper.chunk.forEach((item, j) => { 

                let x = (datWrapper.pos[0] * CHUNK_SIZE + (j % CHUNK_SIZE)) - pos[0]; 
                let y = (datWrapper.pos[1] * CHUNK_SIZE + Math.floor(j / CHUNK_SIZE)) - pos[1];

                x *= TILE_SIZE;
                y *= TILE_SIZE;

                x += canvas.width / 2;
                y += canvas.height / 2;

                let tile = tileMap[item];
                ctx.drawImage(tile,x,y,TILE_SIZE,TILE_SIZE);
            })
        })
        let isRight = (vel[0] < 0);
        ctx.drawImage(tileMap[1], 0, DIVIDER_SIZE * 2 * isRight, DIVIDER_SIZE,DIVIDER_SIZE*2, canvas.width / 2,canvas.height / 2 - TILE_SIZE,TILE_SIZE,TILE_SIZE*2);
    }
}

let resize = () => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
};

const observer = new ResizeObserver(resize);
observer.observe(canvas);

let tileMap = tiles.map(x => {
    let img = new Image();
    img.src = `./tile/${x.texture}.png`;
    return img;
});

export {
    constructUpdates,
    TILE_SIZE,
    canvas
};