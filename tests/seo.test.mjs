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
  assert.ok(html.includes(`<option value="${language}" selected>${languages[language]}</option>`));
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

test('English IQ test landing is discoverable and keeps price and validity disclosures visible',async()=>{
 const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const html=renderLanding(source,'en');
 const body=html.split('<body>')[1];
 assert.match(pageMetadata('en').title,/Free Online IQ Test/);
 assert.match(body,/<h1>[\s\S]*Online IQ Test[\s\S]*?<\/h1>/);
 assert.doesNotMatch(body,/IQ-themed|IQ theme/i);
 assert.match(html,/Personal results report sold separately/);
 const footer=body.match(/<footer[\s\S]*?<\/footer>/)[0];
 assert.match(footer,/not an official IQ test/i);
 for(const language of Object.keys(languages)) {
  const url=language==='ko'?'/':`/?lang=${language}`;
  assert.ok(footer.includes(`href="${url}" lang="${language}" hreflang="${language}"`));
 }
});


test('all landing languages show the free start button without the hero purchase note',async()=>{
 const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const labels={ko:'무료로 테스트 시작하기',en:'Start the Free Test',ja:'無料でテストを始める','zh-CN':'免费开始测试',es:'Empezar el test gratis',fr:'Commencer le test gratuit'};
 for(const [language,label] of Object.entries(labels)) {
  const html=renderLanding(source,language);
  assert.ok(html.includes(`class="button primary hero-button" data-start>${label} <span>`));
  assert.doesNotMatch(html,/hero-purchase-note/);
 }
});
