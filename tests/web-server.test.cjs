const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { startWebServer } = require('../web/server.cjs');

test('browser server serves built assets and confines access to its web folder', async () => {
  const root = await fs.mkdtemp(path.join(__dirname, '..', '.nexus-test-web-'));
  let service;
  try {
    await fs.mkdir(path.join(root, 'dist'));
    await fs.writeFile(path.join(root, 'dist', 'index.html'), '<h1>NexusAI</h1>');
    await fs.writeFile(path.join(root, 'dist', 'app.js'), 'console.log("ready")');
    await fs.writeFile(path.join(root, 'private.txt'), 'not a web asset');
    service = await startWebServer({ root: path.join(root, 'dist'), port: 0 });
    const index = await fetch(service.url);
    assert.equal(index.status, 200);
    assert.match(index.headers.get('content-type'), /text\/html/);
    assert.equal(await index.text(), '<h1>NexusAI</h1>');
    const js = await fetch(service.url + 'app.js', { method: 'HEAD' });
    assert.match(js.headers.get('content-type'), /javascript/);
    assert.equal(await js.text(), '');
    assert.equal((await fetch(service.url + 'missing.js')).status, 404);
    assert.equal((await fetch(service.url, { method: 'POST' })).status, 405);
    const escape = await fetch(service.url + '..%2fprivate.txt');
    assert.equal(escape.status, 403);
    if (process.platform !== 'win32') {
      await fs.symlink(path.join(root, 'private.txt'), path.join(root, 'dist', 'link.txt'));
      assert.equal((await fetch(service.url + 'link.txt')).status, 403);
    }
  } finally {
    if (service) await new Promise(resolve => { service.server.close(resolve); service.server.closeAllConnections(); });
    await fs.rm(root, { recursive: true, force: true });
  }
});
