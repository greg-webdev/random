import { RelayPacket } from './RelayPacket';

export class RelayPacket04Description extends RelayPacket {
  public PEER_ID: string;
  public DESCRIPTION: Buffer;

  public constructor ();
  public constructor (peerId: string, desc: string | Buffer);
  public constructor (peerId?: string, desc?: string | Buffer) {
    super();
    this.PEER_ID = peerId ?? '';
    this.DESCRIPTION = (desc instanceof Buffer ? desc : RelayPacket.toASCIIBin(String(desc) ?? '')) ?? RelayPacket.toASCIIBin('');
  }

  public read (input: Buffer, o: number = 0): void {
    this.PEER_ID = RelayPacket.readASCII8(input.subarray(o));
    o += 1 + this.PEER_ID.length;
    this.DESCRIPTION = RelayPacket.readBytes16(input.subarray(o));
  }

  public write (output: Buffer, o: number = 0): number {
    o = RelayPacket.writeASCII8(output, this.PEER_ID, o);
    o = RelayPacket.writeBytes16(output, this.DESCRIPTION, o);
    return o;
  }

  public packetLength (): number {
    return 1 + this.PEER_ID.length + 2 + this.DESCRIPTION.length;
  }
}
