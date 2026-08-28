const mcData = require('minecraft-data')('1.21.4');
const mappings = mcData.protocol.play.toClient.types.packet[1][0].type[1].mappings;
console.log('Play toClient mappings in 1.21.4:');
for (const [hex, name] of Object.entries(mappings)) {
  if (['login', 'position', 'map_chunk', 'keep_alive', 'game_state_change'].includes(name)) {
    console.log(`${hex} -> ${name}`);
  }
}
