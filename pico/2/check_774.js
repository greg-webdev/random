const versions = require('minecraft-data').versions.pc;
console.log('Searching for 774 in minecraft-data:');
for (const v of versions) {
  if (v.version === 774 || v.minecraftVersion.includes('1.21')) {
    console.log(v);
  }
}
