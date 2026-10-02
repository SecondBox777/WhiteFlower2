import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { handleReport } from '../lib/analyze.js';

test('ordinary requests delegate unchanged to the asset binding', async () => {
  for (const path of ['/', '/app.js', '/Q30.webp', '/missing']) {
    const request = new Request(`https://example.com${path}`);
    const response = new Response('asset', {status: path === '/missing' ? 404 : 200});
    assert.equal(await worker.fetch(request, {ASSETS: {fetch: incoming => {
      assert.equal(incoming, request); return response;
    }}}), response);
  }
});
test('API routes never fall through to static assets', async () => {
  const env = {ASSETS: {fetch: () => {throw Error('Unexpected asset request');}}};
  for (const path of ['/api/analyze', '/api/report']) {
    assert.equal((await worker.fetch(new Request(`https://example.com${path}`), env)).status, 405);
  }
  assert.equal((await worker.fetch(new Request('https://example.com/api/missing'), env)).status, 404);
});
test('malformed, oversized and non-JSON bodies are rejected before OpenAI', async () => {
  for (const [body, contentType, expected] of [['{', 'application/json', 400], ['x'.repeat(12001), 'application/json', 413], ['{}', 'text/plain', 415]]) {
    const response = await handleReport({request: new Request('https://example.com/api/analyze', {
      method: 'POST', headers: {'Content-Type': contentType}, body
    }), env: {}}, () => {throw Error('Unexpected OpenAI request');});
    assert.equal(response.status, expected);
  }
});

test('temporary pause blocks both report routes before any OpenAI request', async () => {
  for (const path of ['/api/analyze', '/api/report']) {
    const request = new Request(`https://example.com${path}`, {method:'POST', body:'{}', headers:{'Content-Type':'application/json'}});
    const response = await worker.fetch(request, {TESTING_PAUSED:'true'});
    assert.equal(response.status,503);
    assert.ok((await response.json()).error.includes('중지'));
  }
  const response=await handleReport({request:new Request('https://example.com/api/analyze'),env:{TESTING_PAUSED:'true'}},()=>{throw Error('Must not call OpenAI');});
  assert.equal(response.status,503);
});
