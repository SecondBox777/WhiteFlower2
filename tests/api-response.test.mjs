import test from 'node:test';
import assert from 'node:assert/strict';
import { readApiResponse } from '../api-response.js';

test('plain-text and HTML failures show a useful message without leaking parser errors',async()=>{
  for (const body of ['Not found','<html>Gateway failure</html>','null','[]']) {
    await assert.rejects(readApiResponse(new Response(body,{status:404}),'결제 페이지를 열 수 없습니다.'),{message:'결제 페이지를 열 수 없습니다.'});
  }
});
test('valid payment and report responses, including provider diagnostics, remain intact',async()=>{
  for (const data of [{url:'https://polar.sh/checkout/session'},{error:'결제 오류',code:'POLAR_CHECKOUTS_422'},{status:'paid',submission:{answers:[0]}}]) {
    assert.deepEqual(await readApiResponse(Response.json(data),'fallback'),data);
  }
});
