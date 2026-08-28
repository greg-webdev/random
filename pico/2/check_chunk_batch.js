const mcData = require('minecraft-data')('1.21.4');
const mappings = mcData.protocol.play.toClient.types.packet[1][0].type[1].mappings;
console.log('Chunk related packets in 1.21.4:');
for (const [hex, name] of Object.entries(mappings)) {
  if (name.includes('chunk') || name.includes('waiting') || name.includes('game_state')) {
    console.log(`${hex} -> ${name}`);
  }
}
