const mcData = require('minecraft-data')('1.21.1');
if (!mcData) {
  console.log('Available versions:', Object.keys(require('minecraft-data').versions.pc).slice(-15));
} else {
  console.log('Play packets:');
  const playPackets = mcData.protocol.play.toClient.types;
  console.log('Packet mappings:');
  for (const [key, val] of Object.entries(mcData.protocol.play.toClient.types)) {
    if (key.includes('packet_login') || key.includes('packet_level_chunk') || key.includes('packet_position') || key.includes('packet_keep_alive')) {
      console.log(key, '->', JSON.stringify(val).slice(0, 100));
    }
  }
}
