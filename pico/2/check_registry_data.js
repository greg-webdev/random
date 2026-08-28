const mc = require('minecraft-protocol');
const serializer = mc.createSerializer({ isServer: true, version: '1.21.4', state: 'configuration' });

const knownPacksBuf = serializer.createPacketBuffer({
  name: 'select_known_packs',
  params: {
    packs: [
      {
        namespace: 'minecraft',
        id: 'core',
        version: '1.21.4'
      }
    ]
  }
});
console.log('select_known_packs (0x0e) bytes (hex):', knownPacksBuf.toString('hex'));

const registryBuf = serializer.createPacketBuffer({
  name: 'registry_data',
  params: {
    id: 'minecraft:dimension_type',
    entries: [
      {
        key: 'minecraft:overworld',
        value: {
          type: 'compound',
          name: '',
          value: {
            piglin_safe: { type: 'byte', value: 0 },
            has_raids: { type: 'byte', value: 1 },
            monster_spawn_light_level: { type: 'int', value: 0 },
            monster_spawn_block_light_limit: { type: 'int', value: 0 },
            natural: { type: 'byte', value: 1 },
            ambient_light: { type: 'float', value: 0.0 },
            infiniburn: { type: 'string', value: '#minecraft:infiniburn_overworld' },
            respawn_anchor_works: { type: 'byte', value: 0 },
            has_skylight: { type: 'byte', value: 1 },
            bed_works: { type: 'byte', value: 1 },
            effects: { type: 'string', value: 'minecraft:overworld' },
            min_y: { type: 'int', value: -64 },
            height: { type: 'int', value: 384 },
            logical_height: { type: 'int', value: 384 },
            coordinate_scale: { type: 'double', value: 1.0 },
            ultrawarm: { type: 'byte', value: 0 },
            has_ceiling: { type: 'byte', value: 0 }
          }
        }
      }
    ]
  }
});
console.log('registry_data (0x07) bytes (hex):', registryBuf.toString('hex'));
