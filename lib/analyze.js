import { applyAbilityLevels } from './ability-levels.js';
import { emailConfigured, issueReportEmailToken } from './report-email.js';
import { replaceQuestionReferences } from './report-language.js';
import { validateSubmission, buildAnalysis, reportSchema, validReport, instructions } from './report.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function handleReport({request,env}, fetcher=fetch) {
  if(env.TESTING_PAUSED === 'true')return json({error:'테스트와 AI 보고서 생성이 잠시 중지되었습니다.'},503);
  if(env.REPORTS_PAUSED === 'true')return json({error:'AI 보고서 생성이 잠시 중지되었습니다.'},503);
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
  try { const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const raw=JSON.parse(new TextDecoder().decode(bytes)); if(raw.adultConfirmed!==true) return json({error:"성인 이용 확인이 필요합니다."},400); data=validateSubmission(raw); }
  catch{return json({error:'응답 30개, 문항별 시간, 언어 및 전송 동의를 확인해 주세요.'},400);}
  const missing = ['OPENAI_API_KEY', 'OPENAI_MODEL'].filter(name => !env[name]?.trim());
  if(missing.length)return json({error:`서버 설정 누락: ${missing.join(', ')}. Cloudflare의 해당 Worker → Settings → Variables and Secrets에서 런타임 설정을 등록하고 Deploy해 주세요.`},503);
  const analysis=buildAnalysis(data);
  // Legacy calibration is kept internally; never ask AI to interpret synthetic IQ.
  const {iq, ...puzzleResult}=analysis.result;
  const {calibration, ...puzzleAnalysis}=analysis;
  puzzleAnalysis.result=puzzleResult;
  analysis.result=puzzleResult;
  try {
    const response=await fetcher('https://api.openai.com/v1/responses',{
      method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      signal:AbortSignal.timeout(60000),
      body:JSON.stringify({model:env.OPENAI_MODEL,store:false,instructions,input:JSON.stringify(puzzleAnalysis),max_output_tokens:6000,text:{format:{type:'json_schema',name:'iq_report',strict:true,schema:reportSchema}}})
    });
    if(!response.ok)return json({error:response.status===429?'보고서 요청이 많습니다. 잠시 후 다시 시도해 주세요.':'AI 보고서 생성에 실패했습니다. 서버의 모델과 API 설정을 확인해 주세요.'},response.status===429?429:502);
    const output=await response.json();
    if(output.status!=='completed')return json({error:'보고서가 완성되지 않았습니다. 다시 시도해 주세요.'},502);
    const text=(output.output??[]).filter(x=>x.type==='message').flatMap(x=>x.content??[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
    let report;try{report=replaceQuestionReferences(JSON.parse(text),data.language);}catch{return json({error:'보고서 응답 형식을 확인할 수 없습니다.'},502);}
    if(!validReport(report))return json({error:'보고서 응답 형식이 올바르지 않습니다.'},502);
    report=applyAbilityLevels(report,analysis);
    report.careers=[];
    report.limitations=data.language==='en' ? 'Adult entertainment and puzzle practice only. Scores describe performance on these puzzles, not IQ, health, psychological status or career suitability. No validated population comparison is available.' : '성인용 오락·퍼즐 연습입니다. 점수는 이 문제에서의 수행만 나타내며 IQ, 건강 상태, 심리 상태나 직업 적합성을 측정하지 않습니다. 검증된 모집단 비교 자료가 없습니다.';
    const emailToken = emailConfigured(env) ? await issueReportEmailToken({report,result:analysis.result,language:data.language},env.REPORT_EMAIL_SECRET) : null;
    return json({result:analysis.result,domains:analysis.domains,report,emailToken});
  }catch{return json({error:'AI 보고서 요청 시간이 초과되었거나 연결에 실패했습니다.'},502);}
}
