// Script to generate icon PNGs
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, colorFn) {
  const bytesPerPixel = 4;
  const rawData = Buffer.alloc(height * (1 + width * bytesPerPixel));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = colorFn(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcData = Buffer.concat([typeBuf, data]);
    const crc = crc32(crcData);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // CRC32 implementation
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function iconColor(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const radius = w * 0.46;

  // Background rounded rect / circle
  if (dist > radius) {
    return [0, 0, 0, 0];
  }

  // Radial gradient: vibrant indigo (#6366f1) to cyan (#06b6d4)
  const normY = y / h;
  const normX = x / w;
  const r = Math.round(79 * (1 - normY) + 6 * normY);
  const g = Math.round(70 * (1 - normY) + 182 * normY);
  const b = Math.round(229 * (1 - normX) + 212 * normX);

  // Draw code brackets < > or JS symbol in center
  const nx = x / w;
  const ny = y / h;

  // Inner box/glow
  let isIcon = false;
  
  // Left bracket <
  // top branch: from (0.38, 0.3) to (0.24, 0.5)
  // bottom branch: from (0.24, 0.5) to (0.38, 0.7)
  const thickness = 0.06;
  const d1 = Math.abs((ny - 0.3) + (nx - 0.38) * 1.4);
  const d2 = Math.abs((ny - 0.7) - (nx - 0.38) * 1.4);
  
  if (nx >= 0.22 && nx <= 0.40 && ny >= 0.28 && ny <= 0.72) {
    if ((ny <= 0.5 && Math.abs(ny - (0.5 - (nx - 0.24) * 1.4)) < thickness) ||
        (ny > 0.5 && Math.abs(ny - (0.5 + (nx - 0.24) * 1.4)) < thickness)) {
      isIcon = true;
    }
  }

  // Right bracket >
  if (nx >= 0.60 && nx <= 0.78 && ny >= 0.28 && ny <= 0.72) {
    if ((ny <= 0.5 && Math.abs(ny - (0.5 - (0.76 - nx) * 1.4)) < thickness) ||
        (ny > 0.5 && Math.abs(ny - (0.5 + (0.76 - nx) * 1.4)) < thickness)) {
      isIcon = true;
    }
  }

  // Slash / in middle
  if (nx >= 0.42 && nx <= 0.58 && ny >= 0.26 && ny <= 0.74) {
    const lineX = 0.58 - (ny - 0.26) * (0.16 / 0.48);
    if (Math.abs(nx - lineX) < thickness * 0.7) {
      isIcon = true;
    }
  }

  if (isIcon) {
    return [255, 255, 255, 255];
  }

  return [r, g, b, 255];
}

const outDir = path.join(__dirname, 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

[16, 32, 48, 128].forEach(size => {
  const png = createPNG(size, size, iconColor);
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png`);
});
