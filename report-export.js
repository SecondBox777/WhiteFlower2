import { reportBlocks } from './report-content.js';

// Draw the full report, including its limitations, without sending it to a third party.
// Very long reports are split into PNG pages to stay within mobile canvas limits.
export async function createReportImages(data) {
  await document.fonts?.ready;
  const width=1000, margin=64, maxHeight=10000;
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('이 브라우저에서 사진 저장을 지원하지 않습니다.');
  const styles={title:[34,700,'#222437'],iq:[44,800,'#7360d8'],heading:[30,700,'#7360d8'],subheading:[26,700,'#222437'],body:[24,400,'#222437'],muted:[21,400,'#777b8d']};
  const pages=[];
  let lines=[],y=140;
  const finish=()=>{if(lines.length)pages.push({lines,height:Math.ceil(y+90)});lines=[];y=140;};
  for(const block of reportBlocks(data)) {
    const [size,weight,color]=styles[block.kind];
    ctx.font=`${weight} ${size}px "Noto Sans KR", Arial, sans-serif`;
    const lineHeight=Math.ceil(size*1.65);
    const gap=['heading','subheading'].includes(block.kind)?26:18;
    const wrapped=wrapText(block.text,text=>ctx.measureText(text).width,width-margin*2);
    if(y+gap+Math.min(wrapped.length,2)*lineHeight>maxHeight-100)finish();
    y+=gap;
    for(const text of wrapped) {
      if(y+lineHeight>maxHeight-100)finish();
      lines.push({text,y,size,weight,color});y+=lineHeight;
    }
  }
  finish();
  const files=[];
  for(const [index,page] of pages.entries()) {
    canvas.width=width;canvas.height=page.height;
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,page.height);
    ctx.fillStyle='#7360d8';ctx.fillRect(0,0,width,12);
    ctx.font='800 30px Arial, sans-serif';ctx.fillText('mindscope.',margin,76);
    ctx.textBaseline='top';
    for(const line of page.lines) {
      ctx.font=`${line.weight} ${line.size}px "Noto Sans KR", Arial, sans-serif`;
      ctx.fillStyle=line.color;ctx.fillText(line.text,margin,line.y);
    }
    ctx.font='400 18px Arial, sans-serif';ctx.fillStyle='#777b8d';
    ctx.fillText(`Mindscope · ${index+1} / ${pages.length}`,margin,page.height-46);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('사진을 만들지 못했습니다. 다시 시도해 주세요.')),'image/png'));
    files.push(new File([blob],`mindscope-report${pages.length>1?`-${index+1}`:''}.png`,{type:'image/png'}));
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
