const mineflayer = require('mineflayer');
const EventEmitter = require('events');

class HeadlessWorldBot extends EventEmitter {
    constructor(host = 'localhost', port = 25565, username = 'WebMapBot') {
        super();
        this.host = host;
        this.port = port;
        this.username = username;
        this.bot = null;
        this.voxelsMap = new Map(); // key "x,y,z" -> type
        this.playerPos = { x: 0, y: 70, z: 0 };
        this.connected = false;
    }

    start() {
        console.log(`[HeadlessBot] Connecting to ${this.host}:${this.port} as ${this.username}...`);
        
        try {
            this.bot = mineflayer.createBot({
                host: this.host,
                port: this.port,
                username: this.username,
                version: '1.21.1', // mineflayer 1.21.x protocol handler
                checkTimeoutInterval: 30000
            });
        } catch (err) {
            console.error('[HeadlessBot Error]', err.message);
            return;
        }

        this.bot.on('login', () => {
            console.log('[HeadlessBot] Logged into server successfully!');
            this.connected = true;
            this.emit('connected');
        });

        // Track bot position in real-time
        this.bot.on('move', () => {
            if (this.bot && this.bot.entity) {
                const pos = this.bot.entity.position;
                this.playerPos = {
                    x: Math.round(pos.x * 10) / 10,
                    y: Math.round(pos.y * 10) / 10,
                    z: Math.round(pos.z * 10) / 10
                };
            }
        });

        // High speed chunk block inspector
        this.bot.on('chunkColumnLoad', (chunkPoint) => {
            this.scanLoadedChunk(chunkPoint.x, chunkPoint.z);
        });

        this.bot.on('blockUpdate', (oldBlock, newBlock) => {
            if (newBlock) {
                const p = newBlock.position;
                const key = `${p.x},${p.y},${p.z}`;
                if (newBlock.name === 'air' || newBlock.name === 'cave_air' || newBlock.name === 'void_air') {
                    this.voxelsMap.delete(key);
                } else {
                    this.voxelsMap.set(key, { x: p.x, y: p.y, z: p.z, type: newBlock.name });
                }
            }
        });

        this.bot.on('end', (reason) => {
            console.log('[HeadlessBot] Disconnected:', reason);
            this.connected = false;
            // Auto reconnect after 5 seconds
            setTimeout(() => this.start(), 5000);
        });

        this.bot.on('error', (err) => {
            console.error('[HeadlessBot Error]', err.message);
        });
    }

    scanLoadedChunk(chunkX, chunkZ) {
        if (!this.bot || !this.bot.world) return;

        const startX = chunkX * 16;
        const startZ = chunkZ * 16;

        for (let bx = 0; bx < 16; bx++) {
            for (let bz = 0; bz < 16; bz++) {
                const wx = startX + bx;
                const wz = startZ + bz;

                // Fast top-down surface scan
                let surfaceY = -64;
                for (let y = 140; y >= -64; y--) {
                    const block = this.bot.blockAt({ x: wx, y: y, z: wz });
                    if (block && block.name && block.name !== 'air' && block.name !== 'cave_air' && block.name !== 'void_air') {
                        surfaceY = y;
                        this.voxelsMap.set(`${wx},${y},${wz}`, {
                            x: wx,
                            y: y,
                            z: wz,
                            type: block.name
                        });
                        break;
                    }
                }
            }
        }
    }

    getVoxelsArray() {
        return Array.from(this.voxelsMap.values());
    }
}

module.exports = HeadlessWorldBot;
