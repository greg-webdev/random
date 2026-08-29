import WebSocket, { WebSocketServer } from 'ws';
import { RelayConfig } from '../utils/RelayConfig';
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { RelayLogger } from '../utils/RelayLogger';
import { EaglerSPClient } from './EaglerSPClient';
import { EaglerSPServer } from './EaglerSPServer';
import { RelayPacket } from '../pkt/RelayPacket';
import { RelayPacket01ICEServers } from '../pkt/RelayPacket01ICEServers';
import { RelayPacket00Handshake } from '../pkt/RelayPacket00Handshake';
import { LocalWorld, RelayPacket07LocalWorlds } from '../pkt/RelayPacket07LocalWorlds';
import { RelayPacket69Pong } from '../pkt/RelayPacket69Pong';
import { RelayPacketFEDisconnectClient } from '../pkt/RelayPacketFEDisconnectClient';
import { RelayPacketFFErrorCode } from '../pkt/RelayPacketFFErrorCode';
import { RelayVersion } from '../utils/RelayVersion';
import { SocketAddress } from '../utils/SocketAddress';
import { RateLimit, RateLimiter } from './RateLimiter';
import '../pkt/RegisterPackets';

export class EaglerSPRelay {
  private readonly WSS: WebSocketServer;
  private readonly CLIENT_IDS: Map<string, EaglerSPClient>;
  private readonly SERVER_CODES: Map<string, EaglerSPServer>;
  private readonly PENDING_CONNECTIONS: Map<WebSocket, PendingConnection>;
  private readonly CLIENT_CONNECTIONS: Map<WebSocket, EaglerSPClient>;
  private readonly SERVER_CONNECTIONS: Map<WebSocket, EaglerSPServer>;
  private readonly SERVER_ADDRESS_SETS: Map<string, EaglerSPServer[]>;

  private readonly WORLD_RATE_LIMITER: RateLimiter | undefined;
  private readonly PING_RATE_LIMITER: RateLimiter | undefined;

