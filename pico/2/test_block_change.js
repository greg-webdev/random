const mc = require('minecraft-protocol');
const des = mc.createDeserializer({isServer: false, version: '1.21.11', state: 'play'});

function encodeVarint(val) {
  const buf = [];
  while (true) {
    if ((val & ~0x7f) === 0) {
      buf.push(val);
      break;
    }
    buf.push((val & 0x7f) | 0x80);
    val >>>= 7;
  }
  return Buffer.from(buf);
}

function encodePosition(x, y, z) {
  const x_b = BigInt(x) & 0x3FFFFFFn;
  const z_b = BigInt(z) & 0x3FFFFFFn;
  const y_b = BigInt(y) & 0xFFFn;
  const pos = (x_b << 38n) | (z_b << 12n) | y_b;
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(pos, 0);
  return buf;
}

const posBuf = encodePosition(1, 64, 0);
const payload = Buffer.concat([posBuf, encodeVarint(4663)]);
const pkt = Buffer.concat([encodeVarint(payload.length + 1), Buffer.from([0x08]), payload]);

des.on('data', d => console.log('DESERIALIZED SUCCESS:', d.data.name, d.data.params));
des.write(pkt);
