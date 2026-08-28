const mc = require('minecraft-protocol');
const deserializer = mc.createDeserializer({ isServer: false, version: '1.21.4', state: 'play' });

function send_varint(val) {
  let buf = [];
  while (true) {
    if ((val & ~0x7F) === 0) {
      buf.push(val);
      break;
    } else {
      buf.push((val & 0x7F) | 0x80);
      val >>>= 7;
    }
  }
  return Buffer.from(buf);
}

function send_string(str) {
  const b = Buffer.from(str, 'utf8');
  return Buffer.concat([send_varint(b.length), b]);
}

function make_packet(id, payload) {
  const id_b = send_varint(id);
  const total_len = id_b.length + payload.length;
  return Buffer.concat([send_varint(total_len), id_b, payload]);
}

// 1. Play Login (0x2C)
const play_login_payload = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x01]), // Entity ID 1
  Buffer.from([0x00]),                   // Is Hardcore: false
  send_varint(1), send_string("minecraft:overworld"), // Dimension Names
  send_varint(5),                        // Max Players
  send_varint(2),                        // View Distance
  send_varint(2),                        // Simulation Distance
  Buffer.from([0x00]),                   // Reduced Debug Info: false
  Buffer.from([0x01]),                   // Enable Respawn Screen: true
  Buffer.from([0x00]),                   // Do Limited Crafting: false
  send_varint(0),                        // Dimension Type ID: 0
  send_string("minecraft:overworld"),    // Dimension Name
  Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x30, 0x39]), // Hashed Seed
  Buffer.from([0x01]),                   // Game Mode: Creative
  Buffer.from([0xFF]),                   // Previous Game Mode: None
  Buffer.from([0x00]),                   // Is Debug: false
  Buffer.from([0x01]),                   // Is Flat: true
  Buffer.from([0x00]),                   // Has Death Location: false
  send_varint(0),                        // Portal Cooldown: 0
  send_varint(63),                       // Sea Level: 63
  Buffer.from([0x00])                    // Enforces Secure Chat: false
]);

const pkt1 = make_packet(0x2C, play_login_payload);

// 2. Position (0x42)
const pos_payload = Buffer.concat([
  send_varint(1),
  Buffer.from([0x40, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // 8.0
  Buffer.from([0x40, 0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // 16.0
  Buffer.from([0x40, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // 8.0
  Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // dx, dy, dz (each 0.0 double)
  Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
  Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
  Buffer.from([0x00, 0x00, 0x00, 0x00]), // yaw
  Buffer.from([0x00, 0x00, 0x00, 0x00]), // pitch
  Buffer.from([0x00, 0x00, 0x00, 0x00])  // flags int32
]);

const pkt2 = make_packet(0x42, pos_payload);

// 3. Chunk (0x28)
// 24 sections
let chunk_sections = [];
for (let s = 0; s < 24; s++) {
  if (s === 4) {
    chunk_sections.push(Buffer.from([0x01, 0x00])); // non-air 256
    chunk_sections.push(Buffer.from([0x00])); // BPE 0
    chunk_sections.push(send_varint(9)); // grass
    chunk_sections.push(send_varint(0)); // data len 0
  } else {
    chunk_sections.push(Buffer.from([0x00, 0x00])); // non-air 0
    chunk_sections.push(Buffer.from([0x00])); // BPE 0
    chunk_sections.push(send_varint(0)); // air
    chunk_sections.push(send_varint(0)); // data len 0
  }
  // biomes
  chunk_sections.push(Buffer.from([0x00])); // BPE 0
  chunk_sections.push(send_varint(1)); // plains
  chunk_sections.push(send_varint(0)); // data len 0
}
const chunk_data_bytes = Buffer.concat(chunk_sections);

const chunk_payload = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // x=0, z=0
  Buffer.from([0x0A, 0x00]), // anonymous empty NBT
  send_varint(chunk_data_bytes.length),
  chunk_data_bytes,
  send_varint(0), // 0 block entities
  send_varint(0), // sky mask
  send_varint(0), // block mask
  send_varint(0), // empty sky mask
  send_varint(0), // empty block mask
  send_varint(0), // sky light updates
  send_varint(0)  // block light updates
]);

const pkt3 = make_packet(0x28, chunk_payload);

console.log('Testing full packet stream parsing:');
deserializer.on('data', (parsed) => {
  console.log('Successfully parsed packet:', parsed.data.name);
});
deserializer.on('error', (err) => {
  console.error('Deserializer error:', err);
});

deserializer.write(pkt1);
deserializer.write(pkt2);
deserializer.write(pkt3);
console.log('Stream test completed!');
