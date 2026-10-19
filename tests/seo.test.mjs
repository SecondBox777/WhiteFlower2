import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderLanding,pageMetadata} from '../seo.js';
import {languages} from '../i18n.js';
import worker from '../src/index.js';

test('all six crawlable landing pages have matching language, canonical URLs and visible FAQ data',async()=>{
 const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const sitemap=await readFile(new URL('../sitemap.xml',import.meta.url),'utf8');
 for(const language of Object.keys(languages)) {
  const html=renderLanding(source,language),meta=pageMetadata(language);
  assert.ok(html.includes(`<html lang="${language}">`));
  assert.ok(html.includes(`<link rel="canonical" href="${meta.url}"`));
  assert.ok(sitemap.includes(`<loc>${meta.url}</loc>`));
  assert.equal((html.match(/<title>/g)||[]).length,1);
  assert.ok(html.includes(`<option value="${language}">${languages[language]}</option>`));
  const data=JSON.parse(html.match(/id="site-structured-data">([\s\S]*?)<\/script>/)[1]);
  const page=data['@graph'][2];
  assert.equal(page.inLanguage,language);assert.equal(page.url,meta.url);
  assert.equal(page.mainEntity.length,7);
  for(const q of page.mainEntity){assert.ok(html.includes(q.name));assert.ok(q.acceptedAnswer.text.length>20);}
  if(language!=='ko') {
   assert.doesNotMatch(meta.title+meta.description,/[가-힣]/);
   assert.doesNotMatch(JSON.stringify(page.mainEntity),/[가-힣]/);
  }
 }
});
test('homepage routing serves language-specific HTML and preserves payment returns',async()=>{
 for(const [query,language] of [['','ko'],['?lang=en','en'],['?lang=ja&payment=return','ja'],['?lang=invalid','ko']]) {
  let fetched;
  const response=await worker.fetch(new Request(`https://mindscope.online/${query}`),{ASSETS:{fetch:r=>{fetched=r;return new Response('landing',{headers:{'Content-Type':'text/html'}});}}});
  assert.equal(new URL(fetched.url).pathname,`/_home/${language}.html`);
  assert.equal(response.status,200);assert.equal(response.headers.get('Content-Language'),language);
  assert.equal(await response.text(),'landing');
 }
 const redirect=await worker.fetch(new Request('https://mindscope.online/index.html?lang=en&payment=return'),{});
 assert.equal(redirect.status,308);assert.equal(redirect.headers.get('Location'),'https://mindscope.online/?lang=en&payment=return');
});
