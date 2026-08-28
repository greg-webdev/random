const mcData = require('minecraft-data')('1.21.4');
const fs = require('fs');

console.log('1.21.4 packet_login:', JSON.stringify(mcData.protocol.play.toClient.types.packet_login, null, 2));
console.log('1.21.4 SpawnInfo:', JSON.stringify(mcData.protocol.play.toClient.types.SpawnInfo, null, 2));
console.log('1.21.4 packet_position:', JSON.stringify(mcData.protocol.play.toClient.types.packet_position, null, 2));
console.log('1.21.4 packet_map_chunk:', JSON.stringify(mcData.protocol.play.toClient.types.packet_map_chunk, null, 2));
