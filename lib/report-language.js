// Fallback for accidental item IDs in model prose; internal analysis keeps IDs.
const labels = {
 ko:['도형의 규칙을 찾는 문제','논리적 추론을 요구하는 문제','전개도를 접어 입체 모양을 판단하는 문제'],
 ja:['図形の規則の問題','論理推論の問題','立方体の展開図の問題'],
 'zh-CN':['图形规律题','逻辑推理题','正方体展开图题'],
 es:['problemas de patrones visuales','problemas de lógica','problemas de plegado de cubos'],
 fr:['énigmes de motifs visuels','énigmes logiques','énigmes de patrons de cubes'],
 en:['visual pattern problems','logical reasoning problems','cube-net folding problems']
};
export function replaceQuestionReferences(report, language) {
 const names=labels[language]??labels.en;
 const label=ids=>[...new Set(ids.map(id=>names[Math.floor((Number(id)-1)/10)]))].filter(Boolean).join(({ko:'와 ',en:' and ',ja:'・','zh-CN':'、',es:' y ',fr:' et '})[language]??', ');
 const number='(?:0?[1-9]|[12]\\d|30)';
 const range=new RegExp(`\\bQ(${number})\\s*[-–—~～]\\s*Q?(${number})(?!\\d)`,'gi');
 const group=new RegExp(`\\bQ${number}(?!\\d)(?:\\s*[,·/、&]\\s*Q${number}(?!\\d))*`,'gi');
 const rewrite=text=>text.replace(range,(_,a,b)=>{
  const first=Number(a),last=Number(b);
  return label(Array.from({length:Math.abs(last-first)+1},(_,i)=>Math.min(first,last)+i));
 }).replace(group,match=>label([...match.matchAll(/Q(\d+)/gi)].map(m=>m[1])));
 const visit=value=>typeof value==='string'?rewrite(value):Array.isArray(value)?value.map(visit):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,visit(entry)])):value;
 return visit(report);
}
