import { RelayPacket } from './RelayPacket';

export class RelayPacket70SpecialUpdate extends RelayPacket {
  public static readonly OPERATION_UPDATE_CERTIFICATE = 105;

  public OPERATION: number;
  public UPDATE_PACKET: Buffer;

  public constructor ();
  public constructor (operation: number, updatePacket: Buffer);
  public constructor (operation?: number, updatePacket?: Buffer) {
    super();
    this.OPERATION = operation ?? 0;
    this.UPDATE_PACKET = updatePacket ?? Buffer.alloc(0);
  }

  public read (input: Buffer, o: number = 0): void {
    this.OPERATION = input.readUInt8(o++);
    this.UPDATE_PACKET = RelayPacket.readBytes16(input.subarray(o));
  }

  public write (output: Buffer, o: number = 0): number {
    output.writeUInt8(this.OPERATION, o++);
    o = RelayPacket.writeBytes16(output, this.UPDATE_PACKET);
    return o;
  }

  public packetLength (): number {
    return 3 + this.UPDATE_PACKET.length;
  }
}
