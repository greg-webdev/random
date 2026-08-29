import WebSocket from 'ws';
import { RelayLogger } from '../utils/RelayLogger';
import { LoginState, LoginStateUtils } from './LoginState';
import { EaglerSPClient } from './EaglerSPClient';
import { RelayPacket } from '../pkt/RelayPacket';
import { RelayPacket02NewClient } from '../pkt/RelayPacket02NewClient';
import { RelayPacket03ICECandidate } from '../pkt/RelayPacket03ICECandidate';
import { RelayPacket04Description } from '../pkt/RelayPacket04Description';
import { RelayPacket05ClientSuccess } from '../pkt/RelayPacket05ClientSuccess';
import { RelayPacket06ClientFailure } from '../pkt/RelayPacket06ClientFailure';
import { RelayPacketFEDisconnectClient } from '../pkt/RelayPacketFEDisconnectClient';
import { RelayPacketFFErrorCode } from '../pkt/RelayPacketFFErrorCode';
import { SocketAddress } from '../utils/SocketAddress';

export class EaglerSPServer {
  public readonly SOCKET: WebSocket;
  public readonly CODE: string;
  public readonly CLIENTS: Map<string, EaglerSPClient>;
  public readonly SERVER_NAME: string;
  public readonly SERVER_ADDRESS: string;
  public readonly SERVER_HIDDEN: boolean;

  public constructor (socket: WebSocket, code: string, serverName: string, serverAddress: string) {
    this.SOCKET = socket;
    this.CODE = code;
    this.CLIENTS = new Map<string, EaglerSPClient>();

    if (serverName.endsWith(';1')) {
      this.SERVER_HIDDEN = true;
      serverName = serverName.substring(0, serverName.length - 2);
    } else if (serverName.endsWith(';0')) {
      this.SERVER_HIDDEN = false;
      serverName = serverName.substring(0, serverName.length - 2);
    } else {
      this.SERVER_HIDDEN = false;
    }

    this.SERVER_NAME = serverName;
    this.SERVER_ADDRESS = serverAddress;
  }

  public send (packet: RelayPacket): void {
    if (this.SOCKET.readyState === WebSocket.OPEN) {
      try {
        this.SOCKET.send(RelayPacket.writePacket(packet));
      } catch (e) {
        RelayLogger.debug('Error sending data to {}', this.SERVER_ADDRESS);
        if (e instanceof Error) RelayLogger.debug(e.stack);
        try {
          this.SOCKET.send(RelayPacket.writePacket(new RelayPacketFFErrorCode(0, 'Internal Server Error')));
        } catch {}
        this.SOCKET.close();
      }
    } else {
      RelayLogger.debug('WARNING: Tried to send data to {} after the connection closed.', this.SERVER_ADDRESS);
    }
  }

  public handle (_packet: RelayPacket): boolean {
    if (_packet instanceof RelayPacket03ICECandidate) {
      const packet = _packet;
      const cl = this.CLIENTS.get(packet.PEER_ID);
      if (cl != null) {
        if (LoginStateUtils.assertEquals(cl, LoginState.SENT_ICE_CANDIDATE)) {
          cl.STATE = LoginState.RECIEVED_ICE_CANIDATE;
          cl.handleServerICECandidate(packet);
          RelayLogger.debug('[{}] [Server -> Relay -> Client]: PKT 0x03: ICECandidate', SocketAddress.getAddress(cl.SOCKET));
        }
      } else {
        this.SOCKET.send(RelayPacket.writePacket(new RelayPacketFFErrorCode(7, `Unknown Client ID: ${packet.PEER_ID}`)));
      }
      return true;
    } else if (_packet instanceof RelayPacket04Description) {
      const packet = _packet;
      const cl = this.CLIENTS.get(packet.PEER_ID);
      if (cl != null) {
        if (LoginStateUtils.assertEquals(cl, LoginState.SENT_DESCRIPTION)) {
          cl.STATE = LoginState.RECIEVED_DESCRIPTION;
          cl.handleServerDescription(packet);
          RelayLogger.debug('[{}] [Server -> Relay -> Client]: PKT 0x04: Description', SocketAddress.getAddress(cl.SOCKET));
        }
      } else {
        this.SOCKET.send(RelayPacket.writePacket(new RelayPacketFFErrorCode(7, `Unknown Client ID: ${packet.PEER_ID}`)));
      }
      return true;
    } else if (_packet instanceof RelayPacketFEDisconnectClient) {
      const packet = _packet;
      const cl = this.CLIENTS.get(packet.CLIENT_ID);
      if (cl != null) {
        cl.handleServerDisconnectClient(packet);
        RelayLogger.debug('[{}] [Server -> Relay -> Client]: PKT 0xFE: Disconnect: {}: {}', SocketAddress.getAddress(cl.SOCKET), packet.CODE, packet.REASON);
      } else {
        this.SOCKET.send(RelayPacket.writePacket(new RelayPacketFFErrorCode(7, `Unknown Client ID: ${packet.CLIENT_ID}`)));
      }
      return true;
    } else {
      return false;
    }
  }

  public handleNewClient (client: EaglerSPClient): void {
    this.CLIENTS.set(client.ID, client);
    this.send(new RelayPacket02NewClient(client.ID));
    RelayLogger.debug('[{}] [Relay -> Server]: PKT 0x02: Notify server of the client, id: {}', this.SERVER_ADDRESS, client.ID);
  }

  public handleClientDisconnect (client: EaglerSPClient): void {
    this.CLIENTS.delete(client.ID);
    if (!client.SERVER_NOTIFIED_OF_CLOSE) {
      this.send(new RelayPacketFEDisconnectClient(client.ID, 255, 'End of stream'));
      client.SERVER_NOTIFIED_OF_CLOSE = true;
    }
  }

  public handleClientICECandidate (client: EaglerSPClient, packet: RelayPacket03ICECandidate): void {
    this.send(new RelayPacket03ICECandidate(client.ID, packet.CANDIDATE));
  }

  public handleClientDescription (client: EaglerSPClient, packet: RelayPacket04Description): void {
    this.send(new RelayPacket04Description(client.ID, packet.DESCRIPTION));
  }

  public handleClientSuccess (client: EaglerSPClient, _packet: RelayPacket05ClientSuccess): void {
    this.send(new RelayPacket05ClientSuccess(client.ID));
  }

  public handleClientFailure (client: EaglerSPClient, _packet: RelayPacket06ClientFailure): void {
    this.send(new RelayPacket06ClientFailure(client.ID));
  }
}
