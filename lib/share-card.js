import { verifyShareToken } from './share-token.js';
import { shareCopy, shareMessage, SITE_URL } from '../share-copy.js';
const MAX_BYTES=2*1024*1024,CHUNK=64*1024,RETENTION=7*86400000;
const idPattern='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function handleShareCard({request,env}){
 const path=new URL(request.url).pathname;
 if(path==='/api/share-config')return json({kakaoJavaScriptKey:/^[0-9a-f]{32}$/i.test(env.KAKAO_JAVASCRIPT_KEY??'')?env.KAKAO_JAVASCRIPT_KEY:null});
 if(!env.REPORT_SHARES)return json({error:'Sharing is not configured'},503);
 if(path==='/api/share-card'){
  if(request.method!=='POST')return json({error:'POST required'},405);
  if(env.TESTING_PAUSED==='true'||env.REPORTS_PAUSED==='true')return json({error:'테스트와 보고서 기능이 잠시 중지되었습니다.'},503);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Invalid origin'},403);
  if(request.headers.get('Content-Type')!=='image/png')return json({error:'PNG required'},415);
  const token=await verifyShareToken(request.headers.get('Authorization')?.replace(/^Bearer /,''),env.REPORT_EMAIL_SECRET);
  if(!token)return json({error:'Report share authorization expired'},401);
  const headers=new Headers({'Content-Type':'image/png','X-Share-ID':token.id,'X-Share-IQ':String(token.iq),'X-Share-Language':token.language});
  const stub=env.REPORT_SHARES.get(env.REPORT_SHARES.idFromName(token.id));
  return stub.fetch(new Request(request.url,{method:'POST',headers,body:request.body,duplex:'half'}));
 }
 const match=path.match(new RegExp(`^/s/(${idPattern})(/result\\.png)?$`));
 if(!match||!['GET','HEAD'].includes(request.method))return json({error:'Not found'},404);
 const stub=env.REPORT_SHARES.get(env.REPORT_SHARES.idFromName(match[1]));
 return stub.fetch(request);
}
export class ReportShare {
 constructor(state){this.state=state;this.creating=null;}
 async fetch(request){
  if(request.method==='POST'){
   if(!this.creating)this.creating=this.create(request).finally(()=>{this.creating=null;});
   return (await this.creating).clone();
  }
  const meta=await this.state.storage.get('meta');
  if(!meta||meta.expires<=Date.now())return new Response(shareCopy('en').expired,{status:404,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, noarchive','Content-Type':'text/plain; charset=utf-8'}});
  const image=new URL(request.url).pathname.endsWith('/result.png');
  const headers={'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow, noarchive','Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
  if(image){
   headers['Content-Type']='image/png';
   if(request.method==='HEAD')return new Response(null,{headers});
   const bytes=new Uint8Array(meta.bytes);
   for(let i=0;i<meta.chunks;i++)bytes.set(new Uint8Array(await this.state.storage.get(`image:${i}`)),i*CHUNK);
   return new Response(bytes,{headers});
  }
  headers['Content-Type']='text/html; charset=utf-8';
  headers['Content-Security-Policy']="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'";
  return new Response(request.method==='HEAD'?null:sharePage(meta),{headers});
 }
 async create(request){
  const existing=await this.state.storage.get('meta');
  if(existing){if(existing.expires<=Date.now())return json({error:'Share expired'},410);return json(publicMetadata(existing));}
  const reader=request.body?.getReader();if(!reader)return json({error:'Missing image'},400);
  const parts=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES){await reader.cancel();return json({error:'Image too large'},413);}parts.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const signature=[137,80,78,71,13,10,26,10];
  if(size<33||!signature.every((byte,i)=>bytes[i]===byte)||new TextDecoder().decode(bytes.slice(12,16))!=='IHDR')return json({error:'Invalid PNG'},400);
  const view=new DataView(bytes.buffer),width=view.getUint32(16),height=view.getUint32(20);
  if(width!==1000||height<1000||height>2000)return json({error:'Invalid image dimensions'},400);
  const id=request.headers.get('X-Share-ID'),origin=new URL(request.url).origin;
  const meta={id,iq:Number(request.headers.get('X-Share-IQ')),language:request.headers.get('X-Share-Language'),width,height,bytes:size,chunks:Math.ceil(size/CHUNK),expires:Date.now()+RETENTION,url:`${origin}/s/${id}`,imageUrl:`${origin}/s/${id}/result.png`};
  await this.state.storage.setAlarm(meta.expires);
  const entries={meta};for(let i=0;i<meta.chunks;i++)entries[`image:${i}`]=bytes.slice(i*CHUNK,(i+1)*CHUNK);
  await this.state.storage.put(entries);
  return json(publicMetadata(meta));
 }
 async alarm(){await this.state.storage.deleteAll();}
}
const publicMetadata=meta=>({url:meta.url,imageUrl:meta.imageUrl,width:meta.width,height:meta.height,expires:meta.expires});
export function sharePage(meta){
 const copy=shareCopy(meta.language),title=copy.intro.replace('{score}',meta.iq),e=escape;
 return `<!doctype html><html lang="${e(meta.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${e(title)} — Mindscope</title><meta property="og:type" content="website"><meta property="og:site_name" content="Mindscope"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(`${copy.try} : ${SITE_URL}`)}"><meta property="og:url" content="${e(meta.url)}"><meta property="og:image" content="${e(meta.imageUrl)}"><meta property="og:image:secure_url" content="${e(meta.imageUrl)}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="${meta.width}"><meta property="og:image:height" content="${meta.height}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(shareMessage(meta.iq,meta.language))}"><meta name="twitter:image" content="${e(meta.imageUrl)}"><style>body{margin:0;background:#eeede8;color:#242940;font-family:system-ui,sans-serif}main{max-width:760px;margin:auto;padding:32px 18px}h1{font-size:clamp(24px,5vw,40px);line-height:1.4}p{color:#73788b;line-height:1.7}img{display:block;width:100%;height:auto;border-radius:12px}a{display:inline-block;background:#7964d8;color:white;padding:16px 24px;border-radius:12px;text-decoration:none;font-weight:700;margin:16px 0}</style></head><body><main><strong>mindscope.</strong><h1>${e(title)}</h1><a href="${SITE_URL}">${e(copy.try)} →</a><img src="${e(meta.imageUrl)}" width="${meta.width}" height="${meta.height}" alt="${e(title)}"><p>${e(copy.expiry)}</p><a href="${SITE_URL}">${e(copy.try)} →</a></main></body></html>`;
}
