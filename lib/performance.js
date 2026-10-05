// Descriptive within-test indicators. No population percentiles or personality scores.
const round = x => Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null;
const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
const median = xs => {
 if(!xs.length)return null;
 const sorted=xs.slice().sort((a,b)=>a-b), m=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2;
};
export function summarize(rows) {
 const valid=rows.filter(q=>!q.excluded), correct=valid.filter(q=>q.correct), wrong=valid.filter(q=>!q.correct);
 const ratios=valid.map(q=>q.time_ratio), avg=mean(ratios);
 return {
  item_ids:rows.map(q=>q.id), count:rows.length, valid_count:valid.length, excluded_count:rows.length-valid.length,
  correct_count:correct.length, accuracy:valid.length?round(correct.length/valid.length):null,
  median_time_ratio:round(median(ratios)), correct_median_time_ratio:round(median(correct.map(q=>q.time_ratio))),
  incorrect_median_time_ratio:round(median(wrong.map(q=>q.time_ratio))),
  time_ratio_sd:ratios.length>=2?round(Math.sqrt(mean(ratios.map(x=>(x-avg)**2)))):null,
  incorrect_time_seconds:round(wrong.reduce((sum,q)=>sum+q.seconds,0)),
  difficulty_weighted_accuracy:valid.length?round(correct.reduce((s,q)=>s+q.difficulty,0)/valid.reduce((s,q)=>s+q.difficulty,0)):null,
  difficulty_speed_efficiency:valid.length?round(correct.reduce((s,q)=>s+q.difficulty*Math.min(1,1/q.time_ratio),0)/valid.reduce((s,q)=>s+q.difficulty,0)):null
 };
}
function grouped(items, key) {
 return [...new Set(items.map(q=>q[key]))].map(value=>({[key]:value,...summarize(items.filter(q=>q[key]===value))}));
}
export function buildPerformance(items) {
 const valid=items.filter(q=>!q.excluded);
 const styles=['fast_correct','fast_incorrect','typical_correct','typical_incorrect','slow_correct','slow_incorrect'];
 const speed_accuracy=styles.map(style=>({style,...summarize(valid.filter(q=>q.response_style===style))}));
 const skillNames=[...new Set(items.flatMap(q=>q.skills))];
 const skills=skillNames.map(skill=>({skill,...summarize(items.filter(q=>q.skills.includes(skill)))}));
 const by_difficulty=grouped(items,'difficulty');
 const easy=valid.filter(q=>q.difficulty<=2), hard=valid.filter(q=>q.difficulty>=4);
 const difficulty_contrasts=grouped(items,'domain').map(({domain})=>({domain,
  easy:summarize(items.filter(q=>q.domain===domain&&q.difficulty<=2)),
  hard:summarize(items.filter(q=>q.domain===domain&&q.difficulty>=4))
 }));
 // Q01–15 vs Q16–30 are item-order slices, not actual visit chronology.
 const order_slices=[{slice:'Q01-Q15',...summarize(items.slice(0,15))},{slice:'Q16-Q30',...summarize(items.slice(15))}];
 const matched_order=[];
 for(const domain of ['pattern','logic','spatial'])for(let difficulty=1;difficulty<=5;difficulty++) {
  const early=valid.filter(q=>q.domain===domain&&q.difficulty===difficulty&&q.domain_position<=5);
  const late=valid.filter(q=>q.domain===domain&&q.difficulty===difficulty&&q.domain_position>5);
  if(early.length>=2&&late.length>=2)matched_order.push({domain,difficulty,early:summarize(early),late:summarize(late),
   accuracy_change:round(late.filter(q=>q.correct).length/late.length-early.filter(q=>q.correct).length/early.length),
   median_ratio_change:round(median(late.map(q=>q.time_ratio))-median(early.map(q=>q.time_ratio))) });
 }
 return {
  definitions:{time_ratio:'클라이언트 누적 풀이시간(초) / 내부 기준시간(초); 모집단 중앙값이 아님',
   speed_bands:'빠름(fast): 0.75 이하; 보통(typical): 0.75 초과 1.25 이하; 느림(slow): 1.25 초과',
   accuracy:'정답 수 / 유효 응답 수; 제외된 응답은 오답으로 세지 않음',
   difficulty:'검토자가 부여한 과제 복잡도 1~5; 쉬움 1~2, 보통 3, 어려움 4~5',
   difficulty_speed_efficiency:'합계(정답 여부 * 난이도 * min(1, 1/시간비율)) / 합계(유효 응답의 난이도); 0~1 범위의 기술 지표이며 인지 능력 척도가 아님',
   order:'문항 순서만 의미함; 재방문 및 화면을 떠난 시간이 포함됨. 영역과 난이도가 달라 피로나 인과 효과를 분리할 수 없음',
   skills:'서로 겹치는 과제 요구 능력 묶음이며 독립적으로 측정한 능력이 아님'},
  overall:summarize(items), by_domain:grouped(items,'domain'), by_subtype:grouped(items,'subtype'), by_difficulty, skills,
  by_domain_difficulty:['pattern','logic','spatial'].flatMap(domain=>grouped(items.filter(q=>q.domain===domain),'difficulty').map(group=>({domain,...group}))),
  speed_accuracy, difficulty_contrasts, order_slices, matched_order,
  notable_items:{easy_incorrect:easy.filter(q=>!q.correct).map(q=>q.id),hard_correct:hard.filter(q=>q.correct).map(q=>q.id),
   fast_incorrect:valid.filter(q=>q.response_style==='fast_incorrect').map(q=>q.id),
   slow_correct:valid.filter(q=>q.response_style==='slow_correct').map(q=>q.id),
   slow_incorrect:valid.filter(q=>q.response_style==='slow_incorrect').map(q=>q.id)},
  evidence_quality:{valid_count:valid.length, excluded_count:items.length-valid.length,
   empirical_norms_available:false, actual_visit_order_available:false, item_content_available:'검토된 과제 설명과 태그만 제공하며 이미지는 없음'},
  // Descriptive comparisons with sample counts; model must not claim spending time caused accuracy.
  time_allocation:{correct:summarize(valid.filter(q=>q.correct)),incorrect:summarize(valid.filter(q=>!q.correct)),
   within_difficulty:by_difficulty.map(({difficulty})=>({difficulty,
    correct:summarize(valid.filter(q=>q.difficulty===difficulty&&q.correct)),
    incorrect:summarize(valid.filter(q=>q.difficulty===difficulty&&!q.correct))}))}
 };
}
