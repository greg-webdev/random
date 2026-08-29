import { RelayLogger } from '../utils/RelayLogger';

export abstract class RelayPacket {
  private static readonly DEFINED_PACKET_CLASSES: Map<number, new () => RelayPacket> = new Map();
  private static readonly DEFINED_PACKET_CTORS: Map<number, () => RelayPacket> = new Map();
  private static readonly DEFINED_PACKET_IDS: Map<Function, number> = new Map();

  public static register (id: number, clazz: new () => RelayPacket, ctor: () => RelayPacket): void {
    this.DEFINED_PACKET_CLASSES.set(id, clazz);
    this.DEFINED_PACKET_CTORS.set(id, ctor);
    this.DEFINED_PACKET_IDS.set(clazz, id);
  }

  public static readPacket (input: Buffer): RelayPacket {
    const i = input.readUInt8(0);
    const ctor = this.DEFINED_PACKET_CTORS.get(i);
    if (ctor === undefined) {
      throw new Error(`Unknown packet type: ${i}`);
    } else {
      const pkt: RelayPacket = ctor();
      pkt.read(input.subarray(1));
      return pkt;
    }
  }

  public static writePacket (packet: RelayPacket): Buffer {
    const i = this.DEFINED_PACKET_IDS.get(packet.constructor);
    if (i !== undefined) {
      const len = packet.packetLength();
      const bao: Buffer = Buffer.alloc(len === -1 ? 2 : len + 1);
      bao.writeUInt8(i);
      const used = packet.write(bao, 1);
      if (len !== -1 && used !== len + 1) RelayLogger.debug('writePacket buffer for packet {} {} by {} bytes', packet.constructor.name, len + 1 < used ? 'overflowed' : 'underflowed', Math.abs(len + 1 - used));
      return bao.subarray(0, used);
    } else {
      throw new Error(`Unknown packet type: ${packet.constructor.name}`);
    }
  }

  public read (input: Buffer, o: number = 0): void {
  }

  public write (output: Buffer, o: number = 0): number {
    return o;
  }

  public packetLength (): number {
    return -1;
  }

  public static readASCII (input: Buffer, len: number): string {
    const chars: string[] = [];

    for (let i = 0; i < len; i++) {
      const j = input[i];
      if (j === undefined) throw new Error('EOFException');
      chars.push(String.fromCharCode(j));
    }

    return chars.join('');
  }

  public static writeASCII (output: Buffer, txt: string, o: number = 0): number {
    for (let i = 0; i < txt.length; i++) output.writeUInt8(txt.charCodeAt(i) & 0xff, o++);
    return o;
  }

  public static readASCII8 (input: Buffer): string {
    const i = input.readUInt8(0);
    if (i < 0 || input.length < 1) throw new Error('EOFException');
    else return this.readASCII(input.subarray(1), i);
  }

  public static writeASCII8 (output: Buffer, txt: string, o: number = 0): number {
    if (txt === undefined) {
      output.writeUInt8(0, o++);
    } else {
      const l = txt.length;
      output.writeUInt8(l & 0xff, o++);
      for (let i = 0; i < l; ++i) output.writeUInt8(txt.charCodeAt(i) & 0xff, o++);
    }
    return o;
  }

  public static readASCII16 (input: Buffer): string {
    const hi = input.readUInt8(0);
    const lo = input.readUInt8(1);
    if (hi >= 0 && lo >= 0) return this.readASCII(input.subarray(2), (hi << 8) | lo);
    else throw new Error('EOFException');
  }

  public static writeASCII16 (output: Buffer, txt: string | undefined, o: number = 0): number {
    if (txt === undefined) {
      output.writeUInt8(0, o++);
      output.writeUInt8(0, o++);
    } else {
      const l = txt.length;
      output.writeUInt8((l >>> 8) & 0xff, o++);
      output.writeUInt8(l & 0xff, o++);
      for (let i = 0; i < l; ++i) output.writeUInt8(txt.charCodeAt(i) & 0xff, o++);
    }
    return o;
  }

  public static readBytes16 (input: Buffer): Buffer {
    const hi = input.readUInt8(0);
    const lo = input.readUInt8(1);
    if (hi >= 0 && lo >= 0) {
      const len = (hi << 8) | lo;
      if (input.length < 2 + len) throw new Error('EOFException');
      const ret = input.subarray(2, 2 + len);
      return ret;
    } else {
      throw new Error('EOFException');
    }
  }

  public static writeBytes16 (output: Buffer, arr: Buffer, o: number = 0): number {
    if (arr === undefined) {
      output.writeUInt8(0, o++);
      output.writeUInt8(0, o++);
    } else {
      const len = arr.length;
      output.writeUInt8((len >>> 8) & 0xff, o++);
      output.writeUInt8(len & 0xff, o++);
      for (let i = 0; i < len; ++i) {
        output.writeUInt8(arr[i], o++);
      }
    }
    return o;
  }

  public static toASCIIBin (txt: string | null): Buffer {
    if (txt === null) {
      return Buffer.alloc(0);
    } else {
      const ret = Buffer.alloc(txt.length);
      for (let i = 0; i < txt.length; ++i) ret[i] = txt.charCodeAt(i) & 0xff;
      return ret;
    }
  }

  public static toASCIIStr (bin: Buffer): string {
    let ret = '';
    for (let i = 0; i < bin.length; ++i) ret += String.fromCharCode(bin[i] & 0xff);
    return ret;
  }
}
