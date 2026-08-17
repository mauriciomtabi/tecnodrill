const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.icon192) {
          const buf192 = Buffer.from(data.icon192.replace(/^data:image\/png;base64,/, ''), 'base64');
          fs.writeFileSync(path.join(__dirname, '../public/icon-192.png'), buf192);
          console.log('Saved icon-192.png, size:', buf192.length);
        }
        if (data.icon512) {
          const buf512 = Buffer.from(data.icon512.replace(/^data:image\/png;base64,/, ''), 'base64');
          fs.writeFileSync(path.join(__dirname, '../public/icon-512.png'), buf512);
          console.log('Saved icon-512.png, size:', buf512.length);
        }
        if (data.favicon) {
          const bufFav = Buffer.from(data.favicon.replace(/^data:image\/png;base64,/, ''), 'base64');
          fs.writeFileSync(path.join(__dirname, '../public/favicon.png'), bufFav);
          console.log('Saved favicon.png, size:', bufFav.length);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        setTimeout(() => process.exit(0), 500);
      } catch (err) {
        res.writeHead(500);
        res.end(err.message);
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(4899, () => {
  console.log('Icon receiver listening on 4899');
});
