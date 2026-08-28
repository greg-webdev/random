const mc = require('minecraft-protocol');
const fs = require('fs');

console.log('Inspecting standard registries in 1.21.4:');
const mcData = require('minecraft-data')('1.21.4');
const serializer = mc.createSerializer({ isServer: true, version: '1.21.4', state: 'configuration' });

// In 1.21.4, if known_packs sends the matching client version (e.g. client's known pack),
// the client requires NO extra registry_data packets because it loads all of them from its local JAR!
// But why did client say: Missing registry: ResourceKey[minecraft:root / minecraft:dimension_type]?
// Because the client's known pack version string sent by 1.21.4 client was NOT "1.21.4", or because select_known_packs sent version "1.21.4" when client was 1.21.11, OR because the client expects the server to echo the EXACT client known packs list!
console.log('Done');