  public constructor ();
  public constructor (config: object);
  public constructor (config?: object) {
    this.WSS = new WebSocketServer({ noServer: true });
    if (config !== undefined) RelayConfig.loadConfigJSON(config);
    else RelayConfig.loadConfigFile('config.json');
    RelayLogger.debug('Debug logging enabled');
    if (RelayConfig.get('limits.world_ratelimit.enabled')) this.WORLD_RATE_LIMITER = new RateLimiter(Number(RelayConfig.get('limits.world_ratelimit.period')) * 1000, Number(RelayConfig.get('limits.world_ratelimit.limit')), Number(RelayConfig.get('limits.world_ratelimit.lockout_limit')), Number(RelayConfig.get('limits.world_ratelimit.lockout_time')) * 1000);
    if (RelayConfig.get('limits.ping_ratelimit.enabled')) this.PING_RATE_LIMITER = new RateLimiter(Number(RelayConfig.get('limits.ping_ratelimit.period')) * 1000, Number(RelayConfig.get('limits.ping_ratelimit.limit')), Number(RelayConfig.get('limits.ping_ratelimit.lockout_limit')), Number(RelayConfig.get('limits.ping_ratelimit.lockout_time')) * 1000);
    setInterval(() => {
      this.WORLD_RATE_LIMITER?.update();
      this.PING_RATE_LIMITER?.update();
    }, 30000);
    this.CLIENT_IDS = new Map();
    this.SERVER_CODES = new Map();
    this.PENDING_CONNECTIONS = new Map();
    this.CLIENT_CONNECTIONS = new Map();
    this.SERVER_CONNECTIONS = new Map();
    this.SERVER_ADDRESS_SETS = new Map();
    this.WSS.on('connection', (ws, req) => {
      const origin: string | undefined = (req.headers.origin ?? req.headers.host) as string;
      if (origin === undefined || !RelayConfig.isOriginAllowed(origin)) {
        ws.close();
        return;
      } else {
        const millis: number = Date.now();
        const address: string = RelayConfig.getRealIP(req);
        SocketAddress.setAddress(ws, address);
        this.PENDING_CONNECTIONS.set(ws, new PendingConnection(millis, address));
      }

      ws.on('message', (input: Buffer) => {
        try {
          const pkt: RelayPacket = RelayPacket.readPacket(input);
          const waiting: PendingConnection | undefined = this.PENDING_CONNECTIONS.get(ws);
          if (waiting !== undefined) {
            if (pkt instanceof RelayPacket00Handshake) {
              const ipkt: RelayPacket00Handshake = pkt;
              if (ipkt.CONNECTION_VERSION !== 1) {
                RelayLogger.debug('[{}]: Connected with unsupported protocol version: {} (supported version: {})', waiting.ADDRESS, ipkt.CONNECTION_CODE, 1);
                if (ipkt.CONNECTION_VERSION < 1) ws.send(RelayPacket.writePacket(new RelayPacketFFErrorCode(1, 'Outdated Client!')));
                else ws.send(RelayPacket.writePacket(new RelayPacketFFErrorCode(1, 'Outdated Server!')));
                ws.close();
              } else {
                let id: string | undefined;
                let srv: EaglerSPServer | undefined;
                if (ipkt.CONNECTION_TYPE === 1) {
                  if (!this.rateLimit(this.WORLD_RATE_LIMITER, ws, waiting.ADDRESS)) return;
                  let arr: EaglerSPServer[] | undefined = this.SERVER_ADDRESS_SETS.get(waiting.ADDRESS);
                  if (arr !== undefined && arr.length >= Number(RelayConfig.get('limits.worlds_per_ip'))) {
                    RelayLogger.debug('[{}]: Too many worlds are open on this address', waiting.ADDRESS);
                    ws.send(RelayPacketFEDisconnectClient.RATELIMIT_PACKET_TOO_MANY);
                    ws.close();
                    return;
                  }
                  RelayLogger.debug('[{}]: Connected as a server', waiting.ADDRESS);
                  let i: number = 0;
                  while (true) {
                    if (++i > 20) {
                      RelayLogger.error('Error: relay is running out of codes!');
                      RelayLogger.error('Closing connection to {}', waiting.ADDRESS);
                      break;
                    } else {
                      id = RelayConfig.generateCode();
                      if (!this.SERVER_CODES.has(id)) {
                        srv = new EaglerSPServer(ws, id, ipkt.CONNECTION_CODE, waiting.ADDRESS);
                        this.SERVER_CODES.set(id, srv);
                        break;
                      }
                    }
                  }
                  if (srv === undefined || id === undefined) {
                    ws.send(RelayPacket.writePacket(new RelayPacketFFErrorCode(0, 'Internal Server Error')));
                    ws.close();
                    return;
                  }
                  ipkt.CONNECTION_CODE = id;
                  ws.send(RelayPacket.writePacket(ipkt));
                  RelayLogger.debug('[{}] [Relay -> Server]: PKT 0x00: Assign join code: {}', waiting.ADDRESS, id);
                  this.SERVER_CONNECTIONS.set(ws, srv);
                  this.PENDING_CONNECTIONS.delete(ws);
                  arr = this.SERVER_ADDRESS_SETS.get(srv.SERVER_ADDRESS);
                  if (arr == undefined) {
                    arr = [];
                    this.SERVER_ADDRESS_SETS.set(srv.SERVER_ADDRESS, arr);
                  }
                  arr.push(srv);
                  (srv).send(new RelayPacket01ICEServers(RelayConfig.getRelayServers()));
                  RelayLogger.debug('[{}] [Relay -> Server]: PKT 0x01: Send ICE server list to server', waiting.ADDRESS);
                } else if (ipkt.CONNECTION_TYPE === 2) {
                  if (!this.rateLimit(this.PING_RATE_LIMITER, ws, waiting.ADDRESS)) return;
                  const codeLen: number = (RelayConfig.get('join_codes.length') as number);
                  let code: string = ipkt.CONNECTION_CODE;
                  RelayLogger.debug('[{}]: Connected as a client, requested server code: {}', waiting.ADDRESS, code);
                  if (code.length !== codeLen) {
                    RelayLogger.debug('The code \'{}\' is invalid because it\'s the wrong length, disconnecting', code);
                    ws.send(RelayPacket.writePacket(new RelayPacketFFErrorCode(4, `The join code is the wrong length, it should be ${codeLen} chars long`)));
                    ws.close();
                  } else {
                    if (!RelayConfig.get('join_codes.mixed_case')) code = code.toLowerCase();
                    srv = this.SERVER_CODES.get(code);
                    if (srv === undefined) {
                      ws.send(RelayPacket.writePacket(new RelayPacketFFErrorCode(5, 'Invalid code, no LAN world found!')));
                      ws.close();
                      return;
                    }
                    do {
                      id = EaglerSPClient.generateClientId();
                    } while (this.CLIENT_IDS.has(id));
                    const cl: EaglerSPClient = new EaglerSPClient(ws, srv, id, waiting.ADDRESS);
                    this.CLIENT_IDS.set(id, cl);
                    ipkt.CONNECTION_CODE = id;
                    ws.send(RelayPacket.writePacket(ipkt));
                    srv.handleNewClient(cl);
                    this.CLIENT_CONNECTIONS.set(ws, cl);
                    this.PENDING_CONNECTIONS.delete(ws);
                    cl.send(new RelayPacket01ICEServers(RelayConfig.getRelayServers()));
                    RelayLogger.debug('[{}] [Relay -> Client]: PKT 0x01: Send ICE server list to client', waiting.ADDRESS);
                  }
                } else if (ipkt.CONNECTION_TYPE === 3) {
                  if (!this.rateLimit(this.PING_RATE_LIMITER, ws, waiting.ADDRESS)) return;
                  RelayLogger.debug('[{}]: Pinging the server', waiting.ADDRESS);
                  ws.send(RelayPacket.writePacket(new RelayPacket69Pong(1, RelayConfig.get('server.comment') as string, RelayVersion.BRAND)));
                  ws.close();
                } else if (ipkt.CONNECTION_TYPE === 4) {
                  if (!this.rateLimit(this.PING_RATE_LIMITER, ws, waiting.ADDRESS)) return;
                  RelayLogger.debug('[{}]: Polling the server for other worlds', waiting.ADDRESS);
                  if (RelayConfig.get('server.show_local_worlds')) ws.send(RelayPacket.writePacket(new RelayPacket07LocalWorlds(this.getLocalWorlds(SocketAddress.getAddress(ws)))));
                  else ws.send(RelayPacket.writePacket(new RelayPacket07LocalWorlds([])));
                  ws.close();
                } else {
                  RelayLogger.debug('[{}]: Unknown connection type: {}', waiting.ADDRESS, ipkt.CONNECTION_TYPE);
                  ws.send(RelayPacket.writePacket(new RelayPacketFFErrorCode(3, 'Unexpected Init Packet')));
                  ws.close();
                }
              }
            } else {
              RelayLogger.debug('[{}]: Pending connection did not send a 0x00 packet to identify as a client or server', SocketAddress.getAddress(ws));
              ws.send(RelayPacket.writePacket(new RelayPacketFFErrorCode(3, 'Unexpected Init Packet')));
              ws.close();
            }
          } else {
            const srv: EaglerSPServer | undefined = this.SERVER_CONNECTIONS.get(ws);
            if (srv !== undefined) {
              if (!srv.handle(pkt)) {
                RelayLogger.debug('[{}]: Server sent invalid packet: {}', SocketAddress.getAddress(ws), pkt.constructor.name);
                ws.send(RelayPacket.writePacket(new RelayPacketFFErrorCode(2, 'Invalid Packet Recieved')));
                ws.close();
              }
            } else {
              const cl: EaglerSPClient | undefined = this.CLIENT_CONNECTIONS.get(ws);
              if (cl != null) {
                if (!cl.handle(pkt)) {
                  RelayLogger.debug('[{}]: Client sent invalid packet: {}', SocketAddress.getAddress(ws), pkt.constructor.name);
                  ws.send(RelayPacket.writePacket(new RelayPacketFFErrorCode(2, 'Invalid Packet Recieved')));
                  ws.close();
                }
              } else {
                RelayLogger.debug('[{}]: Connection has no client/server attached to it!', SocketAddress.getAddress(ws));
                ws.send(RelayPacket.writePacket(new RelayPacketFFErrorCode(3, 'Internal Server Error')));
                ws.close();
              }
            }
          }
        } catch (e) {
          RelayLogger.error('[{}]: Failed to handle binary frame: {}', SocketAddress.getAddress(ws), e instanceof Error ? e.message : e);
          if (e instanceof Error) RelayLogger.debug(e.stack);
        }
      });

      ws.on('close', () => {
        const srv: EaglerSPServer | undefined = this.SERVER_CONNECTIONS.get(ws);
        if (srv !== undefined) {
          RelayLogger.debug('[{}]: Server closed, code: {}', SocketAddress.getAddress(ws), srv.CODE);
          this.SERVER_CONNECTIONS.delete(ws);
          this.SERVER_CODES.delete(srv.CODE);
          const arr: EaglerSPServer[] | undefined = this.SERVER_ADDRESS_SETS.get(srv.SERVER_ADDRESS);
          if (arr != undefined) {
            const i = arr.indexOf(srv);
            if (i !== -1) arr.splice(i, 1);
            if (arr.length == 0) this.SERVER_ADDRESS_SETS.delete(srv.SERVER_ADDRESS);
          }
          for (const [socket, cl] of this.CLIENT_CONNECTIONS) {
            if (cl.SERVER === srv) {
              RelayLogger.debug('[{}]: Disconnecting client: {} (id: {})', SocketAddress.getAddress(socket), cl.ID);
              socket.close();
            }
          }
        } else {
          const cl: EaglerSPClient | undefined = this.CLIENT_CONNECTIONS.get(ws);
          if (cl !== undefined) {
            RelayLogger.debug('[{}]: Client closed, id: {}', SocketAddress.getAddress(ws), cl.ID);
            this.CLIENT_CONNECTIONS.delete(ws);
            this.CLIENT_IDS.delete(cl.ID);
            cl.SERVER.handleClientDisconnect(cl);
          } else {
            RelayLogger.debug('[{}]: Connection Closed', SocketAddress.getAddress(ws));
          }
        }
      });
    });
  }

