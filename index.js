import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Terrain } from './server/terrain.js';
import parser from 'body-parser';
import { randomBytes } from 'node:crypto';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fetch from 'node-fetch';
import { Inventory } from './server/inventory.js';

const { text } = parser;

const app = express();
const server = createServer(app);
const io = new Server(server);

const port = 3000;
const MAX_SEED = 0xFFFFFFFF;
const prefix = `${process.cwd()}/db/world`;

let terrain = {};

app.use(text());

(async () => {
  await mkdir(prefix, { recursive: true });
})();

server.listen(port, () => {
  console.log(`G(n)ame listening on port ${port}`)
})

app.get('/api/world/:id', async (req, res) => {
  let id = req.params.id;

  try {
    let seed = await readFile(`${prefix}/${id}/world.json`);
    terrain[id] = new Terrain(JSON.parse(seed).seed, id, io.to(id));
    res.send(seed);
  } catch (err) {
    await mkdir(`${prefix}/${id}`, { recursive: true });
    await mkdir(`${prefix}/${id}/terrain`, { recursive: true });
    await mkdir(`${prefix}/${id}/players`, { recursive: true });

    let seed = Math.floor(Math.random() * MAX_SEED);
    let worldJson = JSON.stringify({
      seed: seed,
      id: id
    });

    terrain[id] = new Terrain(seed, id, io);

    await writeFile(`${prefix}/${id}/world.json`, worldJson, 'utf8');
    res.send(worldJson);
  }
})

app.all('/api/save/:id/:x/:y', async (req, res) => {
  let { id, x, y } = req.params;

  if (!terrain.hasOwnProperty(id))  {
    res.send('nothing');
    return;
  }

  if (req.method == 'GET') {
    res.send(await terrain[id].loadChunk([x, y],true));
    return;
  } else if (req.method == 'POST') {
    /*let utfData = req.body;

    if (utfData.length != 512 || !isNumeric(x) || !isNumeric(y)) {
      res.send('What are you doing?');
      return;
    }
    try {
      await writeFile(`${prefix}/${id}/${coords}`, utfData, 'utf8');
      res.send('success');
    } catch (err) {
      res.send('You broke something')
    }*/
    return;
  }

  res.send('What are you doing?');
})

io.on('connection', (socket) => {
  let id = 'Unknown ' + randomBytes(16).toString("hex");
  let areaCurr = 'default';
  let inventory = new Inventory(socket, id, areaCurr);

  socket.on('join', async ({ area, token }) => {

    let username = await fetch('https://auth.montidg.net/api/account/token/', {
      'method': 'POST',
      'headers': {
        "Content-Type": "application/json",
      },
      'body': JSON.stringify({
        token: token,
        scope: 'tfm'
      })
    }).then(x => x.json());

    if (username.data && username.data.length > 0) id = username.data[0].username;
    socket.join(area);
    areaCurr = area;

    inventory = new Inventory(socket, id, areaCurr);
    await inventory.updateInventory();
  })

  socket.on('move', ({ x, y }) => {
    io.to(areaCurr).emit('move', { x, y, id });
  })

  socket.on('origin', ({ x, y, xv, yv }) => {
    io.to(areaCurr).emit('origin', { x, y, xv, yv, id });
  })

  socket.on('update', ({ x, y }) => {
    io.to(areaCurr).emit('update', { x, y });
  })

  socket.on('break', async (pos) => {
    if (!terrain[areaCurr]) return;

    let item = await terrain[areaCurr].chunkPosGlobal(pos);

    if (item == 0) return;

    await inventory.updateInventory();
    inventory.addInventory(item);
    terrain[areaCurr].chunkPosGlobal(pos, 0, true);
  })

  socket.on('place', async ({pos, slot}) => {
    if (!terrain[areaCurr]) return;

    let item = await terrain[areaCurr].chunkPosGlobal(pos);

    if (item != 0) return;

    await inventory.updateInventory();
    let place = inventory.removeInventory(slot);

    if (!place) return;

    terrain[areaCurr].chunkPosGlobal(pos, place, true);
  })


  socket.on('disconnect', () => {
    io.to(areaCurr).emit('move', { Infinity, Infinity, id });
  })

  socket.on('ping', (pos) => {
    if (!terrain[areaCurr]) return;
    pos.forEach(x => {
      terrain[areaCurr].pingChunk(x, true, true);
    })
    
  })
});

app.use(express.static('static'));