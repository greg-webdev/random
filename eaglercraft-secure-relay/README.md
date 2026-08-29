# EaglerRelayJS

Eaglercraft relay server implementation written in TypeScript

> [!NOTE]
> **Most of the code was ported directly from the original java implementation, so there will probably be some bugs I missed.**

## Features:
- [x] Base relay server
- [x] IP forwarding
- [x] Origin whitelist
- [x] Join code customization
- [x] STUN / TURN server support
- [x] Rate limiting

## Usage:

### Standalone
```sh
$ npm install -g github:WebMCDevelopment/EaglerRelayJS
$ mkdir -p relay
$ cd relay
$ eaglerrelayjs --port 8080
```

### Existing App
```js
import http from 'http';
import express from 'express';
import { EaglerSPRelay } from 'eaglerrelayjs';

const app = express();
const server = http.createServer(app);
const relay = new EaglerSPRelay({ debug: true });

app.use((_req, res) => {
  res.set('Content-Type', 'text/plain');
  res.status(426).end('Upgrade Required');
});

server.on('upgrade', (req, socket, head) => relay.handleUpgrade(req, socket, head));
server.listen(8080);
```

## Contributing:
Contributions are welcome, but please keep the code style consistent.