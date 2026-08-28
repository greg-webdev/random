const mcData = require('minecraft-data')('1.21.1');
const fs = require('fs');

console.log('level_chunk_with_light:');
console.log(JSON.stringify(mcData.protocol.play.toClient.types.packet_level_chunk_with_light, null, 2));

console.log('SpawnInfo:');
console.log(JSON.stringify(mcData.protocol.play.toClient.types.SpawnInfo, null, 2));

console.log('LightData:');
console.log(JSON.stringify(mcData.protocol.play.toClient.types.light_data, null, 2));
