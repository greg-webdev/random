import { RelayPacket } from './RelayPacket';

export class RelayPacketFFErrorCode extends RelayPacket {
  public static readonly TYPE_INTERNAL_ERROR = 0;
  public static readonly TYPE_PROTOCOL_VERSION = 1;
  public static readonly TYPE_INVALID_PACKET = 2;
  public static readonly TYPE_ILLEGAL_OPERATION = 3;
  public static readonly TYPE_CODE_LENGTH = 4;
  public static readonly TYPE_INCORRECT_CODE = 5;
  public static readonly TYPE_SERVER_DISCONNECTED = 6;
  public static readonly TYPE_UNKNOWN_CLIENT = 7;

  public static PACKET_TYPES: string[] = [];

  public CODE: number;
  public DESC: string;

  public static code2string (i: number): string {
    return (i < 0 || i >= this.PACKET_TYPES.length) ? 'UNKNOWN' : this.PACKET_TYPES[i];
  }

  public constructor ();
  public constructor (code: number, desc: string);
  public constructor (code?: number, desc?: string) {
    super();
    this.CODE = code ?? 0;
    this.DESC = desc ?? '';
  }

  public read (input: Buffer, o: number = 0): void {
    this.CODE = input.readUInt8(o++);
    this.DESC = RelayPacket.readASCII16(input.subarray(o));
    o += 2 + this.DESC.length;
  }

  public write (output: Buffer, o: number = 0): number {
    output.writeUInt8(this.CODE & 0xff, o++);
    o = RelayPacket.writeASCII16(output, this.DESC, o);
    return o;
  }

  public packetLength (): number {
    return 3 + this.DESC.length;
  }

  static {
    this.PACKET_TYPES[0] = 'TYPE_INTERNAL_ERROR';
    this.PACKET_TYPES[1] = 'TYPE_PROTOCOL_VERSION';
    this.PACKET_TYPES[2] = 'TYPE_INVALID_PACKET';
    this.PACKET_TYPES[3] = 'TYPE_ILLEGAL_OPERATION';
    this.PACKET_TYPES[4] = 'TYPE_CODE_LENGTH';
    this.PACKET_TYPES[5] = 'TYPE_INCORRECT_CODE';
    this.PACKET_TYPES[6] = 'TYPE_SERVER_DISCONNECTED';
    this.PACKET_TYPES[7] = 'TYPE_UNKNOWN_CLIENT';
  }
}
