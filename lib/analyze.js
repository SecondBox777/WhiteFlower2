import { validateSubmission, buildAnalysis, reportSchema, validReport, instructions } from './report.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function handleReport({request,env}, fetcher=fetch) {
  if(request.method!=='POST')return json({error:'POST required'},405);
  const origin=request.headers.get('Origin');
  if(origin && origin!==new URL(request.url).origin)return json({error:'Invalid origin'},403);
  if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON required'},415);
  // Read with a hard limit even if Content-Length is absent or spoofed.
  const reader=request.body?.getReader();
  if(!reader)return json({error:'Missing body'},400);
  let size=0,chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>12000){await reader.cancel();return json({error:'Request too large'},413);}chunks.push(value);}
  let data;
  try { const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}data=validateSubmission(JSON.parse(new TextDecoder().decode(bytes))); }
  catch{return json({error:'응답 30개, 문항별 시간, 언어 및 전송 동의를 확인해 주세요.'},400);}
  if(!env.OPENAI_API_KEY||!env.OPENAI_MODEL)return json({error:'서버의 OPENAI_API_KEY와 OPENAI_MODEL 설정이 필요합니다.'},503);
  const analysis=buildAnalysis(data);
  try {
    const response=await fetcher('https://api.openai.com/v1/responses',{
      method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      signal:AbortSignal.timeout(60000),
      body:JSON.stringify({model:env.OPENAI_MODEL,store:false,instructions,input:JSON.stringify(analysis),max_output_tokens:4000,text:{format:{type:'json_schema',name:'iq_report',strict:true,schema:reportSchema}}})
    });
    if(!response.ok)return json({error:response.status===429?'보고서 요청이 많습니다. 잠시 후 다시 시도해 주세요.':'AI 보고서 생성에 실패했습니다. 서버의 모델과 API 설정을 확인해 주세요.'},response.status===429?429:502);
    const output=await response.json();
    if(output.status!=='completed')return json({error:'보고서가 완성되지 않았습니다. 다시 시도해 주세요.'},502);
    const text=(output.output??[]).filter(x=>x.type==='message').flatMap(x=>x.content??[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
    let report;try{report=JSON.parse(text);}catch{return json({error:'보고서 응답 형식을 확인할 수 없습니다.'},502);}
    if(!validReport(report))return json({error:'보고서 응답 형식이 올바르지 않습니다.'},502);
    return json({result:analysis.result,domains:analysis.domains,report});
  }catch{return json({error:'AI 보고서 요청 시간이 초과되었거나 연결에 실패했습니다.'},502);}
}
