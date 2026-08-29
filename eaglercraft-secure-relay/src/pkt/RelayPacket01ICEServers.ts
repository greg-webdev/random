import { RelayPacket } from './RelayPacket';

export class RelayPacket01ICEServers extends RelayPacket {
  public SERVERS: RelayServer[];

  public constructor ();
  public constructor (servers: RelayServer[]);
  public constructor (servers?: RelayServer[]) {
    super();
    this.SERVERS = servers ?? [];
  }

  public read (input: Buffer, o: number = 0): void {
    this.SERVERS.length = 0;
    const l = input.readUInt16BE(o); o += 2;

    for (let i = 0; i < l; ++i) {
      const type = String.fromCharCode(input.readUInt8(o++));
      let typeEnum: RelayType;

      if (type === 'S') {
        typeEnum = RelayType.NO_PASSWD;
      } else {
        if (type !== 'T') throw new Error(`Unknown/Unsupported Relay Type: '${type}'`);
        typeEnum = RelayType.PASSWD;
      }

      const address = RelayPacket.readASCII16(input.subarray(o));
      o += 2 + address.length;
      const username = RelayPacket.readASCII8(input.subarray(o));
      o += 1 + username.length;
      const password = RelayPacket.readASCII8(input.subarray(o));
      o += 1 + password.length;

      const addr = address.split(':', 2);
      this.SERVERS.push(new RelayServer(addr[1], typeEnum, addr[0], username, password));
    }
  }

  public write (output: Buffer, o: number = 0): number {
    const l = this.SERVERS.length;
    output.writeUInt16BE(l, o);
    o += 2;

    for (let i = 0; i < l; ++i) {
      const srv = this.SERVERS[i];

      if (srv.TYPE === RelayType.NO_PASSWD) {
        output.writeUInt8(83, o++);
      } else {
        if (srv.TYPE !== RelayType.PASSWD) throw new Error(`Unknown/Unsupported Relay Type: ${srv.TYPE}`);
        output.writeUInt8(84, o++);
      }

      o = RelayPacket.writeASCII16(output, srv.getFullAddress(), o);
      o = RelayPacket.writeASCII8(output, srv.USERNAME, o);
      o = RelayPacket.writeASCII8(output, srv.PASSWORD, o);
    }

    return o;
  }

  public packetLength (): number {
    let accum = 2;
    if (this.SERVERS != null) {
      for (let i = 0; i < this.SERVERS.length; ++i) {
        const s = this.SERVERS[i];
        const a = s.getFullAddress()?.length ?? 0;
        const u = s.USERNAME?.length ?? 0;
        const p = s.PASSWORD?.length ?? 0;
        accum += 5 + a + u + p;
      }
    }
    return accum;
  }
}

export class RelayServer {
  public ADDRESS: string;
  public TYPE: RelayType;
  public TYPE_STR: string;
  public USERNAME: string;
  public PASSWORD: string;

  public constructor (address: string, type: RelayType, typeStr: string, username: string, password: string) {
    this.ADDRESS = address;
    this.TYPE = type;
    this.TYPE_STR = typeStr;
    this.USERNAME = username;
    this.PASSWORD = password;
  }

  public getFullAddress (): string {
    return `${this.TYPE_STR}:${this.ADDRESS}`;
  }
}

export enum RelayType {
  NO_PASSWD,
  PASSWD,
}
