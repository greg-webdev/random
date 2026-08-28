const fs = require('fs');
const path = require('path');
const https = require('https');

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const request = (targetUrl) => {
            https.get(targetUrl, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    return request(response.headers.location);
                }
                if (response.statusCode !== 200) {
                    return reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => reject(err));
            });
        };
        request(url);
    });
}

async function setupFabric() {
    console.log('Fetching latest Fabric loader metadata for MC 1.21.11...');
    const metaUrl = 'https://meta.fabricmc.net/v2/versions/loader/1.21.11';
    
    https.get(metaUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
            try {
                const loaders = JSON.parse(data);
                let loaderVersion = '0.16.10';
                if (Array.isArray(loaders) && loaders.length > 0) {
                    loaderVersion = loaders[0]?.loader?.version || '0.16.10';
                }
                
                const installerVersion = '1.0.1';
                const downloadUrl = `https://meta.fabricmc.net/v2/versions/loader/1.21.11/${loaderVersion}/${installerVersion}/server/jar`;
                
                const targetPath = path.join(__dirname, 'fabric-server.jar');
                console.log(`Downloading Fabric Server JAR for MC 1.21.11 from: ${downloadUrl}`);
                await download(downloadUrl, targetPath);
                console.log(`Fabric server JAR for 1.21.11 successfully downloaded to ${targetPath}`);
                
                // Write initial eula.txt
                fs.writeFileSync(path.join(__dirname, 'eula.txt'), 'eula=true\n');
                console.log('eula.txt set to true.');

                // Write default server.properties
                const serverPropsPath = path.join(__dirname, 'server.properties');
                const defaultProps = [
                    '#Minecraft server properties',
                    'server-port=25565',
                    'gamemode=survival',
                    'difficulty=easy',
                    'max-players=20',
                    'online-mode=false',
                    'pvp=true',
                    'motd=Fabric 1.21.11 Minecraft Server',
                    'enable-command-block=true',
                    'allow-flight=true',
                    'view-distance=10',
                    'simulation-distance=10',
                    'spawn-protection=0',
                    'level-name=world'
                ].join('\n');
                fs.writeFileSync(serverPropsPath, defaultProps);
                console.log('server.properties set for 1.21.11.');
            } catch (e) {
                console.error('Error during setup:', e);
            }
        });
    });
}

setupFabric();
