#!/usr/bin/env node
import http, { IncomingMessage } from 'http';
import express, { Request, Response } from 'express';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { EaglerSPRelay } from './exports';
import { RelayLogger } from './utils/RelayLogger';
import { Socket } from 'net';

const argv: any = yargs(hideBin(process.argv))
  .option('port', {
    alias: 'p',
    type: 'number',
    default: 8080,
    describe: 'Port to run the server on'
  })
  .help()
  .parse();

const app = express();
const server = http.createServer(app);
const relay = new EaglerSPRelay();

app.use((_req: Request, res: Response) => {
  res.set('Content-Type', 'text/plain');
  res.status(426).end('Upgrade Required');
});

server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => relay.handleUpgrade(req, socket, head));

server.listen(argv.port, () => {
  RelayLogger.info(`Started on port ${argv.port}`);
});
