import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Terrain } from './server/terrain.js';
import parser from 'body-parser';
import { randomBytes } from 'node:crypto';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fetch from 'node-fetch';

const { text } = parser;

const app = express();
const server = createServer(app);
const io = new Server(server);

const port = 3000;
const MAX_SEED = 0xFFFFFFFF;
const prefix = `${process.cwd()}/db/world`;

const DECODER = new TextDecoder("utf-8");
const ENCODER = new TextEncoder("utf-8");

let terrain = {};

app.use(text());

(async () => {
  await mkdir(prefix, { recursive: true });
})();

function isNumeric(n) {
  return !isNaN(parseInt(n)) && isFinite(n);
}

server.listen(port, () => {
  console.log(`G(n)ame listening on port ${port}`)
})

app.get('/api/world/:id', async (req, res) => {
  let id = req.params.id;

  try {
    let seed = await readFile(`${prefix}/${id}/world.json`);
    terrain[id] = new Terrain(JSON.parse(seed).seed);
    res.send(seed);
  } catch (err) {
    await mkdir(`${prefix}/${id}`, { recursive: true });

    let seed = Math.floor(Math.random() * MAX_SEED);
    let worldJson = JSON.stringify({
      seed: seed,
      id: id
    });

    terrain[id] = new Terrain(seed);

    await writeFile(`${prefix}/${id}/world.json`, worldJson, 'utf8');
    res.send(worldJson);
  }
})

app.all('/api/save/:id/:x/:y', async (req, res) => {
  let { id, x, y } = req.params;


  let coords = `${x}t${y}.bin`;

  if (req.method == 'GET') {
    try {
      let data = await readFile(`${prefix}/${id}/${coords}`, 'utf8');
      res.send(data);
    } catch (err) {
      let newId = terrain[id];
      if (!newId) {
        res.send('nothing');
        return;
      }
      let chunkData = terrain[id].initChunk([x, y]);

      let chunk = new Uint8Array(chunkData.buffer);
      let data = DECODER.decode(chunk);

      await writeFile(`${prefix}/${id}/${coords}`, data, 'utf8');
      res.send(data)
    }
    return;
  } else if (req.method == 'POST') {
    let utfData = req.body;

    if (utfData.length != 512 || !isNumeric(x) || !isNumeric(y)) {
      res.send('What are you doing?');
      return;
    }
    try {
      await writeFile(`${prefix}/${id}/${coords}`, utfData, 'utf8');
      res.send('success');
    } catch (err) {
      res.send('You broke something')
    }
    return;
  }

  res.send('What are you doing?');
})

io.on('connection', (socket) => {
  let id = 'Unknown ' + randomBytes(16).toString("hex");
  let areaCurr = 'default';

  socket.on('join', async ({area, token}) => {

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
  })

  socket.on('move', ({ x, y }) => {
    io.to(areaCurr).emit('move', { x, y, id });
  })

  socket.on('update', ({ x, y }) => {
    io.to(areaCurr).emit('update', { x, y });
  })

  socket.on('disconnect', () => {
    io.to(areaCurr).emit('move', { Infinity, Infinity, id });
  })
});

app.use(express.static('static'));