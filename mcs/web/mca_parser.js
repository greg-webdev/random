const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const nbt = require('prismarine-nbt');

const TRANSPARENT_BLOCKS = new Set([
    'water', 'seagrass', 'tall_seagrass', 'kelp', 'kelp_plant',
    'bubble_column', 'glass', 'glass_pane', 'oak_leaves', 'birch_leaves',
    'spruce_leaves', 'jungle_leaves', 'acacia_leaves', 'dark_oak_leaves',
    'mangrove_leaves', 'cherry_leaves', 'azalea_leaves', 'leaves'
]);

async function parseMCAFile(filePath) {
    const data = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const match = fileName.match(/^r\.(-?\d+)\.(-?\d+)\.mca$/);
    if (!match) return [];

    const regX = parseInt(match[1]);
    const regZ = parseInt(match[2]);

    const voxels = [];

    // Region contains 32x32 chunks
    for (let cz = 0; cz < 32; cz++) {
        for (let cx = 0; cx < 32; cx++) {
            const chunkOffsetIndex = (cx + cz * 32) * 4;

            const offsetVal = data.readUInt32BE(chunkOffsetIndex);
            if (offsetVal === 0) continue;

            const sectorOffset = (offsetVal >> 8) * 4096;
            const length = data.readUInt32BE(sectorOffset);
            if (length === 0 || sectorOffset >= data.length) continue;

            const compressionType = data.readUInt8(sectorOffset + 4);
            const chunkData = data.slice(sectorOffset + 5, sectorOffset + 4 + length);

            let decompressed;
            try {
                if (compressionType === 2) decompressed = zlib.inflateSync(chunkData);
                else if (compressionType === 1) decompressed = zlib.gunzipSync(chunkData);
                else continue;
            } catch (e) {
                continue;
            }

            try {
                const parsed = await nbt.parse(decompressed);
                const value = nbt.simplify(parsed.parsed);

                // Exact chunk world coordinates from NBT
                const chunkX = value.xPos !== undefined ? value.xPos : (regX * 32 + cx);
                const chunkZ = value.zPos !== undefined ? value.zPos : (regZ * 32 + cz);

                const sections = value.sections || [];
                const columnWater = {}; // key "bx,bz" -> top water block
                const columnSolid = {}; // key "bx,bz" -> top solid ground block

                for (const section of sections) {
                    const secY = section.Y;
                    if (secY === undefined) continue;

                    const blockStates = section.block_states;
                    if (!blockStates || !blockStates.palette || blockStates.palette.length === 0) continue;

                    const palette = blockStates.palette.map(entry => {
                        const name = entry.Name || 'minecraft:air';
                        return name.replace('minecraft:', '');
                    });

                    if (palette.length === 1 && palette[0] === 'air') continue;

                    const dataArray = blockStates.data;
                    const worldYBase = secY * 16;
                    const bitsPerEntry = Math.max(4, Math.ceil(Math.log2(palette.length)));

                    for (let yRel = 0; yRel < 16; yRel++) {
                        for (let zRel = 0; zRel < 16; zRel++) {
                            for (let xRel = 0; xRel < 16; xRel++) {
                                const blockIdx = (yRel * 256) + (zRel * 16) + xRel;
                                let blockType = 'air';

                                if (!dataArray || dataArray.length === 0) {
                                    blockType = palette[0] || 'air';
                                } else {
                                    const entriesPerLong = Math.floor(64 / bitsPerEntry);
                                    const mask = (1 << bitsPerEntry) - 1;

                                    const longIdx = Math.floor(blockIdx / entriesPerLong);
                                    const bitOffset = (blockIdx % entriesPerLong) * bitsPerEntry;

                                    if (longIdx < dataArray.length) {
                                        const longVal = dataArray[longIdx];
                                        let paletteIdx = 0;
                                        if (typeof longVal === 'bigint') {
                                            paletteIdx = Number((longVal >> BigInt(bitOffset)) & BigInt(mask));
                                        } else if (Array.isArray(longVal)) {
                                            paletteIdx = (longVal[1] >>> bitOffset) & mask;
                                        } else {
                                            paletteIdx = (longVal >> bitOffset) & mask;
                                        }
                                        blockType = palette[paletteIdx] || 'air';
                                    }
                                }

                                if (blockType !== 'air' && blockType !== 'cave_air' && blockType !== 'void_air') {
                                    const worldY = worldYBase + yRel;
                                    const key = `${xRel},${zRel}`;

                                    if (blockType === 'water') {
                                        if (!columnWater[key] || worldY > columnWater[key].y) {
                                            columnWater[key] = { y: worldY, type: blockType };
                                        }
                                    } else if (!TRANSPARENT_BLOCKS.has(blockType)) {
                                        if (!columnSolid[key] || worldY > columnSolid[key].y) {
                                            columnSolid[key] = { y: worldY, type: blockType };
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Push solid ground voxels (sandbed, dirt, stone, grass)
                for (const [key, top] of Object.entries(columnSolid)) {
                    const [bxStr, bzStr] = key.split(',');
                    const bx = parseInt(bxStr);
                    const bz = parseInt(bzStr);
                    voxels.push({
                        x: chunkX * 16 + bx,
                        y: top.y,
                        z: chunkZ * 16 + bz,
                        type: top.type
                    });
                }

                // Push ocean surface water voxels only where water sits above solid ground
                for (const [key, wTop] of Object.entries(columnWater)) {
                    const [bxStr, bzStr] = key.split(',');
                    const bx = parseInt(bxStr);
                    const bz = parseInt(bzStr);
                    const sTop = columnSolid[key];
                    if (!sTop || wTop.y >= sTop.y) {
                        voxels.push({
                            x: chunkX * 16 + bx,
                            y: wTop.y,
                            z: chunkZ * 16 + bz,
                            type: 'water'
                        });
                    }
                }

            } catch (err) {
                // Ignore bad chunk
            }
        }
    }

    return voxels;
}

module.exports = { parseMCAFile };
