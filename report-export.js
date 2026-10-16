import { translate } from './i18n.js';
import { reportView, reportTheme } from './report-content.js';

// Draw the full report, including its limitations, without sending it to a third party.
// Very long reports are split into PNG pages to stay within mobile canvas limits.
export async function createReportImages(data) {
  await document.fonts?.ready;
  const {copy,areas,reference,iq,score}=reportView(data),c=reportTheme;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  if(!ctx)throw new Error(translate('이 브라우저에서 사진 저장을 지원하지 않습니다.',data.language));
  const width=1000,margin=64,bodyWidth=872,bottom=1770;
  const pages=[];let page;
  const font=(size,weight=400)=>`${weight} ${size}px "DM Sans", "Noto Sans KR", Arial, sans-serif`;
  function rounded(context,x,y,w,h,r=16) {context.beginPath();context.roundRect(x,y,w,h,r);}
  const box=(x,y,w,h,color,r=16,stroke=null)=>page.ops.push(context=>{rounded(context,x,y,w,h,r);context.fillStyle=color;context.fill();if(stroke){context.strokeStyle=stroke;context.lineWidth=1;context.stroke();}});
  const line=(x,y,w,color=c.line)=>page.ops.push(context=>{context.beginPath();context.moveTo(x,y);context.lineTo(x+w,y);context.strokeStyle=color;context.lineWidth=1;context.stroke();});
  const text=(value,x,y,size=22,weight=400,color=c.ink)=>page.ops.push(context=>{context.font=font(size,weight);context.fillStyle=color;context.textBaseline='top';context.fillText(String(value),x,y);});
  const measure=(value,size,maxWidth,weight=400)=>{ctx.font=font(size,weight);return wrapText(value,t=>ctx.measureText(t).width,maxWidth);};
  function newPage() {page={ops:[],y:142};pages.push(page);text('mindscope.',margin,50,30,800);text(reference,700,60,14,500,c.muted);line(margin,106,bodyWidth);}
  const ensure=height=>{if(page.y+height>bottom)newPage();};
  function paragraph(value,{size=22,weight=400,color=c.ink,x=margin,maxWidth=bodyWidth,leading=1.65,gap=18}={}) {
    const rows=measure(value,size,maxWidth,weight),height=Math.ceil(size*leading);
    for(const row of rows){ensure(height);text(row,x,page.y,size,weight,color);page.y+=height;}
    page.y+=gap;
  }
  function label(value){paragraph(value,{size:16,weight:700,color:c.muted,leading:1.5,gap:12});}
  function segments(area,x,y,w,h=10) {const gap=7,segment=(w-4*gap)/5;for(let i=0;i<5;i++)box(x+i*(segment+gap),y,segment,h,i<area.level?area.color:'#e6e4dd',3);}
  newPage();
  label(copy.archive);paragraph(copy.coverTitle,{size:62,weight:700,leading:1.18,gap:30});
  ensure(326);let top=page.y;
  box(margin,top,bodyWidth,326,c.dark,22);
  const iqLabel=measure(copy.iq,20,460,500);
  iqLabel.forEach((row,i)=>text(row,margin+36,top+30+i*27,20,500,'#cbc5e5'));
  text(iq,margin+30,top+74,164,700,'#ffffff');
  text(`${copy.score}  ${score} / 100`,margin+36,top+268,21,500,'#dedbea');
  const pillarX=662,pillarTop=top+64,pillarColors=['#b4a3ff','#8ec8ba','#dfbc87'];
  areas.forEach(area=>{for(let i=0;i<5;i++)box(pillarX+area.index*76,pillarTop+i*35,55,27,5-i<=area.level?pillarColors[area.index]:'#3c4159',5);text(`0${area.index+1}`,pillarX+area.index*76+16,pillarTop+194,16,500,'#d7d7e1');});
  page.y+=350;paragraph(copy.shortNotice,{size:18,color:c.muted,gap:24});
  label(`01 / ${copy.overview}`);paragraph(copy.profileTitle,{size:29,weight:700,leading:1.35,gap:10});paragraph(copy.profileNote,{size:17,color:c.muted,gap:18});
  for(const area of areas) {
    const names=measure(area.title,22,480,500),height=Math.max(60,names.length*29+18);ensure(height);
    top=page.y;text(`0${area.index+1}`,margin,top+4,16,700,area.color);
    names.forEach((row,i)=>text(row,margin+45,top+i*29,22,500));segments(area,660,top+12,190);text(`${area.level}/5`,878,top+3,22,700,area.color);page.y+=height;
  }
  page.y+=8;line(margin,page.y,bodyWidth);page.y+=24;label(copy.summaryTitle);paragraph(data.report.summary,{size:22,gap:20});
  paragraph(`${copy.recordRef}  ${reference}`,{size:15,color:c.muted,gap:0});
  newPage();
  label(`02 / ${copy.areas}`);paragraph(copy.detailTitle,{size:44,weight:700,leading:1.25,gap:16});paragraph(copy.profileNote,{size:18,color:c.muted,gap:20});
  for(const area of areas) {
    const names=measure(area.title,28,650,700),assessment=measure(area.assessment,22,790),evidence=measure(area.evidence,19,790);
    const height=116+names.length*36+assessment.length*35+evidence.length*31;
    ensure(Math.min(height,1100));top=page.y;const cardPage=page;
    // Normal cards stay intact. Unusually long prose continues safely on further pages.
    box(margin,top,bodyWidth,Math.min(height,bottom-top),'#ffffff',16,c.line);box(margin,top+16,5,Math.min(height-32,bottom-top-32),area.color,2);
    text(`0${area.index+1}`,margin+28,top+22,15,700,area.color);text(`${area.level}`,margin+760,top+21,42,700,area.color);text('/ 5',margin+804,top+42,17,500,c.muted);
    page.y=top+49;paragraph(area.title,{x:margin+28,maxWidth:650,size:28,weight:700,leading:1.28,gap:12});
    segments(area,margin+28,page.y,bodyWidth-56,10);page.y+=25;
    paragraph(area.assessment,{x:margin+28,maxWidth:790,size:22,leading:1.59,gap:8});
    paragraph(area.evidence,{x:margin+28,maxWidth:790,size:19,color:c.muted,leading:1.58,gap:22});
    page.y=(page===cardPage?Math.max(page.y,top+height):page.y)+18;
  }
  const methodTitle=measure(copy.methodTitle,27,790,700),method=measure(copy.method,19,790);
  const accuracy=measure(copy.accuracyWeight,18,340),pace=measure(copy.paceWeight,18,340);
  const methodHeight=145+methodTitle.length*36+Math.max(accuracy.length,pace.length)*27+method.length*31;
  ensure(Math.min(methodHeight,1100));top=page.y;box(margin,top,bodyWidth,Math.min(methodHeight,bottom-top),c.lavender,16);page.y+=26;
  paragraph(copy.methodTitle,{x:margin+28,maxWidth:790,size:27,weight:700,leading:1.3,gap:16});
  const weightsY=page.y;text('80%',margin+28,weightsY,43,700,c.violet);text(`${copy.upTo} 20%`,margin+455,weightsY,37,700,c.violet);
  const labelY=weightsY+55;
  accuracy.forEach((row,i)=>text(row,margin+28,labelY+i*27,18));pace.forEach((row,i)=>text(row,margin+455,labelY+i*27,18));
  page.y=labelY+Math.max(accuracy.length,pace.length)*27+18;
  paragraph(copy.method,{x:margin+28,maxWidth:790,size:19,color:c.muted,leading:1.58,gap:24});page.y+=24;
  ensure(100);line(margin,page.y,bodyWidth);page.y+=24;label(copy.contextTitle);paragraph(data.report.limitations,{size:18,color:c.muted,leading:1.65,gap:12});
  const files=[];
  for(const [index,sheet] of pages.entries()) {
    canvas.width=width;canvas.height=Math.max(1414,Math.ceil(Math.min(bottom,sheet.y)+112));
    ctx.fillStyle=c.paper;ctx.fillRect(0,0,width,canvas.height);
    ctx.fillStyle=c.violet;ctx.fillRect(0,0,width,7);
    for(const draw of sheet.ops)draw(ctx);
    ctx.strokeStyle=c.line;ctx.beginPath();ctx.moveTo(margin,canvas.height-74);ctx.lineTo(width-margin,canvas.height-74);ctx.stroke();
    ctx.font=font(14);ctx.fillStyle=c.muted;ctx.textBaseline='top';ctx.fillText(copy.footer,margin,canvas.height-52);
    ctx.textAlign='right';ctx.fillText(`${String(index+1).padStart(2,'0')} / ${String(pages.length).padStart(2,'0')}`,width-margin,canvas.height-52);ctx.textAlign='left';
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error(translate('사진을 만들지 못했습니다. 다시 시도해 주세요.',data.language))),'image/png'));
    files.push(new File([blob],`mindscope-report-${index+1}.png`,{type:'image/png'}));
  }
  return files;
}

export function wrapText(text,measure,maxWidth) {
  const lines=[];
  for(const paragraph of String(text).split('\n')) {
    let line='';
    // Word wrapping keeps English words intact; long words and Korean runs still wrap safely.
    for(const token of paragraph.match(/\s+|[^\s]+/gu)??[]) {
      if(line && measure(line+token)>maxWidth) {lines.push(line.trimEnd());line='';}
      if(measure(token)>maxWidth) {
        const parts=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(token)].map(x=>x.segment):Array.from(token);
        for(const part of parts) {
          if(line && measure(line+part)>maxWidth) {lines.push(line.trimEnd());line='';}
          line+=part;
        }
      } else line+=line?token:token.trimStart();
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
