import { languages, isLanguage, translate } from './i18n.js';
export const SITE_URL = 'https://mindscope.online/';
const copy = {
  ko: ['무료 온라인 IQ 테스트 | 30문항 · 30분 | Mindscope', '무료 온라인 IQ 테스트로 패턴 인식·논리 추론·공간 지각에 도전하세요. 30문항, 제한 시간 30분, 회원가입 없이 시작. 개인 결과 리포트는 별도 1회 결제 상품입니다.'],
  en: ['Free Online IQ Test | 30 Questions, 30 Minutes | Mindscope', 'Take a free online IQ test with 30 pattern, logic, and spatial reasoning questions in 30 minutes. No sign-up required. Personal results report sold separately.'],
  ja: ['無料オンラインIQテスト | 30問・30分 | Mindscope', 'パターン認識・論理・空間推論に挑戦する無料オンラインIQテスト。30問、制限時間30分、登録不要。個人結果レポートは別途1回払いで提供します。'],
  'zh-CN': ['免费在线IQ测试 | 30道题・30分钟 | Mindscope', '通过免费在线IQ测试挑战模式识别、逻辑和空间推理。30道题，限时30分钟，无需注册。个人结果报告为单独的一次性付费商品。'],
  es: ['Test de CI online gratis | 30 preguntas, 30 minutos | Mindscope', 'Haz un test de CI online gratis con 30 preguntas de patrones, lógica y razonamiento espacial en 30 minutos. Sin registro. Informe personal de pago por separado.'],
  fr: ['Test de QI en ligne gratuit | 30 questions, 30 minutes | Mindscope', 'Essayez un test de QI en ligne gratuit : 30 questions de motifs, de logique et de raisonnement spatial en 30 minutes. Sans inscription. Rapport personnel payant en option.']
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
