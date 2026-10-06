// Product-defined correct-count bands, not observed population norms.
const abilities = {
 ko:['패턴 퍼즐','논리 퍼즐','공간 퍼즐'],
 en:['Pattern puzzles','Logic puzzles','Spatial puzzles']
};
const tasks = {
 ko:['도형의 규칙을 찾는 문제','여러 조건을 연결해 결론을 찾는 문제','전개도를 접어 입체 모양을 판단하는 문제'],
 en:['visual pattern problems','logical reasoning problems','cube-net folding problems']
};
export function buildAbilityLevels(domains, language='ko') {
 const names=abilities[language]??abilities.ko;
 return domains.map((domain,i)=>{
  const level=domain.count===domain.excluded?'insufficient':domain.correct>=9?'very_strong':domain.correct>=7?'strong':domain.correct>=5?'typical':'needs_development';
  const assessment = language==='en'
   ? `${names[i]}: ${domain.correct}/${domain.count} correct; ${domain.excluded} excluded. This describes these puzzles only.`
   : `${names[i]}: ${domain.count}개 중 ${domain.correct}개 정답, ${domain.excluded}개 제외. 이 퍼즐의 결과만 나타냅니다.`;
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
