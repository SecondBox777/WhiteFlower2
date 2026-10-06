// Shared presentation: the page, email and image export use the same report content.
const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderReportDocument({report,result,language}) {
  const en = language==='en';
  const title = en ? 'Your AI cognitive test report' : 'AI 인지 능력 테스트 보고서';
  const sections = [[en?'Problem solving':'문제풀이',report.problem_solving], [en?'Cognitive characteristics':'인지적 특성',report.cognitive_characteristics], [en?'Recommended careers':'추천 직업',report.careers]];
  const iqLabel = en ? 'Your AI-estimated IQ' : 'AI가 추정한 당신의 IQ';
  const iqLine = `${iqLabel}: ${Math.round(result.iq)}`;
  const stats = `${en?'Score':'점수'}: ${result.score.toFixed(2)}/100 · ${en?'Correct':'정답'}: ${result.correct}/30`;
  const paragraphs = [title,iqLine,stats,report.summary];
  const p = text => `<p style="white-space:pre-line;margin:0 0 16px">${escape(text)}</p>`;
  let html = `<h1 style="font-size:24px;margin:0 0 24px">${escape(title)}</h1><p class="report-iq" style="font-size:28px;line-height:1.4;font-weight:700;margin:0 0 12px">${escape(iqLabel)}: <strong style="font-size:40px">${Math.round(result.iq)}</strong></p>${p(stats)}<div style="margin-top:32px">${p(report.summary)}</div>`;
  for(const [heading,items] of sections) {
    paragraphs.push(heading);
    html += `<h2 style="font-size:22px;margin:36px 0 20px">${escape(heading)}</h2>`;
    for(const item of items) {
      const name=item.title??item.field;
      const texts=[item.assessment,item.evidence,item.advice,item.required_abilities].filter(Boolean);
      paragraphs.push(name,...texts);
      html += `<h3 style="font-size:18px;margin:24px 0 12px">${escape(name)}</h3>${texts.map(p).join('')}`;
    }
  }
  paragraphs.push(`\n\n${report.limitations}`);
  html += `<div style="padding-top:40px;color:#606475;font-size:14px">${p(report.limitations)}</div>`;
  return {subject:en?'Mindscope — Your AI report':'Mindscope — AI 분석 보고서',text:paragraphs.join('\n\n'),html:`<!doctype html><html lang="${language}"><body style="font-family:Arial,sans-serif;color:#222437;line-height:1.8"><main style="max-width:640px;margin:auto;padding:24px">${html}</main></body></html>`};
}


export function reportBlocks({report,result,language}) {
  const en=language==='en';
  const blocks=[{kind:'title',text:en?'Your AI cognitive test report':'AI 인지 능력 테스트 보고서'}, {kind:'iq',text:`${en?'Your AI-estimated IQ':'AI가 추정한 당신의 IQ'}: ${Math.round(result.iq)}`}, {kind:'body',text:`${en?'Score':'점수'}: ${result.score.toFixed(2)}/100 · ${en?'Correct':'정답'}: ${result.correct}/30`}, {kind:'body',text:report.summary}];
  for(const [heading,items] of [[en?'Problem solving':'문제풀이',report.problem_solving],[en?'Cognitive characteristics':'인지적 특성',report.cognitive_characteristics],[en?'Recommended careers':'추천 직업',report.careers]]) {
    blocks.push({kind:'heading',text:heading});
    for(const item of items) {
      blocks.push({kind:'subheading',text:item.title??item.field});
      for(const text of [item.assessment,item.evidence,item.advice,item.required_abilities].filter(Boolean))blocks.push({kind:'body',text});
    }
  }
  blocks.push({kind:'muted',text:report.limitations});
  return blocks;
}
