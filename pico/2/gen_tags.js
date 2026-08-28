const mc = require('minecraft-protocol');
const fs = require('fs');

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

const s = mc.createSerializer({isServer: true, version: '1.21.4', state: 'configuration'});

const tagsPayload = [
  {
    tagType: 'minecraft:dialog',
    tags: [
      { tagName: 'minecraft:pause_screen_additions', entries: [] },
      { tagName: 'minecraft:quick_actions', entries: [] }
    ]
  },
  {
    tagType: 'minecraft:enchantment',
    tags: [
      { tagName: 'minecraft:exclusive_set/armor', entries: [] },
      { tagName: 'minecraft:exclusive_set/boots', entries: [] },
      { tagName: 'minecraft:exclusive_set/bow', entries: [] },
      { tagName: 'minecraft:exclusive_set/crossbow', entries: [] },
      { tagName: 'minecraft:exclusive_set/damage', entries: [] },
      { tagName: 'minecraft:exclusive_set/mining', entries: [] },
      { tagName: 'minecraft:exclusive_set/riptide', entries: [] }
    ]
  },
  {
    tagType: 'minecraft:timeline',
    tags: [
      { tagName: 'minecraft:in_end', entries: [] },
      { tagName: 'minecraft:in_nether', entries: [] },
      { tagName: 'minecraft:in_overworld', entries: [] }
    ]
  }
];

try {
  const payload = s.createPacketBuffer({
    name: 'tags',
    params: { tags: tagsPayload }
  });
  
  // payload already contains Packet ID for 'tags' (which is 0x0D in 1.21.4/11)
  const packetLen = payload.length;
  const packetLenBuf = encodeVarint(packetLen);
  
  const finalBuf = Buffer.concat([packetLenBuf, payload]);
  fs.writeFileSync('tags.bin', finalBuf);
  console.log('Successfully wrote tags.bin:', finalBuf.length, 'bytes');
} catch(e) {
  console.error('Failed to serialize tags:', e);
}
