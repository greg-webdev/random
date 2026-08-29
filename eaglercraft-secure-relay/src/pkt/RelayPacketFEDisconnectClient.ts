import { RelayPacket } from './RelayPacket';

export class RelayPacketFEDisconnectClient extends RelayPacket {
  public static readonly TYPE_FINISHED_SUCCESS = 0;
  public static readonly TYPE_FINISHED_FAILED = 1;
  public static readonly TYPE_TIMEOUT = 2;
  public static readonly TYPE_INVALID_OPERATION = 3;
  public static readonly TYPE_INTERNAL_ERROR = 4;
  public static readonly TYPE_SERVER_DISCONNECT = 5;
  public static readonly TYPE_UNKNOWN = 255;

  public static readonly RATELIMIT_PACKET_TOO_MANY: Buffer = Buffer.from([-4, 0]);
  public static readonly RATELIMIT_PACKET_BLOCK: Buffer = Buffer.from([-4, 1]);
  public static readonly RATELIMIT_PACKET_BLOCK_LOCK: Buffer = Buffer.from([-4, 2]);
  public static readonly RATELIMIT_PACKET_LOCKED: Buffer = Buffer.from([-4, 3]);

  public CLIENT_ID: string;
  public CODE: number;
  public REASON: string;

  public constructor ();
  public constructor (clientId: string, code: number, reason: string);
  public constructor (clientId?: string, code?: number, reason?: string) {
    super();
    this.CLIENT_ID = clientId ?? '';
    this.CODE = code ?? 0;
    this.REASON = reason ?? '';
  }

  public read (input: Buffer, o: number = 0): void {
    this.CLIENT_ID = RelayPacket.readASCII8(input.subarray(o));
    o += 1 + this.CLIENT_ID.length;
    this.CODE = input.readUInt8(o++);
    this.REASON = RelayPacket.readASCII16(input.subarray(o));
    o += 2 + this.REASON.length;
  }

  public write (output: Buffer, o: number = 0): number {
    o = RelayPacket.writeASCII8(output, this.CLIENT_ID, o);
    output.writeUInt8(this.CODE & 0xff, o++);
    o = RelayPacket.writeASCII16(output, this.REASON, o);
    return o;
  }

  public packetLength (): number {
    return 4 + (this.CLIENT_ID !== undefined && this.CLIENT_ID !== null && this.CLIENT_ID !== '' ? this.CLIENT_ID.length : 0) + (this.REASON !== undefined && this.REASON !== null && this.REASON !== '' ? this.REASON.length : 0);
  }
}
