import { languages, isLanguage, translate } from './i18n.js';
export const SITE_URL = 'https://mindscope.online/';
const copy = {
  ko: ['Mindscope | 무료 30문항 IQ 테마 퍼즐 · 개인 리포트', '패턴·논리·공간 퍼즐 30문항을 30분 동안 무료로 즐기세요. 만 18세 이상을 위한 오락용 게임이며, 완료 후 개인 퍼즐 리포트를 1회 결제로 받을 수 있습니다. 공인 IQ 검사가 아닙니다.'],
  en: ['Mindscope | 30 Free IQ-Themed Puzzles & Personal Reports', 'Play 30 free pattern, logic and spatial puzzles in 30 minutes. An entertainment game for adults 18+, with an optional personal report for a one-time payment. Not a certified IQ test.'],
  ja: ['Mindscope | 無料のIQテーマパズル30問と個人レポート', 'パターン・論理・空間の30問を30分で無料プレイ。18歳以上向けの娯楽ゲームです。終了後は1回払いで個人レポートを購入できます。公認IQ検査ではありません。'],
  'zh-CN': ['Mindscope | 30道免费IQ主题谜题与个人报告', '在30分钟内免费挑战30道模式、逻辑和空间谜题。面向18岁以上成年人的娱乐游戏，完成后可一次性付费购买个人报告。非官方IQ测试。'],
  es: ['Mindscope | 30 puzles gratis de estilo CI e informes personales', 'Resuelve 30 puzles gratis de patrones, lógica y espacio en 30 minutos. Juego para mayores de 18 años con informe personal opcional de pago único. No es una prueba de CI certificada.'],
  fr: ['Mindscope | 30 énigmes gratuites de style QI et rapports personnels', 'Jouez à 30 énigmes gratuites de motifs, de logique et d’espace en 30 minutes. Pour les adultes de 18 ans et plus, avec rapport personnel facultatif à paiement unique. Pas un test de QI certifié.']
};
export function pageMetadata(language) {
  const code=isLanguage(language)?language:'ko';
  return {language:code,title:copy[code][0],description:copy[code][1],url:code==='ko'?SITE_URL:`${SITE_URL}?lang=${code}`};
}
const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = html => html.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
export function structuredData(language, questions=[]) {
  const m=pageMetadata(language);
  return {'@context':'https://schema.org','@graph':[
    {'@type':'Organization','@id':`${SITE_URL}#organization`,name:'Mindscope',url:SITE_URL},
    {'@type':'WebSite','@id':`${SITE_URL}#website`,name:'Mindscope',url:SITE_URL,inLanguage:Object.keys(languages),publisher:{'@id':`${SITE_URL}#organization`}},
    {'@type':['WebPage','FAQPage'],'@id':`${m.url}#webpage`,url:m.url,name:m.title,description:m.description,inLanguage:m.language,isPartOf:{'@id':`${SITE_URL}#website`},mainEntity:questions.map(q=>({'@type':'Question',name:q.question,acceptedAnswer:{'@type':'Answer',text:q.answer}}))}
  ]};
}
export function seoHead(language, questions) {
  const m=pageMetadata(language);
  return `<!-- SEO:START -->
  <title>${escape(m.title)}</title>
  <meta name="description" content="${escape(m.description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${escape(m.url)}" />
  ${Object.keys(languages).map(code=>`<link rel="alternate" hreflang="${code}" href="${escape(pageMetadata(code).url)}" />`).join('\n  ')}
  <link rel="alternate" hreflang="x-default" href="${SITE_URL}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Mindscope" />
  <meta property="og:title" content="${escape(m.title)}" />
  <meta property="og:description" content="${escape(m.description)}" />
  <meta property="og:url" content="${escape(m.url)}" />
  <meta property="og:locale" content="${({'ko':'ko_KR','en':'en_US','ja':'ja_JP','zh-CN':'zh_CN','es':'es_ES','fr':'fr_FR'})[m.language]}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escape(m.title)}" />
  <meta name="twitter:description" content="${escape(m.description)}" />
  <script type="application/ld+json" id="site-structured-data">${JSON.stringify(structuredData(language,questions)).replace(/</g,'\\u003c')}</script>
  <!-- SEO:END -->`;
}
export function renderLanding(source, language='ko') {
  const code=isLanguage(language)?language:'ko';
  // All current landing text is authored in Korean; keep scripts/styles intact.
  let html=source.replace(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]+>)|([^<]+)/g,(all,tag,text)=>tag || translate(text,code));
  html=html.replace(/(<html\b[^>]*lang=")[^"]+/,`$1${code}`);
  html=html.replace(/<option value="([^"]+)"(?: selected)?/g,(_,value)=>`<option value="${value}"${value===code?' selected':''}`);
  html=html.replace(/(aria-label|placeholder|title)="([^"]*)"/g,(_,attr,value)=>`${attr}="${escape(translate(value,code))}"`);
  const questions=[...html.matchAll(/<details><summary>([\s\S]*?)<span>\+<\/span><\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map(m=>({question:plain(m[1]),answer:plain(m[2])}));
  return html.replace(/<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/,seoHead(code,questions));
}
export function updatePageMetadata(language, document) {
  const m=pageMetadata(language);
  document.title=m.title;
  document.querySelector('meta[name="description"]').content=m.description;
  document.querySelector('link[rel="canonical"]').href=m.url;
  for (const key of ['title','description','url']) {
    document.querySelector(`meta[property="og:${key}"]`).content=m[key];
    if(key!=='url')document.querySelector(`meta[name="twitter:${key}"]`).content=m[key];
  }
  document.querySelector('meta[property="og:locale"]').content=({'ko':'ko_KR','en':'en_US','ja':'ja_JP','zh-CN':'zh_CN','es':'es_ES','fr':'fr_FR'})[m.language];
  const questions=[...document.querySelectorAll('.faq-list details')].map(e=>({question:e.querySelector('summary').childNodes[0].textContent.trim(),answer:e.querySelector('p').textContent.trim()}));
  document.querySelector('#site-structured-data').textContent=JSON.stringify(structuredData(language,questions));
}
