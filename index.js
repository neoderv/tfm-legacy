import { mkdir, readFile, writeFile } from 'node:fs/promises';
import parser from 'body-parser';
import {randomBytes} from 'node:crypto';
const { text } = parser;
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
app.use(text());
const server = createServer(app);

const port = 3000;
const MAX_SEED = 0xFFFFFFFF;
const prefix = `${process.cwd()}/db/world`;

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
    res.send(seed);
  } catch (err) {
    await mkdir(`${prefix}/${id}`, { recursive: true });

    let worldJson = JSON.stringify({
      seed: Math.floor(Math.random() * MAX_SEED),
      id: id
    });

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
      res.send('nothing')
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

const io = new Server(server);
io.on('connection', (socket) => {
  const id = randomBytes(16).toString("hex");
  let areaCurr = 'default';

  socket.on('join', (area) => {
    socket.join(area);
    areaCurr = area;
  })

  socket.on('move', ({x,y}) => {
    io.to(areaCurr).emit('move', {x,y,id});
  })

  socket.on('update', ({x,y}) => {
    io.to(areaCurr).emit('update', {x,y});
  })

  socket.on('disconnect', () => {
    io.to(areaCurr).emit('move', {Infinity,Infinity,id});
  })
});

app.use(express.static('static'));