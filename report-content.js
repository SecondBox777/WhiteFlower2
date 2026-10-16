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
  const {copy,areas,reference,iq,score}=reportView(data),c=reportTheme;
  const e=escape;
  const eyebrow=text=>`<p style="margin:0 0 12px;font-size:10px;line-height:1.6;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${c.muted}">${e(text)}</p>`;
  const footer=page=>`<table role="presentation" width="100%" style="margin-top:28px;border-top:1px solid ${c.line};font-size:10px;color:${c.muted}"><tr><td style="padding-top:16px">mindscope. &nbsp; / &nbsp; ${e(copy.footer)}</td><td align="right" style="padding-top:16px;white-space:nowrap">${page} / 02</td></tr></table>`;
  const segments=area=>`<table aria-hidden="true" role="presentation" width="100%" cellspacing="4" style="table-layout:fixed"><tr>${Array.from({length:5},(_,i)=>`<td height="8" style="height:8px;border-radius:3px;background:${i<area.level?area.color:'#e6e4dd'};font-size:0">&nbsp;</td>`).join('')}</tr></table>`;
  const pillars=`<table aria-hidden="true" role="presentation" width="100%" cellspacing="10" style="table-layout:fixed">${[5,4,3,2,1].map(level=>`<tr>${areas.map(area=>`<td height="25" style="height:25px;border-radius:4px;background:${area.level>=level?['#b4a3ff','#8ec8ba','#dfbc87'][area.index]:'#3c4159'};font-size:0">&nbsp;</td>`).join('')}</tr>`).join('')}<tr>${areas.map(area=>`<td align="center" style="padding-top:8px;color:#d7d7e1;font-size:11px;letter-spacing:2px">0${area.index+1}</td>`).join('')}</tr></table>`;
  const areaCards=areas.map(area=>`<section class="ms-area" style="margin:16px 0;padding:24px;border:1px solid ${c.line};border-left:4px solid ${area.color};border-radius:12px;background:#fff">
    <table role="presentation" width="100%"><tr><td style="vertical-align:top"><span style="color:${area.color};font-size:11px;letter-spacing:2px;font-weight:700">0${area.index+1}</span><h3 style="margin:8px 0 12px;font-size:20px;line-height:1.4;color:${c.ink}">${e(area.title)}</h3></td><td width="70" align="right" style="vertical-align:top;white-space:nowrap"><strong style="font-size:34px;line-height:1.2;color:${area.color}">${area.level}</strong><span style="font-size:12px;color:${c.muted}"> / 5</span></td></tr></table>
    ${segments(area)}<p style="margin:14px 0 8px;line-height:1.8;font-size:13px;color:${c.ink}">${e(area.assessment)}</p><p style="margin:0;font-size:11px;line-height:1.8;color:${c.muted}">${e(area.evidence)}</p></section>`).join('');
  const main=`<style>.ms-report *{box-sizing:border-box}.ms-report p,.ms-report h1,.ms-report h2,.ms-report h3{overflow-wrap:anywhere}.ms-report table{border-collapse:separate}.ms-report .ms-hero-title{letter-spacing:-1px}@media(max-width:480px){.ms-report .ms-sheet{padding:26px 20px!important}.ms-report .ms-hero{padding:25px 18px!important}.ms-report .ms-hero-title{font-size:30px!important}.ms-report .ms-iq-label{font-size:23px!important}.ms-report .ms-iq-number{font-size:100px!important}.ms-report .ms-pillar-cell{width:28%!important}.ms-report .ms-area{padding:18px!important}.ms-report .ms-brandline{font-size:9px!important;letter-spacing:1px!important}}@media(max-width:360px){.ms-report .ms-pillar-cell{display:none!important}.ms-report .ms-iq-value-cell{padding-right:0!important}}@media print{.ms-report .ms-sheet{break-after:page;border:0!important;box-shadow:none!important}.ms-report{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
    <div class="ms-report" style="color:${c.ink};font-family:'DM Sans','Noto Sans KR',Arial,sans-serif;line-height:1.6;text-align:left">
    <section class="ms-sheet" style="padding:38px;background:${c.paper};border:1px solid ${c.line};border-radius:4px;margin-bottom:20px">
      <table role="presentation" width="100%" style="margin-bottom:34px"><tr><td style="font-size:24px;letter-spacing:-1px;font-weight:800;color:${c.ink}">mindscope<span style="color:${c.violet}">.</span></td><td class="ms-brandline" align="right" style="font-size:9px;letter-spacing:2px;color:${c.muted}">${e(copy.archive)}</td></tr></table>
      ${eyebrow(`01 / ${copy.overview}`)}<h1 class="ms-hero-title" style="font-size:40px;font-weight:700;line-height:1.25;margin:0 0 24px;white-space:pre-line;color:${c.ink}">${e(copy.coverTitle)}</h1>
      <div class="ms-hero" style="background:${c.dark};border-radius:14px;padding:30px;color:#fff">
        <p class="ms-iq-label" style="color:#fff;font-size:28px;font-weight:800;line-height:1.35;letter-spacing:-.5px;margin:0 0 12px">${e(copy.iq)}</p><table role="presentation" width="100%" style="table-layout:fixed"><tr><td class="ms-iq-value-cell" style="vertical-align:middle;padding-right:12px"><strong class="ms-iq-number" style="font-size:128px;line-height:1.2;font-weight:700;letter-spacing:-5px;color:#fff">${iq}</strong><p style="margin:12px 0 0;font-size:12px;color:#d7d7e1">${e(copy.score)} <strong style="color:#fff;font-size:18px">${score}</strong> / 100</p></td><td class="ms-pillar-cell" width="32%" style="vertical-align:middle">${pillars}</td></tr></table>
      </div>
      <p style="font-size:11px;line-height:1.8;margin:14px 0 26px;color:${c.muted}">${e(copy.shortNotice)}</p>
      ${eyebrow(copy.profileTitle)}<p style="margin:0 0 14px;font-size:11px;color:${c.muted}">${e(copy.profileNote)}</p>
      ${areas.map(area=>`<table role="presentation" width="100%" style="margin:12px 0;table-layout:fixed"><tr><td width="26" style="color:${area.color};font-size:10px;font-weight:700">0${area.index+1}</td><td style="font-size:12px;color:${c.ink};padding-right:12px">${e(area.title)}</td><td width="105">${segments(area)}</td><td width="35" align="right" style="font-size:12px;color:${area.color};font-weight:700">${area.level}/5</td></tr></table>`).join('')}
      <div style="margin-top:28px;padding:22px 0 0;border-top:1px solid ${c.line}">${eyebrow(copy.summaryTitle)}<p style="margin:0;font-size:13px;line-height:1.9;color:${c.ink}">${e(data.report.summary)}</p></div>
      <p style="margin:22px 0 0;font-size:9px;letter-spacing:1px;color:${c.muted}">${e(copy.recordRef)} &nbsp; ${reference}</p>${footer('01')}
    </section>
    <section class="ms-sheet" style="padding:38px;background:${c.paper};border:1px solid ${c.line};border-radius:4px">
      ${eyebrow(`02 / ${copy.areas}`)}<h2 style="font-size:30px;letter-spacing:-1px;line-height:1.3;margin:0 0 12px;color:${c.ink}">${e(copy.detailTitle)}</h2><p style="margin:0 0 24px;font-size:11px;color:${c.muted}">${e(copy.profileNote)}</p>
      ${areaCards}
      <div style="margin-top:28px;padding:24px;background:${c.lavender};border-radius:12px"><h3 style="font-size:16px;line-height:1.5;margin:0 0 18px;color:${c.ink}">${e(copy.methodTitle)}</h3><table role="presentation" width="100%" style="table-layout:fixed"><tr><td style="vertical-align:top;padding-right:12px"><strong style="font-size:30px;color:${c.violet}">80<span style="font-size:16px">%</span></strong><p style="font-size:11px;line-height:1.6;margin:3px 0 0">${e(copy.accuracyWeight)}</p></td><td style="vertical-align:top;border-left:1px solid #d9d0ef;padding-left:18px"><span style="font-size:9px;color:${c.muted}">${e(copy.upTo)}</span> <strong style="font-size:30px;color:${c.violet}">20<span style="font-size:16px">%</span></strong><p style="font-size:11px;line-height:1.6;margin:3px 0 0">${e(copy.paceWeight)}</p></td></tr></table><p style="font-size:11px;line-height:1.9;color:${c.muted};margin:18px 0 0">${e(copy.method)}</p></div>
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid ${c.line}">${eyebrow(copy.contextTitle)}<p style="font-size:11px;line-height:1.9;color:${c.muted};margin:0">${e(data.report.limitations)}</p></div>${footer('02')}
    </section></div>`;
  return {subject:`Mindscope — ${copy.title}`,text:reportBlocks(data).map(b=>b.text).join('\n\n'),html:`<!doctype html><html lang="${resolveLanguage(data.language)}"><body style="margin:0;padding:24px 10px;background:#eeede8"><main style="max-width:720px;margin:auto">${main}</main></body></html>`};
}

// The same palette, reference and data model drive HTML/email and canvas keepsakes.
export const reportTheme = Object.freeze({paper:'#fbfaf6',ink:'#242940',muted:'#73788b',line:'#e2e1da',violet:'#7964d8',lavender:'#eee9fb',green:'#438d80',sand:'#bb8c4e',dark:'#252a43'});
export function reportView(data) {
 const copy=reportCopy(data.language);
 const areas=(data.report.abilities??[]).map((area,index)=>{
  const level=Math.max(0,Math.min(5,Math.round(Number(area.level)||0)));
  return {...area,index,level,color:[reportTheme.violet,reportTheme.green,reportTheme.sand][index],assessment:abilityAssessment(level,data.language)};
 });
 const source=JSON.stringify([data.result.iq,data.result.score,areas.map(a=>[a.title,a.level,a.evidence])]);
 let hash=2166136261;for(const char of source)hash=Math.imul(hash^char.codePointAt(0),16777619)>>>0;
 return {copy,areas,reference:`MS-${hash.toString(16).toUpperCase().padStart(8,'0')}`,iq:Math.round(data.result.iq),score:data.result.score.toFixed(2)};
}
