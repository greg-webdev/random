const mcData = require('minecraft-data')('1.21.4');

console.log('Configuration toClient packets in 1.21.4:');
for (const [k, v] of Object.entries(mcData.protocol.configuration.toClient.types)) {
  console.log(k, ':', JSON.stringify(v));
}

console.log('Configuration toServer packets in 1.21.4:');
for (const [k, v] of Object.entries(mcData.protocol.configuration.toServer.types)) {
  console.log(k, ':', JSON.stringify(v));
}
