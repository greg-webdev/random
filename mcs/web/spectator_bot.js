const mineflayer = require('mineflayer');
const mineflayerViewer = require('prismarine-viewer/lib/mineflayer');

class CameraSpectatorBot {
    constructor(serverHost = 'localhost', serverPort = 25565, botName = 'WebSpectatorBot') {
        this.host = serverHost;
        this.port = serverPort;
        this.username = botName;
        this.bot = null;
        this.connected = false;
        this.targetPlayer = null;
        this.mcWriter = null;
        this.position = { x: 0, y: 70, z: 0, yaw: 0, pitch: 0 };
    }

    start(mcProcessWriter, expressApp = null, httpServer = null) {
        this.mcWriter = mcProcessWriter;
        if (expressApp) this.expressApp = expressApp;
        if (httpServer) this.httpServer = httpServer;
        if (this.bot) return;


        console.log(`[SpectatorBot] Connecting ${this.username} to ${this.host}:${this.port} (MC 1.21.11)...`);

        try {
            this.bot = mineflayer.createBot({
                host: this.host,
                port: this.port,
                username: this.username,
                version: '1.21.11'
            });

            this.bot.on('login', () => {
                console.log(`[SpectatorBot] ${this.username} logged in successfully!`);
                this.connected = true;

                // Automatically grant operator & enter spectator mode
                if (this.mcWriter) {
                    this.mcWriter(`op ${this.username}\n`);
                    setTimeout(() => {
                        if (this.mcWriter) this.mcWriter(`gamemode spectator ${this.username}\n`);
                    }, 500);
                }
            });

            this.bot.on('spawn', () => {
                this.connected = true;
                if (!this.viewerStarted) {
                    try {
                        const mineflayerViewer = require('prismarine-viewer/lib/mineflayer');
                        mineflayerViewer(this.bot, { port: 3001, firstPerson: true, viewDistance: 8 });
                        this.viewerStarted = true;
                        console.log(`[SpectatorBot] 3D World Prismarine Viewport running on http://localhost:3001`);
                    } catch (e) {
                        console.error('[SpectatorBot Viewer Error]', e.message);
                    }
                }

                if (this.targetPlayer) {
                    this.spectate(this.targetPlayer);
                }
            });



            this.bot.on('move', () => {
                if (this.bot && this.bot.entity) {
                    const pos = this.bot.entity.position;
                    this.position = {
                        x: pos.x,
                        y: pos.y,
                        z: pos.z,
                        yaw: this.bot.entity.yaw,
                        pitch: this.bot.entity.pitch
                    };
                }
            });

            this.bot.on('end', (reason) => {
                console.log(`[SpectatorBot] Disconnected (${reason}). Reconnecting in 3s...`);
                this.connected = false;
                this.bot = null;
                setTimeout(() => {
                    if (this.mcWriter) this.start(this.mcWriter);
                }, 3000);
            });

            this.bot.on('error', (err) => {
                console.error(`[SpectatorBot Error]`, err.message);
            });

        } catch (err) {
            console.error('[SpectatorBot Launch Error]', err.message);
        }
    }

    getNearbyPOVBlocks(radius = 8) {
        if (!this.bot || !this.bot.entity) return [];
        const pos = this.bot.entity.position;
        const blocks = [];

        const bx = Math.floor(pos.x);
        const by = Math.floor(pos.y);
        const bz = Math.floor(pos.z);

        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    const b = this.bot.blockAt(pos.offset(dx, dy, dz));
                    if (b && b.name !== 'air' && b.name !== 'cave_air' && b.name !== 'void_air') {
                        blocks.push({
                            x: bx + dx,
                            y: by + dy,
                            z: bz + dz,
                            type: b.name
                        });
                    }
                }
            }
        }
        return blocks;
    }

    spectate(playerName) {
        this.targetPlayer = playerName;
        console.log(`[SpectatorBot] Locking spectator view onto target player: ${playerName}`);

        if (this.tpTimer) clearInterval(this.tpTimer);

        const executeTeleportLock = () => {
            if (!this.targetPlayer) return;
            if (this.bot && this.bot.entity) {
                const targetEntity = this.bot.players[this.targetPlayer]?.entity;
                if (targetEntity && targetEntity.position) {
                    // Lock bot position & head rotation directly onto player head
                    this.bot.entity.position.x = targetEntity.position.x;
                    this.bot.entity.position.y = targetEntity.position.y;
                    this.bot.entity.position.z = targetEntity.position.z;
                    this.bot.entity.yaw = targetEntity.yaw;
                    this.bot.entity.pitch = targetEntity.pitch;

                    // Enable flying to prevent falling when target player jumps/flies
                    if (this.bot.creative) {
                        this.bot.creative.startFlying();
                    }
                }
            }
        };

        // Initial setup commands executed once
        if (this.mcWriter) {
            this.mcWriter(`op ${this.username}\n`);
            this.mcWriter(`gamemode spectator ${this.username}\n`);
            this.mcWriter(`tp ${this.username} ${playerName}\n`);
            this.mcWriter(`spectate ${playerName} ${this.username}\n`);
        }

        executeTeleportLock();
        // High-speed 0.2s (200ms) internal position lock loop
        this.tpTimer = setInterval(executeTeleportLock, 200);
    }


    stopSpectating() {
        if (this.tpTimer) {
            clearInterval(this.tpTimer);
            this.tpTimer = null;
        }
        this.targetPlayer = null;
        if (this.mcWriter) {
            this.mcWriter(`spectate clear ${this.username}\n`);
        }
        if (this.bot && this.bot.entity) {
            this.bot.chat(`/spectate clear ${this.username}`);
        }
    }

}

module.exports = CameraSpectatorBot;
