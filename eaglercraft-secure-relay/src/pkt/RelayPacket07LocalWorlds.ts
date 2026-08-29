import { RelayPacket } from './RelayPacket';

export class RelayPacket07LocalWorlds extends RelayPacket {
  public WORLD_LIST: LocalWorld[];

  public constructor ();
  public constructor (worlds: LocalWorld[]);
  public constructor (worlds?: LocalWorld[]) {
    super();
    this.WORLD_LIST = worlds ?? [];
  }

  public read (input: Buffer, o: number = 0): void {
    const l = input.readUInt8(o++);
    if (this.WORLD_LIST === null) this.WORLD_LIST = new Array<LocalWorld>(0);
    else this.WORLD_LIST.length = 0;

    for (let i = 0; i < l; ++i) {
      const name = RelayPacket.readASCII8(input.subarray(o));
      o += 1 + name.length;
      const code = RelayPacket.readASCII8(input.subarray(o));
      o += 1 + code.length;
      this.WORLD_LIST.push(new LocalWorld(name, code));
    }
  }

  public write (output: Buffer, o: number = 0): number {
    if (this.WORLD_LIST === null) {
      output.writeUInt8(0, o++);
    } else {
      let i = this.WORLD_LIST.length;
      if (i > 255) i = 255;
      output.writeUInt8(i, o++);
      for (let j = 0; j < i; ++j) {
        const w = this.WORLD_LIST[j];
        o = RelayPacket.writeASCII8(output, w.worldName, o);
        o = RelayPacket.writeASCII8(output, w.worldCode, o);
      }
    }
    return o;
  }

  public packetLength (): number {
    let accum = 1;
    if (this.WORLD_LIST != null) {
      for (let i = 0, l = this.WORLD_LIST.length; i < l; ++i) {
        const w = this.WORLD_LIST[i];
        accum += 2 + w.worldName.length + w.worldCode.length;
      }
    }
    return accum;
  }
}

export class LocalWorld {
  public worldName: string;
  public worldCode: string;

  public constructor (worldName: string, worldCode: string) {
    this.worldName = worldName;
    this.worldCode = worldCode;
  }
}