  public handleUpgrade (req: IncomingMessage, socket: Socket, head: Buffer): void {
    this.WSS.handleUpgrade(req, socket, head, (ws) => this.WSS.emit('connection', ws, req));
  }

  private getLocalWorlds (addr: string): LocalWorld[] {
    const arr: LocalWorld[] = [];
    const srvs: EaglerSPServer[] | undefined = this.SERVER_ADDRESS_SETS.get(addr);
    if (srvs != undefined && srvs.length > 0) for (const s of srvs) if (!s.SERVER_HIDDEN) arr.push(new LocalWorld(s.SERVER_NAME, s.CODE));
    return arr;
  }

  private rateLimit (l: RateLimiter | undefined, ws: WebSocket, addr: string): boolean {
    if (l === undefined) return true;
    const r = l.limit(addr);
    if (r === RateLimit.NONE) return true;
    if (r === RateLimit.LIMIT) {
      ws.send(RelayPacketFEDisconnectClient.RATELIMIT_PACKET_BLOCK);
    } else if (r === RateLimit.LIMIT_NOW_LOCKOUT) {
      ws.send(RelayPacketFEDisconnectClient.RATELIMIT_PACKET_BLOCK_LOCK);
    }
    ws.close();
    return false;
  }
}

class PendingConnection {
  public OPEN_TIME: number;
  public ADDRESS: string;

  public constructor (openTime: number, address: string) {
    this.OPEN_TIME = openTime;
    this.ADDRESS = address;
  }
}
