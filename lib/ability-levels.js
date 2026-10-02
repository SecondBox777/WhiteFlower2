// Product-defined correct-count bands, not observed population norms.
const abilities = {
 ko:['패턴인지능력','논리추론능력','공간지각능력'],
 en:['Pattern recognition','Logical reasoning','Spatial visualization']
};
const tasks = {
 ko:['도형의 규칙을 찾는 문제','여러 조건을 연결해 결론을 찾는 문제','전개도를 접어 입체 모양을 판단하는 문제'],
 en:['visual pattern problems','logical reasoning problems','cube-net folding problems']
};
export function buildAbilityLevels(domains, language='ko') {
 const names=abilities[language]??abilities.ko;
 return domains.map((domain,i)=>{
  const level=domain.count===domain.excluded?'insufficient':domain.correct>=9?'very_strong':domain.correct>=7?'strong':domain.correct>=5?'typical':'needs_development';
  let assessment;
  if(language==='en') {
   const descriptions={very_strong:'is very strong',strong:'is strong',typical:'falls in the typical band',needs_development:'needs development',insufficient:'cannot be classified without valid responses'};
   assessment=`Under the internally defined criteria, ${names[i].toLowerCase()} ${descriptions[level]}.`;
  } else {
   const descriptions={very_strong:'매우 뛰어납니다',strong:'뛰어납니다',typical:'남들과 비슷한 편으로 분류됩니다',needs_development:'보완이 필요합니다',insufficient:'유효 응답이 없어 분류할 수 없습니다'};
   assessment=`내부적으로 상정된 기준에서 ${names[i]}${level==='needs_development'?'은':'이'} ${descriptions[level]}.`;
  }
  return {domain:domain.domain,title:names[i],correct:domain.correct,total:domain.count,excluded:domain.excluded,level,assessment};
 });
}
export function applyAbilityLevels(report, analysis) {
 const language=analysis.language;
 return {...report,cognitive_characteristics:analysis.ability_levels.map((ability,i)=>({
  title:ability.title,assessment:ability.assessment,
  evidence:report.cognitive_characteristics.find(finding=>finding.title===ability.title)?.evidence ??
   (language==='en'?`This classification summarizes performance on ${tasks.en[i]}.`:`${tasks.ko[i]}에서 나타난 결과를 바탕으로 한 내부 기준 분류입니다.`)
 }))};
}
