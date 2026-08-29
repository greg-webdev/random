import { RelayPacket } from './RelayPacket';

export class RelayPacket02NewClient extends RelayPacket {
  public CLIENT_ID: string;

  public constructor ();
  public constructor (clientId: string);
  public constructor (clientId?: string) {
    super();
    this.CLIENT_ID = clientId ?? '';
  }

  public read (input: Buffer, o: number = 0): void {
    this.CLIENT_ID = RelayPacket.readASCII8(input);
  }

  public write (output: Buffer, o: number = 0): number {
    return RelayPacket.writeASCII8(output, this.CLIENT_ID, o);
  }

  public packetLength (): number {
    return 1 + this.CLIENT_ID.length;
  }
}
