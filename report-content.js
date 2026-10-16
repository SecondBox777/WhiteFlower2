import { reportCopy } from './report-locales.js';
import { resolveLanguage } from './i18n.js';
// Shared content for the page, Resend email and image export.
const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function abilityAssessment(level, language) {
  const band = level <= 2 ? 0 : level - 2;
  return reportCopy(language)[`band${band}`];
}
export function reportBlocks({report,result,language}) {
  const copy=reportCopy(language);
  const blocks=[
    {kind:'title',text:copy.title},
    {kind:'muted',text:report.limitations},
    {kind:'iq',text:`${copy.iq}: ${Math.round(result.iq)}`},
    {kind:'body',text:`${copy.score}: ${result.score.toFixed(2)}/100`},
    {kind:'body',text:report.summary},
    {kind:'heading',text:copy.areas},
    {kind:'body',text:copy.method}
  ];
  for(const a of report.abilities ?? []) blocks.push({kind:'subheading',text:a.title},{kind:'body',text:`${'■'.repeat(a.level)}${'□'.repeat(5-a.level)} (${a.level}/5)\n${abilityAssessment(a.level,language)}\n${a.evidence}`});
  return blocks;
}
export function renderReportDocument(data) {
  const blocks=reportBlocks(data);
  const tags={title:'h1',iq:'h2',heading:'h2',subheading:'h3',body:'p',muted:'p'};
  const html=blocks.map(b=>`<${tags[b.kind]} style="white-space:pre-line;${b.kind==='muted'?'padding:16px;background:#f0edf8;font-weight:600;':''}">${escape(b.text)}</${tags[b.kind]}>`).join('');
  return {subject:`Mindscope — ${reportCopy(data.language).title}`,text:blocks.map(b=>b.text).join('\n\n'),html:`<!doctype html><html lang="${resolveLanguage(data.language)}"><body style="font-family:Arial,sans-serif;color:#222437;line-height:1.8"><main style="max-width:640px;margin:auto;padding:24px">${html}</main></body></html>`};
}
