const mc = require('minecraft-protocol');
const fs = require('fs');

const registries = [
  "minecraft:worldgen/biome",
  "minecraft:chat_type",
  "minecraft:trim_pattern",
  "minecraft:trim_material",
  "minecraft:wolf_variant",
  "minecraft:painting_variant",
  "minecraft:dimension_type",
  "minecraft:damage_type",
  "minecraft:banner_pattern",
  "minecraft:enchantment",
  "minecraft:jukebox_song",
  "minecraft:instrument"
];

const s = mc.createSerializer({isServer: true, version: '1.21.4', state: 'configuration'});

let out = 'reg_payloads = (\n';
for (const id of registries) {
  const buf = s.createPacketBuffer({
    name: 'registry_data',
    params: {
      id: id,
      entries: []
    }
  });
  out += `    make_packet(0x07, bytes.fromhex("${buf.toString('hex')}")) +\n`;
}
out += '    b""\n)\n';

fs.writeFileSync('empty_regs.py', out);
console.log('Done');
