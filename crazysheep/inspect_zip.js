const https = require('https');
const fs = require('fs');

const url = 'https://github.com/godotengine/godot/releases/download/4.4-stable/Godot_v4.4-stable_export_templates.tpz';

function getRedirect(url, cb) {
  https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      getRedirect(res.headers.location, cb);
    } else {
      cb(res);
    }
  });
}

getRedirect(url, (res) => {
  const totalLength = parseInt(res.headers['content-length'], 10);
  console.log('Total file length:', totalLength);

  // Read last 256KB to find ZIP central directory
  const tailSize = 256 * 1024;
  const start = totalLength - tailSize;

  const req = https.get(res.responseUrl || url, {
    headers: { 'Range': `bytes=${start}-${totalLength - 1}` }
  }, (rangeRes) => {
    const chunks = [];
    rangeRes.on('data', c => chunks.push(c));
    rangeRes.on('end', () => {
      const buf = Buffer.concat(chunks);
      console.log('Received tail bytes:', buf.length);

      // Search for "templates/web"
      let idx = 0;
      while ((idx = buf.indexOf(Buffer.from('templates/web'), idx)) !== -1) {
        // Read file name length and name
        const nameEnd = buf.indexOf(0, idx);
        const name = buf.slice(idx, idx + 40).toString('utf8');
        console.log('Found entry around', idx, ':', name);
        idx += 13;
      }
    });
  });
});
