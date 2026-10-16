import { services, shareCopy, shareMessage, serviceURL, SITE_URL } from './share-copy.js';
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cache=new WeakMap();let active=null,dialog=null,configPromise=null,sdkPromise=null;
function config(){return configPromise??=fetch('/api/share-config',{signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():{}).catch(()=>{configPromise=null;return {};});}
function kakaoSDK(){
 if(window.Kakao)return Promise.resolve(window.Kakao);
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js';script.async=true;script.crossOrigin='anonymous';
  const timer=setTimeout(()=>{script.remove();reject(Error('SDK timeout'));},10000);
  script.onload=()=>{clearTimeout(timer);window.Kakao?resolve(window.Kakao):reject(Error('SDK unavailable'));};
  script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('SDK unavailable'));};document.head.append(script);
 }).catch(error=>{sdkPromise=null;throw error;});return sdkPromise;
}
export function closeReportShareMenu(){
 const old=active;active=null;cleanup(old);if(dialog?.open)dialog.close();
}
function status(state,text){if(active===state)dialog.querySelector('[data-share-status]').textContent=text;}
function busy(state,value){if(active!==state)return;state.busy=value;dialog.querySelectorAll('button[data-service],button[data-action]').forEach(b=>b.disabled=value||!state.ready);}
function cleanup(state){if(state?.previewURL)URL.revokeObjectURL(state.previewURL);}
export function openReportShareMenu({data,files,prepareFiles,uiLanguage=data.language}){
 if(!data)return;
 const copy=shareCopy(uiLanguage),message=shareMessage(data.result.iq,data.language);
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='report-share-dialog';dialog.setAttribute('aria-labelledby','report-share-title');document.body.append(dialog);
  dialog.addEventListener('close',()=>{const old=active;active=null;cleanup(old);});
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 }
 if(active)cleanup(active);
 const state={data,copy,message,files:files??null,ready:Boolean(files?.length),busy:false,previewURL:null};active=state;
 dialog.lang=uiLanguage;
 dialog.innerHTML=`<div class="share-menu-head"><div><span class="share-kicker">MINDSCOPE</span><h2 id="report-share-title">${escape(copy.title)}</h2></div><button type="button" class="share-menu-close" aria-label="${escape(({ko:'닫기',en:'Close',ja:'閉じる','zh-CN':'关闭',es:'Cerrar',fr:'Fermer'})[uiLanguage]??'Close')}">×</button></div><p class="share-menu-hint">${escape(copy.hint)}</p><div class="share-preview"><img alt="${escape(message.split('\n')[0])}" hidden><div><strong>${escape(message.split('\n')[0])}</strong><p>MINDSCOPE.ONLINE</p></div></div><textarea class="share-caption" readonly rows="3" aria-label="${escape(copy.copyText)}">${escape(message)}</textarea><button class="share-native" type="button" data-action="native" disabled>${escape(copy.native)}</button><div class="share-social-grid">${services.map(([code,name,icon,color])=>`<button type="button" data-service="${code}" disabled><span aria-hidden="true" style="background:${color};color:${code==='kakao'?'#191919':'#fff'}">${icon}</span>${escape(code==='kakao'&&uiLanguage==='ko'?'카카오톡':code==='more'?'+ SNS':name)}</button>`).join('')}</div><div class="share-action-grid">${[['image',copy.copyImage],['text',copy.copyText],['download',copy.download],['link',copy.copyLink]].map(([code,label])=>`<button type="button" data-action="${code}" disabled>${escape(label)}</button>`).join('')}</div><p class="share-menu-status" data-share-status role="status" aria-live="polite">${escape(copy.preparing)}</p><a class="share-popup-fallback" hidden target="_blank" rel="noopener noreferrer"></a><p class="share-menu-hint">${escape(copy.imageFallback)}</p><p class="share-menu-privacy">${escape(copy.publicNote)}</p>`;
 dialog.querySelector('.share-menu-close').onclick=()=>dialog.close();
 dialog.querySelectorAll('[data-service]').forEach(button=>button.onclick=()=>onService(state,button.dataset.service,button));
 dialog.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>onAction(state,button.dataset.action));
 if(!dialog.open)dialog.showModal();
 const showFiles=value=>{
  if(active!==state)return;
  state.files=value;state.ready=true;
  state.previewURL=URL.createObjectURL(value[0]);const preview=dialog.querySelector('.share-preview img');preview.src=state.previewURL;preview.hidden=false;
  const native=dialog.querySelector('[data-action="native"]');native.hidden=!(navigator.share&&navigator.canShare?.({files:value}));
  busy(state,false);status(state,copy.ready);
 };
 if(state.ready)showFiles(state.files);else prepareFiles().then(showFiles).catch(()=>status(state,copy.failed));
 // Fetch only the public SDK configuration here. Images upload only after choosing KakaoTalk.
 config().then(value=>{if(value.kakaoJavaScriptKey&&active===state)kakaoSDK().catch(()=>{});});
}
async function publicCard(state){
 const saved=cache.get(state.data)??{};
 if(saved.publicCard)return saved.publicCard;
 if(!saved.publicPromise){
  saved.publicPromise=(async()=>{
   if(!state.data.shareToken)throw Error('Missing share authorization');
   const response=await fetch('/api/share-card',{method:'POST',headers:{'Content-Type':'image/png',Authorization:`Bearer ${state.data.shareToken}`},body:state.files[0],signal:AbortSignal.timeout(25000)});
   const body=await response.json();
   if(!response.ok||!body.url||!body.imageUrl)throw Error('Share upload failed');
   const origin=location.origin;
   if(new URL(body.url).origin!==origin||new URL(body.imageUrl).origin!==origin)throw Error('Invalid share origin');
   saved.publicCard=body;return body;
  })().catch(error=>{saved.publicPromise=null;throw error;});
  cache.set(state.data,saved);
 }
 return saved.publicPromise;
}
function download(state){
 const url=URL.createObjectURL(state.files[0]),link=document.createElement('a');link.href=url;link.download='mindscope-result.png';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function copyText(text){
 try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}}catch{}
 const input=dialog.querySelector('.share-caption'),old=input.value;input.value=text;input.focus();input.select();
 const copied=document.execCommand('copy');input.value=old;if(!copied)throw Error('Clipboard unavailable');
}
async function onAction(state,action){
 if(active!==state||state.busy||!state.ready)return;
 busy(state,true);
 try{
  if(action==='native'){
   // Called directly from a user click with already prepared original files and the caption.
   await navigator.share({files:state.files,title:state.copy.title,text:state.message});status(state,state.copy.opened);
  }else if(action==='image'){
   if(!navigator.clipboard?.write||!window.ClipboardItem)throw Error('Image clipboard unavailable');
   await navigator.clipboard.write([new ClipboardItem({'image/png':state.files[0]})]);status(state,state.copy.imageCopied);
  }else if(action==='text'){await copyText(state.message);status(state,state.copy.copied);
  }else if(action==='download'){download(state);status(state,state.copy.saved);
  }else if(action==='link'){
   status(state,state.copy.preparing);const card=await publicCard(state);if(active!==state)return;
   await copyText(card.url);status(state,state.copy.copied);
  }
 }catch(error){status(state,error.name==='AbortError'?state.copy.cancelled:action==='image'?state.copy.imageFallback:state.copy.failed);}
 finally{busy(state,false);}
}
async function onService(state,service,button){
 if(active!==state||state.busy||!state.ready)return;
 if(service==='kakao'){await kakao(state,button);return;}
 // Reserve the popup during the click, before image upload can consume user activation.
 dialog.querySelector('.share-popup-fallback').hidden=true;
 const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
 busy(state,true);status(state,state.copy.preparing);
 try{
  const card=await publicCard(state);if(active!==state){popup?.close();return;}
  const url=serviceURL(service,{message:state.message,...card});
  if(popup&&!popup.closed){popup.location.href=url;status(state,state.copy.opened);}
  else{const link=dialog.querySelector('.share-popup-fallback');link.href=url;link.textContent=services.find(x=>x[0]===service)[1];link.hidden=false;status(state,state.copy.popup);}
 }catch{popup?.close();status(state,state.copy.failed);}
 finally{busy(state,false);}
}
async function kakao(state,button){
 const saved=cache.get(state.data)??{};
 if(saved.kakaoPayload&&window.Kakao){
  try{window.Kakao.Share.sendDefault(saved.kakaoPayload);status(state,state.copy.opened);}catch{status(state,state.copy.failed);}
  return;
 }
 busy(state,true);status(state,state.copy.preparing);
 try{
  const {kakaoJavaScriptKey}=await config();if(active!==state)return;
  if(!kakaoJavaScriptKey){status(state,state.copy.kakaoSetup);return;}
  const sdk=await kakaoSDK();if(!sdk.isInitialized())sdk.init(kakaoJavaScriptKey);
  const uploaded=await sdk.Share.uploadImage({file:[state.files[0]]});
  if(active!==state)return;
  const imageUrl=uploaded?.infos?.original?.url;
  if(!imageUrl||new URL(imageUrl).protocol!=='https:')throw Error('Kakao image upload failed');
  const header=new DataView(await state.files[0].slice(0,24).arrayBuffer());const width=header.getUint32(16),height=header.getUint32(20);
  saved.kakaoPayload={objectType:'feed',content:{title:state.message.split('\n')[0],description:`${shareCopy(state.data.language).try} : ${SITE_URL}`,imageUrl,imageWidth:width,imageHeight:height,link:{mobileWebUrl:SITE_URL,webUrl:SITE_URL}},buttons:[{title:shareCopy(state.data.language).try,link:{mobileWebUrl:SITE_URL,webUrl:SITE_URL}}]};
  cache.set(state.data,saved);button.lastChild.textContent=state.copy.sendKakao;status(state,state.copy.kakaoReady);
  // The next click invokes sendDefault synchronously, so desktop popup blockers cannot eat it.
 }catch{status(state,state.copy.failed);}
 finally{busy(state,false);}
}
