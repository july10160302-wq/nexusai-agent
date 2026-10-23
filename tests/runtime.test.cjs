const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const ts = require('typescript');
function loadTs(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', code)(name => name.startsWith('.') ? loadTs(path.resolve(path.dirname(file), name + '.ts')) : require(name), exports);
  return exports;
}
const { chatOnce } = loadTs(path.resolve('src/lib/api.ts'));
const { refreshMcpTools } = loadTs(path.resolve('src/lib/mcp.ts'));
const settings = { baseUrl: 'https://provider.invalid/v1/', apiKey: 'test', model: 'test', temperature: 0.5, requestTimeout: 2 };
const encoder = new TextEncoder();
function streamResponse(parts, close = true) {
  return new Response(new ReadableStream({ start(c) { for (const part of parts) c.enqueue(encoder.encode(part)); if (close) c.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
}
async function mocked(fetcher, body) {
  const original = global.fetch;
  global.fetch = fetcher;
  try { return await body(); } finally { global.fetch = original; }
}
const call = extra => chatOnce({ settings, messages: [], tools: [], onDelta() {}, ...extra });

test('SSE [DONE] ends a response even when the socket remains open', { timeout: 2000 }, () => mocked(async()=>streamResponse(['data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n'], false), async()=> {
  assert.equal((await call()).content, 'hello');
}));
test('SSE handles fragmented events, Unicode, usage and final data without newline', () => mocked(async()=>streamResponse(['data: {"choices":[{"delta":{"con','tent":"你好"}}]}\r\n\r\ndata: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":2}}']), async()=> {
  const r = await call(); assert.equal(r.content,'你好'); assert.deepEqual(r.usage,{prompt:12,completion:2});
}));
test('tool-call deltas accumulate names and JSON arguments', () => mocked(async()=>streamResponse(['data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"a","function":{"name":"read","arguments":"{\\\"p\\\":"}}]}}]}\n\ndata: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"1}"}}]},"finish_reason":"tool_calls"}]}\n\ndata: [DONE]\n\n']), async()=> {
  const r = await call(); assert.equal(r.toolCalls[0].name,'read'); assert.equal(r.toolCalls[0].args,'{"p":1}');
}));
test('JSON compatible response is accepted', () => mocked(async()=>Response.json({ choices:[{message:{content:'OK'}}] }), async()=>assert.equal((await call()).content,'OK')));
test('SSE provider errors and truncated responses surface', async()=> {
  await mocked(async()=>streamResponse(['data: {"error":{"message":"quota exhausted"}}\n\n']), async()=>assert.rejects(call(),/quota exhausted/));
  await mocked(async()=>streamResponse(['data: {"choices":[{"delta":{"content":"partial"}}]}\n\n']), async()=>assert.rejects(call(),/interrupted/));
});
test('cancellation reaches fetch and HTTP failures include status', async()=> {
  const ctrl = new AbortController(); ctrl.abort();
  await mocked(async(_url,opts)=>{opts.signal.throwIfAborted()}, async()=>assert.rejects(call({signal:ctrl.signal}),{name:'AbortError'}));
  await mocked(async()=>new Response('unauthorized',{status:401}), async()=>assert.rejects(call(),/401/));
});
test('MCP SSE resolves its matching RPC without waiting for stream close', {timeout:2000}, ()=>mocked(async(_url,opts)=> {
  const body=JSON.parse(opts.body);
  if(body.id===undefined)return new Response(null,{status:202});
  const result=body.method==='tools/list'?{tools:[{name:'read',inputSchema:{type:'object'}}]}:{};
  return streamResponse(['data: '+JSON.stringify({jsonrpc:'2.0',id:body.id,result})+'\n\n'],false);
}, async()=>assert.equal((await refreshMcpTools({id:'sse',name:'test',url:'https://mcp.invalid',enabled:true})).length,1)));

test('desktop workspace MCP authenticates, confines paths and prevents stale writes', async()=> {
  const root=await fsp.mkdtemp(path.join(process.cwd(),'.nexus-test-'));
  const { startCompanion } = require('../companion/server.cjs');
  const service=await startCompanion({workspace:root,port:0});
  const rpc=async(method,params,auth=true)=>fetch(service.url,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+service.token}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  try {
    assert.equal((await rpc('tools/list',{},false)).status,401);
    assert.equal((await (await rpc('tools/list',{})).json()).result.tools.length,3);
    const invoke=async(name,args)=>(await (await rpc('tools/call',{name,arguments:args})).json());
    assert.ok((await invoke('workspace_read',{path:'../package.json'})).error);
    assert.ok((await invoke('workspace_write',{path:'note.txt',content:'hello',expectedHash:'new'})).result);
    const read=await invoke('workspace_read',{path:'note.txt'});
    const value=JSON.parse(read.result.content[0].text);
    assert.equal(value.content,'hello');
    assert.ok((await invoke('workspace_write',{path:'note.txt',content:'oops',expectedHash:'new'})).error);
    assert.ok((await invoke('workspace_write',{path:'note.txt',content:'updated',expectedHash:value.sha256})).result);
    assert.equal(await fsp.readFile(path.join(root,'note.txt'),'utf8'),'updated');
    assert.ok((await invoke('workspace_read',{path:'C:\\Windows\\win.ini'})).error);
    const outside = path.dirname(root);
    await fsp.symlink(outside,path.join(root,'escape'),'junction');
    assert.ok((await invoke('workspace_read',{path:'escape/package.json'})).error);
  } finally { await new Promise(resolve=>service.server.close(resolve)); await fsp.rm(root,{recursive:true,force:true}); }
});
