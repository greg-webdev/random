const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

// Ensure output dirs exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Copy webview static assets
function copyWebviewAssets() {
  const webviewSrc = path.join(__dirname, 'src', 'webview');
  const webviewDist = path.join(__dirname, 'dist', 'webview');
  if (!fs.existsSync(webviewDist)) {
    fs.mkdirSync(webviewDist, { recursive: true });
  }
  const files = ['index.html', 'main.css', 'main.js'];
  for (const file of files) {
    const src = path.join(webviewSrc, file);
    const dest = path.join(webviewDist, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }
  console.log('[Assets] Copied webview assets to dist/webview');
}

async function main() {
  copyWebviewAssets();

  const extensionConfig = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: isProduction,
    sourcemap: !isProduction,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'info',
  };

  const mcpConfig = {
    entryPoints: ['src/mcp/mcpServer.ts'],
    bundle: true,
    format: 'cjs',
    minify: isProduction,
    sourcemap: !isProduction,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/mcpServer.js',
    logLevel: 'info',
  };

  if (isWatch) {
    const ctxExt = await esbuild.context(extensionConfig);
    const ctxMcp = await esbuild.context(mcpConfig);
    await Promise.all([ctxExt.watch(), ctxMcp.watch()]);
    console.log('[esbuild] Watching for changes...');
  } else {
    await Promise.all([
      esbuild.build(extensionConfig),
      esbuild.build(mcpConfig),
    ]);
    console.log('[esbuild] Build complete.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
