import { RelayVersion } from '../utils/RelayVersion';
import { RelayPacket } from './RelayPacket';

export class RelayPacket69Pong extends RelayPacket {
  public PROTOCOL_VERSION: number;
  public COMMENT: string;
  public BRAND: string;

  public constructor ();
  public constructor (protocolVersion: number, comment: string, brand: string);
  public constructor (protocolVersion?: number, comment?: string, brand?: string) {
    super();
    if (comment !== undefined && comment.length > 255) comment = comment.substring(0, 256);
    this.PROTOCOL_VERSION = protocolVersion ?? RelayVersion.PROTOCOL;
    this.COMMENT = comment ?? RelayVersion.DEFAULT_COMMENT;
    this.BRAND = brand ?? RelayVersion.BRAND;
  }

  public read (input: Buffer, o: number = 0): void {
    this.PROTOCOL_VERSION = input.readUInt8(o++);
    this.COMMENT = RelayPacket.readASCII8(input.subarray(o));
    o += 1 + this.COMMENT.length;
    this.BRAND = RelayPacket.readASCII8(input.subarray(o));
    o += 1 + this.BRAND.length;
  }

  public write (output: Buffer, o: number = 0): number {
    output.writeUInt8(this.PROTOCOL_VERSION, o++);
    o = RelayPacket.writeASCII8(output, this.COMMENT, o);
    o = RelayPacket.writeASCII8(output, this.BRAND, o);
    return o;
  }

  public packetLength (): number {
    return 3 + this.COMMENT.length + this.BRAND.length;
  }
}
