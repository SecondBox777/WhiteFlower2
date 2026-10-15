// Shared content for the page, Resend email and image export.
const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function reportBlocks({report,result,language}) {
  const en=language==='en';
  const blocks=[
    {kind:'title',text:en?'Your puzzle results':'나의 퍼즐 결과 보고서'},
    {kind:'muted',text:report.limitations},
    {kind:'iq',text:`${en?'Your IQ-style score, just for fun':'재미로 보는 당신의 IQ'}: ${Math.round(result.iq)}`},
    {kind:'body',text:`${en?'Score':'점수'}: ${result.score.toFixed(2)}/100 · ${en?'Correct':'정답'}: ${result.correct}/30`},
    {kind:'body',text:report.summary},
    {kind:'heading',text:en?'Three puzzle areas':'세 가지 퍼즐 영역'},
    {kind:'body',text:en?'Bars show approximate game performance, not intelligence or ranking. Weighted correct answers contribute 80%; pace on correct answers contributes up to 20%, using internal reference times. Unanswered, timed-out and implausibly fast responses earn no points.':'막대는 이 게임에서의 대략적인 수행 기록이며 실제 능력이나 타인과의 순위가 아닙니다. 난이도별 정답 점수 80%와 정답 풀이의 내부 기준시간 대비 속도 점수 최대 20%를 합산합니다. 미응답·시간 초과·지나치게 빠른 응답은 점수에서 제외합니다.'}
  ];
  for(const a of report.abilities ?? []) blocks.push({kind:'subheading',text:a.title},{kind:'body',text:`${'■'.repeat(a.level)}${'□'.repeat(5-a.level)} (${a.level}/5)\n${a.evidence}`});
  blocks.push({kind:'heading',text:en?'Answers and approximate times':'정답과 대략적인 풀이 시간'});
  for(const q of report.items ?? []) blocks.push({kind:'body',text:en?`Q${q.position}: answer ${q.answer} · your answer ${q.selected??'—'} · ${q.excluded?'excluded':q.correct?'correct':'incorrect'} · ~${q.seconds}s`:`${q.position}번: 정답 ${q.answer} · 선택 ${q.selected??'—'} · ${q.excluded?'채점 제외':q.correct?'정답':'오답'} · 약 ${q.seconds}초`});
  blocks.push({kind:'muted',text:report.limitations});
  return blocks;
}
export function renderReportDocument(data) {
  const blocks=reportBlocks(data);
  const tags={title:'h1',iq:'h2',heading:'h2',subheading:'h3',body:'p',muted:'p'};
  const html=blocks.map(b=>`<${tags[b.kind]} style="white-space:pre-line;${b.kind==='muted'?'padding:16px;background:#f0edf8;font-weight:600;':''}">${escape(b.text)}</${tags[b.kind]}>`).join('');
  return {subject:data.language==='en'?'Mindscope — Your puzzle results':'Mindscope — 퍼즐 결과 보고서',text:blocks.map(b=>b.text).join('\n\n'),html:`<!doctype html><html lang="${data.language}"><body style="font-family:Arial,sans-serif;color:#222437;line-height:1.8"><main style="max-width:640px;margin:auto;padding:24px">${html}</main></body></html>`};
}
