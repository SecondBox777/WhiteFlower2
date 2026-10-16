import { isLanguage, resolveLanguage, translate } from '../i18n.js';
// Leave successful report data intact: its language is bound to the saved purchase.
export async function localizeResponse(response, request) {
 const requested=request.headers.get('X-Mindscope-Language');
 if(!requested || !isLanguage(requested) || requested==='ko' || !response.headers.get('Content-Type')?.includes('application/json'))return response;
 const data=await response.clone().json().catch(()=>null);
 if(typeof data?.error!=='string')return response;
 const language=resolveLanguage(requested), translated=translate(data.error,language);
 data.error=translated===data.error ? translate('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',language):translated;
 return Response.json(data,{status:response.status,headers:response.headers});
}
