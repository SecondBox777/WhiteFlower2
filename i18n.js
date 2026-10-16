import { translations } from './translations.js';
export const languages = Object.freeze({ko:'한국어',en:'English',ja:'日本語','zh-CN':'简体中文',es:'Español',fr:'Français'});
export const isLanguage = value => Object.hasOwn(languages, value);
export function resolveLanguage(value) {
  if (isLanguage(value)) return value;
  const base=String(value ?? '').toLowerCase().split('-')[0];
  return base==='zh'?'zh-CN':isLanguage(base)?base:'en';
}
export function translate(text, language='en') {
  const source=String(text), trimmed=source.trim();
  const translated=translations[trimmed]?.[language];
  if(translated!==undefined)return source.replace(trimmed,translated);
  if(/^QUESTION \d+$/.test(trimmed))return source.replace('QUESTION',({ko:'문항',en:'QUESTION',ja:'問題','zh-CN':'题目',es:'PREGUNTA',fr:'QUESTION'})[language]);
  if(language==='ko')return source;
  // Variable UI messages use fixed, translated labels and locale-neutral numbers.
  const duration=trimmed.match(/^(\d+)분 (\d+)초$/);
  if(duration)return ['minute','second'].map((unit,index)=>new Intl.NumberFormat(language,{style:'unit',unit,unitDisplay:'narrow'}).format(Number(duration[index+1]))).join(' ');
  if(trimmed==='분')return 'min';
  if(trimmed==='초')return 's';
  if(/^보기 [ABCD]$/.test(trimmed))return source.replace('보기',translations['보기'][language]);
  if(trimmed.endsWith(' 크게 보기 (새 탭)'))return source.replace('크게 보기 (새 탭)',translations['크게 보기 (새 탭)'][language]);
  const image=trimmed.match(/^사진 (\d+) 저장$/);
  if(image)return `${translate('사진으로 저장',language)} ${image[1]}`;
  if(/^전체 보고서를 사진 \d+장으로 만들었습니다\./.test(trimmed))return translate('사진 저장을 시작했습니다. 다운로드한 파일을 확인해 주세요.',language);
  return source;
}
export const languageOptions = () => Object.entries(languages).map(([code,name])=>`<option value="${code}">${name}</option>`).join('');
export function initialLanguage() {
  const requested=new URLSearchParams(location.search).get('lang');
  if(isLanguage(requested))return requested;
  try { const saved=localStorage.getItem('mindscope-language');if(isLanguage(saved))return saved; } catch {}
  return resolveLanguage(navigator.language);
}
// Translate text and accessibility attributes without replacing interactive elements.
const originalText=new WeakMap();
const originalAttributes=new WeakMap();
function remembered(record, current) {
  return record && record.last===current ? record.source : current;
}
export function localizeDOM(root, language) {
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes) {
    if(node.parentElement?.closest('script,style,select,textarea,#puzzle-report,.question-prompt,.answer'))continue;
    const source=remembered(originalText.get(node),node.nodeValue);
    const next=translate(source,language);
    originalText.set(node,{source,last:next});
    if(next!==node.nodeValue)node.nodeValue=next;
  }
  for(const element of root.querySelectorAll('[aria-label],[title],[placeholder]')) {
    const records=originalAttributes.get(element)??{};
    for(const attr of ['aria-label','title','placeholder'])if(element.hasAttribute(attr)) {
      const old=element.getAttribute(attr),source=remembered(records[attr],old),next=translate(source,language);
      records[attr]={source,last:next};
      if(old!==next)element.setAttribute(attr,next);
    }
    originalAttributes.set(element,records);
  }
}
