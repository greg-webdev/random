import { RelayLogger } from '../utils/RelayLogger';
import { SocketAddress } from '../utils/SocketAddress';
import { EaglerSPClient } from './EaglerSPClient';

export enum LoginState {
  INIT,
  SENT_ICE_CANDIDATE,
  RECIEVED_ICE_CANIDATE,
  SENT_DESCRIPTION,
  RECIEVED_DESCRIPTION,
  FINISHED,
}

export class LoginStateUtils {
  public static assertEquals (client: EaglerSPClient, state: LoginState): boolean {
    if (client.STATE !== state) {
      const msg = `client is in state ${LoginState[client.STATE]} when it was supposed to be ${LoginState[state]}`;
      client.disconnect(3, msg);
      RelayLogger.debug('[{}] [Relay -> Client]: PKT 0xFE: TYPE_INVALID_OPERATION: {}', SocketAddress.getAddress(client.SOCKET), msg);
      return false;
    }
    return true;
  }
}
