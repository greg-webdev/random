import WebSocket from 'ws';
import { LoginState, LoginStateUtils } from './LoginState';
import { EaglerSPServer } from './EaglerSPServer';
import { RelayLogger } from '../utils/RelayLogger';
import { RelayPacket } from '../pkt/RelayPacket';
import { RelayPacket03ICECandidate } from '../pkt/RelayPacket03ICECandidate';
import { RelayPacket04Description } from '../pkt/RelayPacket04Description';
import { RelayPacket05ClientSuccess } from '../pkt/RelayPacket05ClientSuccess';
import { RelayPacket06ClientFailure } from '../pkt/RelayPacket06ClientFailure';
import { RelayPacketFEDisconnectClient } from '../pkt/RelayPacketFEDisconnectClient';
import { SocketAddress } from '../utils/SocketAddress';

export class EaglerSPClient {
  private static readonly CLIENT_CODE_LENGTH = 16;
  private static readonly CLIENT_CODE_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  public readonly SOCKET: WebSocket;
  public readonly SERVER: EaglerSPServer;
  public readonly ID: string;
  public readonly ADDRESS: string;
  public readonly CREATED: number;

  public STATE: LoginState;
  public SERVER_NOTIFIED_OF_CLOSE: boolean;

  public constructor (socket: WebSocket, server: EaglerSPServer, id: string, address: string) {
    this.SOCKET = socket;
    this.SERVER = server;
    this.ID = id;
    this.ADDRESS = address;
    this.CREATED = Date.now();
    this.STATE = LoginState.INIT;
    this.SERVER_NOTIFIED_OF_CLOSE = false;
  }

  public send (packet: RelayPacket): void {
    if (this.SOCKET.readyState === WebSocket.OPEN) {
      try {
        this.SOCKET.send(RelayPacket.writePacket(packet));
      } catch (e) {
        RelayLogger.debug('Error sending data to {}', SocketAddress.getAddress(this.SOCKET));
        if (e instanceof Error) RelayLogger.debug(e.stack);
        this.disconnect(4, 'Internal Server Error');
        this.SOCKET.close();
      }
    } else {
      RelayLogger.debug('Tried to send data to {} after the connection closed.', SocketAddress.getAddress(this.SOCKET));
    }
  }

  public handle (packet: RelayPacket): boolean {
    if (packet instanceof RelayPacket03ICECandidate) {
      if (LoginStateUtils.assertEquals(this, LoginState.RECIEVED_DESCRIPTION)) {
        this.STATE = LoginState.SENT_ICE_CANDIDATE;
        this.SERVER.handleClientICECandidate(this, packet);
        RelayLogger.debug('[{}] [Client -> Relay -> Server]: PKT 0x03: ICECandidate', SocketAddress.getAddress(this.SOCKET));
      }
      return true;
    } else if (packet instanceof RelayPacket04Description) {
      if (LoginStateUtils.assertEquals(this, LoginState.INIT)) {
        this.STATE = LoginState.SENT_DESCRIPTION;
        this.SERVER.handleClientDescription(this, packet);
        RelayLogger.debug('[{}] [Client -> Relay -> Server]: PKT 0x04: Description', SocketAddress.getAddress(this.SOCKET));
      }
      return true;
    } else if (packet instanceof RelayPacket05ClientSuccess) {
      if (LoginStateUtils.assertEquals(this, LoginState.RECIEVED_ICE_CANIDATE)) {
        this.STATE = LoginState.FINISHED;
        this.SERVER.handleClientSuccess(this, packet);
        RelayLogger.debug('[{}] [Client -> Relay -> Server]: PKT 0x05: ClientSuccess', SocketAddress.getAddress(this.SOCKET));
        this.disconnect(0, 'Successful connection');
      }
      return true;
    } else if (packet instanceof RelayPacket06ClientFailure) {
      if (LoginStateUtils.assertEquals(this, LoginState.RECIEVED_ICE_CANIDATE)) {
        this.STATE = LoginState.FINISHED;
        this.SERVER.handleClientFailure(this, packet);
        RelayLogger.debug('[{}] [Client -> Relay -> Server]: PKT 0x06: ClientFailure', SocketAddress.getAddress(this.SOCKET));
        this.disconnect(1, 'Failed connection');
      }
      return true;
    } else {
      return false;
    }
  }

  public handleServerICECandidate (desc: RelayPacket03ICECandidate): void {
    this.send(new RelayPacket03ICECandidate('', desc.CANDIDATE));
  }

  public handleServerDescription (desc: RelayPacket04Description): void {
    this.send(new RelayPacket04Description('', desc.DESCRIPTION));
  }

  public handleServerDisconnectClient (packet: RelayPacketFEDisconnectClient): void {
    this.disconnect(packet.CODE, packet.REASON);
  }

  public disconnect (code: number, reason: string): void {
    const packet: RelayPacket = new RelayPacketFEDisconnectClient(this.ID, code, reason);
    if (!this.SERVER_NOTIFIED_OF_CLOSE) {
      if (code !== 0) this.SERVER.send(packet);
      this.SERVER_NOTIFIED_OF_CLOSE = true;
    }

    if (this.SOCKET.readyState === WebSocket.OPEN) {
      this.send(packet);
      this.SOCKET.close();
    }

    RelayLogger.debug('[{}] [Relay -> Client]: PKT 0xFE: #{} {}', SocketAddress.getAddress(this.SOCKET), code, reason);
  }

  public static generateClientId (): string {
    let ret = '';
    const bytes = new Uint8Array(this.CLIENT_CODE_LENGTH);
    crypto.getRandomValues(bytes);

    for (let i = 0; i < this.CLIENT_CODE_LENGTH; i++) ret += this.CLIENT_CODE_CHARS.charAt(bytes[i] % this.CLIENT_CODE_CHARS.length);

    return ret;
  }
}
