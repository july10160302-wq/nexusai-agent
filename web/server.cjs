const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

async function startWebServer({ root = path.join(__dirname, '..', 'dist'), port = 17100 } = {}) {
  const base = await fs.realpath(root);
  await fs.access(path.join(base, 'index.html'));
  const server = http.createServer(async (req, res) => {
    const respond = (status, body) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(body); };
    if (!['GET', 'HEAD'].includes(req.method)) return respond(405, 'Method not allowed');
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const requested = path.resolve(base, '.' + (pathname === '/' ? '/index.html' : pathname));
      const file = await fs.realpath(requested);
      const relative = path.relative(base, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return respond(403, 'Forbidden');
      if (!(await fs.stat(file)).isFile()) return respond(404, 'Not found');
      const bytes = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Length': bytes.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      respond(error instanceof URIError ? 400 : 404, 'Not found');
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, url: `http://localhost:${server.address().port}/` };
}

module.exports = { startWebServer };
if (require.main === module) {
  startWebServer().then(({ url }) => console.log(`NexusAI: ${url}\nKeep this terminal open. Press Ctrl+C to stop.`)).catch(error => { console.error(`Cannot start NexusAI: ${error.message}`); process.exitCode = 1; });
}
