const fs = require('fs');
const bin = fs.readFileSync('registries.bin');
const hex = bin.toString('hex');

let py = `# Run this script once in Thonny on the Pico W to write clean registries.bin!
import binascii
import gc

print("Installing clean 1.21.11 registries.bin onto Pico W...")
chunks = [
`;

const chunkSize = 2048;
for (let i = 0; i < hex.length; i += chunkSize) {
  py += `    "${hex.slice(i, i + chunkSize)}",\n`;
}

py += `]

with open("registries.bin", "wb") as f:
    for c in chunks:
        f.write(binascii.unhexlify(c))
        gc.collect()

import os
st = os.stat("registries.bin")
print("SUCCESS! registries.bin written to Pico W flash! Size:", st[6], "bytes")
`;

fs.writeFileSync('install_registries.py', py);
console.log('Successfully generated install_registries.py:', py.length, 'bytes');
