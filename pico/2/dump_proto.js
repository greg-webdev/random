const mcData = require('minecraft-data')('1.21.1');
const fs = require('fs');

const dump = {
  login: mcData.protocol.play.toClient.types.packet_login,
  position: mcData.protocol.play.toClient.types.packet_position,
  level_chunk_with_light: mcData.protocol.play.toClient.types.packet_level_chunk_with_light,
  chunk_section: mcData.protocol.play.toClient.types.chunk_section,
  packet_map: mcData.protocol.play.toClient.types['packet_map']
};

fs.writeFileSync('protocol_dump.json', JSON.stringify(dump, null, 2));
console.log('Saved protocol_dump.json successfully!');
