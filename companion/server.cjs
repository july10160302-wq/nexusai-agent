// A small, authenticated workspace MCP service. No arbitrary shell or OS control.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');

const tools = [
  { name: 'workspace_list', description: 'List files in the connected computer workspace.', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
  { name: 'workspace_read', description: 'Read a UTF-8 file in the connected computer workspace.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'workspace_write', description: 'Write a UTF-8 file. Read first and supply its SHA256 as expectedHash; use "new" for a new file. Requires user approval.', inputSchema: { type: 'object', required: ['path', 'content', 'expectedHash'], properties: { path: { type: 'string' }, content: { type: 'string' }, expectedHash: { type: 'string' } } } },
];

async function startCompanion({ workspace, host = '127.0.0.1', port = 8723, token = crypto.randomBytes(32).toString('hex') }) {
  const root = await fs.realpath(path.resolve(workspace));
  if (!(await fs.stat(root)).isDirectory()) throw new Error('Workspace must be a directory');
  const inside = p => { const rel = path.relative(root, p); return !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep); };
  async function safePath(relative = '.', creating = false) {
    if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes(':') || relative.includes('\0')) throw new Error('Invalid workspace path');
    const candidate = path.resolve(root, relative);
    if (!inside(candidate)) throw new Error('Path outside workspace');
    // Resolve real paths as well to reject junction/symlink escapes.
    let real;
    try { real = await fs.realpath(candidate); }
    catch (e) {
      if (!creating || e.code !== 'ENOENT') throw e;
      real = path.join(await fs.realpath(path.dirname(candidate)), path.basename(candidate));
    }
    if (!inside(real)) throw new Error('Symlink outside workspace');
    return real;
  }
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  let writeQueue = Promise.resolve();
  async function execute(name, args) {
    const target = await safePath(args.path, name === 'workspace_write');
    if (name === 'workspace_list') return (await fs.readdir(target, { withFileTypes: true })).slice(0, 1000).map(e => ({ name: e.name, type: e.isDirectory() ? 'directory' : e.isSymbolicLink() ? 'symlink' : 'file' }));
    if (name === 'workspace_read') {
      if ((await fs.stat(target)).size > 1024 * 1024) throw new Error('File exceeds 1 MB');
      const bytes = await fs.readFile(target);
      return { path: args.path, content: bytes.toString('utf8'), sha256: hash(bytes) };
    }
    if (name === 'workspace_write') {
      if (typeof args.content !== 'string' || Buffer.byteLength(args.content) > 1024 * 1024) throw new Error('Content must be UTF-8 text under 1 MB');
      const write = async () => {
        const fresh = await safePath(args.path, true);
        let old = null;
        try { old = await fs.readFile(fresh); } catch(e) { if(e.code !== 'ENOENT') throw e; }
        if ((old === null ? 'new' : hash(old)) !== args.expectedHash) throw new Error('File changed. Read it again and request approval with the current hash.');
        await fs.writeFile(fresh, args.content, { flag: old === null ? 'wx' : 'w' });
        return { path: args.path, sha256: hash(args.content), written: true };
      };
      const result = writeQueue.then(write);
      writeQueue = result.catch(() => undefined);
      return result;
    }
    throw new Error('Unknown tool');
  }
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id, mcp-protocol-version');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const supplied = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from('Bearer ' + token);
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) { res.writeHead(401); return res.end('Unauthorized'); }
    if (req.method !== 'POST' || req.url !== '/mcp') { res.writeHead(404); return res.end(); }
    let id = null;
    try {
      let size = 0, chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) throw new Error('Request too large');
        chunks.push(chunk);
      }
      const message = JSON.parse(Buffer.concat(chunks).toString());
      id = message.id;
      if (message.method === 'notifications/initialized') { res.writeHead(202); return res.end(); }
      let result;
      if (message.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'NexusAI Desktop', version: '0.2.0' } };
      else if (message.method === 'tools/list') result = { tools };
      else if (message.method === 'tools/call') {
        const value = await execute(message.params?.name, message.params?.arguments || {});
        result = { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
      } else throw new Error('Unsupported method');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id, result }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message: e.message } }));
    }
  });
  server.requestTimeout = 30000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  const boundPort = server.address().port;
  const addresses = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => `http://${a.address}:${boundPort}/mcp`);
  return { server, token, workspace: root, url: `http://127.0.0.1:${boundPort}/mcp`, addresses: host === '127.0.0.1' ? [] : addresses };
}
module.exports = { startCompanion };
if (require.main === module) {
  const args = process.argv.slice(2);
  const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
  startCompanion({ workspace: option('--workspace', process.cwd()), host: option('--host', '127.0.0.1'), port: Number(option('--port', '8723')) })
    .then(({ server: _, ...info }) => console.log(JSON.stringify(info, null, 2)))
    .catch(e => { console.error(e.message); process.exitCode = 1; });
}
