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
  definitions:{time_ratio:'cumulative client seconds / internal reference seconds; not population median',
   speed_bands:'fast <=0.75; typical >0.75 to <=1.25; slow >1.25',
   accuracy:'correct / valid responses; excluded responses never count as errors',
   difficulty:'editorial 1–5 task complexity; easy 1–2, medium 3, hard 4–5',
   difficulty_speed_efficiency:'sum(correct * difficulty * min(1, 1/time_ratio)) / sum(valid difficulty), 0–1 descriptive index, not a cognitive ability scale',
   order:'item order only; revisits and time away are included. Domain/difficulty vary; fatigue and causal effects cannot be isolated',
   skills:'overlapping task demand groups, not independent measured abilities'},
  overall:summarize(items), by_domain:grouped(items,'domain'), by_subtype:grouped(items,'subtype'), by_difficulty, skills,
  by_domain_difficulty:['pattern','logic','spatial'].flatMap(domain=>grouped(items.filter(q=>q.domain===domain),'difficulty').map(group=>({domain,...group}))),
  speed_accuracy, difficulty_contrasts, order_slices, matched_order,
  notable_items:{easy_incorrect:easy.filter(q=>!q.correct).map(q=>q.id),hard_correct:hard.filter(q=>q.correct).map(q=>q.id),
   fast_incorrect:valid.filter(q=>q.response_style==='fast_incorrect').map(q=>q.id),
   slow_correct:valid.filter(q=>q.response_style==='slow_correct').map(q=>q.id),
   slow_incorrect:valid.filter(q=>q.response_style==='slow_incorrect').map(q=>q.id)},
  evidence_quality:{valid_count:valid.length, excluded_count:items.length-valid.length,
   empirical_norms_available:false, actual_visit_order_available:false, item_content_available:'reviewed text descriptions and task tags, no images'},
  // Descriptive comparisons with sample counts; model must not claim spending time caused accuracy.
  time_allocation:{correct:summarize(valid.filter(q=>q.correct)),incorrect:summarize(valid.filter(q=>!q.correct)),
   within_difficulty:by_difficulty.map(({difficulty})=>({difficulty,
    correct:summarize(valid.filter(q=>q.difficulty===difficulty&&q.correct)),
    incorrect:summarize(valid.filter(q=>q.difficulty===difficulty&&!q.correct))}))}
 };
}
