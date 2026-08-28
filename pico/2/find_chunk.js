const mcData = require('minecraft-data')('1.21.1');
const fs = require('fs');

console.log('Searching for chunk packets in 1.21.1:');
for (const [key, val] of Object.entries(mcData.protocol.play.toClient.types)) {
  if (key.toLowerCase().includes('chunk') || key.toLowerCase().includes('light')) {
    console.log(key, ':', JSON.stringify(val));
  }
}
