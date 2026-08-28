if (!process.argv[1]) {
    process.argv[1] = __filename;
}

const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const USER_DOCUMENTS = path.join(os.homedir(), 'Documents');
const TARGET_DIR = path.join(USER_DOCUMENTS, 'mcserver');

async function main() {
    console.log(`==================================================`);
    console.log(`🚀 Minecraft Server Control Panel Installer & Launcher`);
    console.log(`==================================================\n`);

    const serverExists = fs.existsSync(TARGET_DIR) && fs.existsSync(path.join(TARGET_DIR, 'fabric-server.jar'));

    if (serverExists) {
        console.log(`[Info] Minecraft Server already exists at:\n       ${TARGET_DIR}\n`);
        console.log(`[Launch] Server is installed. Launching control panel...\n`);
    } else {
        console.log(`[Setup] Server not found in ${TARGET_DIR}.\n`);

        if (fs.existsSync(TARGET_DIR)) {
            console.log(`[Clean] Cleaning target directory (preserving 'mods' folder)...`);
            const items = fs.readdirSync(TARGET_DIR);
            for (const item of items) {
                if (item.toLowerCase() === 'mods') {
                    console.log(`       Preserving 'mods' folder.`);
                    continue;
                }
                const itemPath = path.join(TARGET_DIR, item);
                try {
                    fs.removeSync(itemPath);
                    console.log(`       Removed: ${item}`);
                } catch (err) {
                    console.error(`       Failed to remove ${item}:`, err.message);
                }
            }
        }

        console.log(`\n[Unpack] Extracting Minecraft Server files to:\n         ${TARGET_DIR}...`);
        fs.ensureDirSync(TARGET_DIR);

        const templateDir = path.join(__dirname, 'server_template');
        if (fs.existsSync(templateDir)) {
            fs.copySync(templateDir, TARGET_DIR, {
                filter: (src) => path.basename(src).toLowerCase() !== 'mods'
            });
        }

        // Ensure mods directory exists separately
        const modsDir = path.join(TARGET_DIR, 'mods');
        fs.ensureDirSync(modsDir);

        console.log(`[Success] Unpacked server files to ${TARGET_DIR}!`);
        console.log(`[Info] 'mods' directory ready at: ${modsDir}\n`);
    }

    process.env.MCS_DIR = TARGET_DIR;

    console.log(`==================================================`);
    console.log(`🚀 Starting Control Panel Web UI...`);
    console.log(`🌐 Open in browser: http://localhost:3000`);
    console.log(`==================================================\n`);

    // Require server.js directly within current process
    require('./server.js');

    // Auto-open browser control panel
    setTimeout(() => {
        const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
        spawn(startCmd, ['http://localhost:3000'], { shell: true });
    }, 1200);
}

main();
