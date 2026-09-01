/**
 * Lightweight pure-JS ZIP Archive Builder
 * Creates standard PKZip 2.0 archives that can be opened by Windows Explorer, 7-Zip, macOS Archive Utility, etc.
 */
class SimpleZip {
  constructor() {
    this.files = [];
  }

  /**
   * Add a file to the ZIP
   * @param {string} filename - relative path inside the zip (e.g. "scripts/app.js")
   * @param {string|Uint8Array} content - string content (UTF-8) or binary Uint8Array
   */
  file(filename, content) {
    let data;
    if (typeof content === 'string') {
      const encoder = new TextEncoder();
      data = encoder.encode(content);
    } else if (content instanceof Uint8Array) {
      data = content;
    } else if (content instanceof ArrayBuffer) {
      data = new Uint8Array(content);
    } else {
      data = new TextEncoder().encode(String(content || ''));
    }

    // Normalize path (forward slashes, no leading slash)
    const normalizedName = filename.replace(/\\/g, '/').replace(/^\/+/, '');
    this.files.push({
      name: normalizedName,
      data: data,
      date: new Date()
    });
    return this;
  }

  // Calculate CRC32
  static crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  // Convert Date to MS-DOS date/time
  static dosDateTime(d) {
    const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1f);
    const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
    return { time, date };
  }

  /**
   * Generates the binary ZIP buffer
   * @returns {Uint8Array}
   */
  generate() {
    const encoder = new TextEncoder();
    const localHeaders = [];
    const centralHeaders = [];
    let offset = 0;

    for (const file of this.files) {
      const nameBytes = encoder.encode(file.name);
      const crc = SimpleZip.crc32(file.data);
      const size = file.data.length;
      const { time, date } = SimpleZip.dosDateTime(file.date);

      // Local File Header (30 bytes + nameLen + dataLen)
      const localHeader = new Uint8Array(30 + nameBytes.length + size);
      const lv = new DataView(localHeader.buffer);

      lv.setUint32(0, 0x04034b50, true); // Local header signature 'PK\x03\x04'
      lv.setUint16(4, 20, true);         // Version needed to extract (2.0)
      lv.setUint16(6, 0x0800, true);     // General purpose bit flag (UTF-8 filename bit 11)
      lv.setUint16(8, 0, true);          // Compression method: 0 = Stored (no compression)
      lv.setUint16(10, time, true);      // File last mod time
      lv.setUint16(12, date, true);      // File last mod date
      lv.setUint32(14, crc, true);       // CRC-32
      lv.setUint32(18, size, true);      // Compressed size
      lv.setUint32(22, size, true);      // Uncompressed size
      lv.setUint16(26, nameBytes.length, true); // Filename length
      lv.setUint16(28, 0, true);         // Extra field length

      localHeader.set(nameBytes, 30);
      localHeader.set(file.data, 30 + nameBytes.length);

      localHeaders.push(localHeader);

      // Central Directory Header (46 bytes + nameLen)
      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(centralHeader.buffer);

      cv.setUint32(0, 0x02014b50, true); // Central directory signature 'PK\x01\x02'
      cv.setUint16(4, 20, true);         // Version made by (2.0)
      cv.setUint16(6, 20, true);         // Version needed to extract (2.0)
      cv.setUint16(8, 0x0800, true);     // General purpose bit flag (UTF-8)
      cv.setUint16(10, 0, true);         // Compression: Stored
      cv.setUint16(12, time, true);      // Mod time
      cv.setUint16(14, date, true);      // Mod date
      cv.setUint32(16, crc, true);       // CRC-32
      cv.setUint32(20, size, true);      // Compressed size
      cv.setUint32(24, size, true);      // Uncompressed size
      cv.setUint16(28, nameBytes.length, true); // Filename length
      cv.setUint16(30, 0, true);         // Extra field length
      cv.setUint16(32, 0, true);         // File comment length
      cv.setUint16(34, 0, true);         // Disk number start
      cv.setUint16(36, 0, true);         // Internal file attributes
      cv.setUint32(38, 0, true);         // External file attributes
      cv.setUint32(42, offset, true);    // Relative offset of local header

      centralHeader.set(nameBytes, 46);
      centralHeaders.push(centralHeader);

      offset += localHeader.length;
    }

    const centralDirOffset = offset;
    let centralDirSize = 0;
    for (const ch of centralHeaders) {
      centralDirSize += ch.length;
    }

    // End of Central Directory Record (22 bytes)
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);   // EOCD signature 'PK\x05\x06'
    ev.setUint16(4, 0, true);            // Number of this disk
    ev.setUint16(6, 0, true);            // Disk where central directory starts
    ev.setUint16(8, this.files.length, true);  // Number of central directory records on this disk
    ev.setUint16(10, this.files.length, true); // Total number of central directory records
    ev.setUint32(12, centralDirSize, true);    // Size of central directory
    ev.setUint32(16, centralDirOffset, true);  // Offset of start of central directory
    ev.setUint16(20, 0, true);           // Comment length

    // Assemble total buffer
    const totalSize = centralDirOffset + centralDirSize + eocd.length;
    const output = new Uint8Array(totalSize);
    let cur = 0;

    for (const lh of localHeaders) {
      output.set(lh, cur);
      cur += lh.length;
    }
    for (const ch of centralHeaders) {
      output.set(ch, cur);
      cur += ch.length;
    }
    output.set(eocd, cur);

    return output;
  }

  /**
   * Generates a Blob for browser downloading
   */
  generateBlob() {
    const buffer = this.generate();
    return new Blob([buffer], { type: 'application/zip' });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SimpleZip;
}
if (typeof window !== 'undefined') {
  window.SimpleZip = SimpleZip;
}
