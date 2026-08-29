import { RelayPacket } from './RelayPacket';

export class RelayPacket00Handshake extends RelayPacket {
  public CONNECTION_TYPE = 0;
  public CONNECTION_VERSION = 1;
  public CONNECTION_CODE = '';

  public constructor ();
  public constructor (connectionType: number, connectionVersion: number, connectionCode: string);
  public constructor (connectionType?: number, connectionVersion?: number, connectionCode?: string) {
    super();
    this.CONNECTION_TYPE = connectionType ?? this.CONNECTION_TYPE;
    this.CONNECTION_VERSION = connectionVersion ?? this.CONNECTION_VERSION;
    this.CONNECTION_CODE = connectionCode ?? this.CONNECTION_CODE;
  }

  public read (input: Buffer, o: number = 0): void {
    this.CONNECTION_TYPE = input.readUInt8(o++);
    this.CONNECTION_VERSION = input.readUInt8(o++);
    this.CONNECTION_CODE = RelayPacket.readASCII8(input.subarray(o));
  }

  public write (output: Buffer, o: number = 0): number {
    output.writeUInt8(this.CONNECTION_TYPE, o++);
    output.writeUInt8(this.CONNECTION_VERSION, o++);
    o = RelayPacket.writeASCII8(output, this.CONNECTION_CODE, o);
    return o;
  }

  public packetLength (): number {
    return 2 + (this.CONNECTION_CODE !== '' ? 1 + this.CONNECTION_CODE.length : 0);
  }
}
