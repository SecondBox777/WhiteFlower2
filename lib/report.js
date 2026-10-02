import { buildAbilityLevels } from './ability-levels.js';
import { itemMetadata } from './item-metadata.js';
import { buildPerformance } from './performance.js';
import { instructions } from './report-prompt.js';
export { instructions };
import { scoringItems, scoreTest, speedFactor, MIN_RESPONSE_RATIO, LIMIT_SECONDS } from '../scoring.js';

export function validateSubmission(data) {
  if (!data || !Array.isArray(data.answers) || data.answers.length !== 30 ||
      !Array.isArray(data.seconds) || data.seconds.length !== 30 ||
      data.answers.some(a => a !== null && (!Number.isInteger(a) || a < 0 || a > 3)) ||
      data.seconds.some(t => !Number.isFinite(t) || t < 0 || t > LIMIT_SECONDS) ||
      data.seconds.reduce((a,b) => a+b,0) > LIMIT_SECONDS + 0.01 ||
      (data.expiredIndex !== null && (!Number.isInteger(data.expiredIndex) || data.expiredIndex < 0 || data.expiredIndex > 29)) ||
      !['ko', 'en'].includes(data.language) || data.consent !== true || (data.experimental !== undefined && typeof data.experimental !== 'boolean')) {
    throw new Error('Invalid submission');
  }
  if (data.expiredIndex !== null && data.seconds.reduce((a,b)=>a+b,0) < LIMIT_SECONDS - 1) throw new Error('Invalid timeout');
  return { answers: data.answers, seconds: data.seconds, expiredIndex: data.expiredIndex, language: data.language, experimental: data.experimental === true };
}
export function buildAnalysis(data) {
  const result = scoreTest(data.answers, data.seconds, data.expiredIndex);
  const items = scoringItems.map((q, i) => {
    const excluded = i === data.expiredIndex ? 'time_limit' : data.answers[i] === null ? 'unanswered' : data.seconds[i] < q.referenceSeconds * MIN_RESPONSE_RATIO ? 'too_fast' : null;
    const correct = data.answers[i] === 'ABCD'.indexOf(q.answer);
    const time_ratio = data.seconds[i] / q.referenceSeconds;
    const pace = time_ratio <= 0.75 ? 'fast' : time_ratio <= 1.25 ? 'typical' : 'slow';
    return { ...itemMetadata[i], position:i+1, domain_position:i%10+1,
      selected: data.answers[i] === null ? null : 'ABCD'[data.answers[i]], correct, excluded,
      seconds: data.seconds[i], reference_seconds: q.referenceSeconds,
      reference_source:'existing_synthetic_model_not_observed_median',
      time_ratio:Math.round(time_ratio*1000)/1000,
      relative_time_percent:Math.round((time_ratio-1)*1000)/10,
      response_style:excluded ? 'excluded' : `${pace}_${correct?'correct':'incorrect'}`,
      points:q.points, earned:!excluded && correct ? q.points*(.8+.2*speedFactor(time_ratio)) : 0 };

  });
  const domains = ['pattern','logic','spatial'].map(domain => {
    const rows=items.filter(q=>q.domain===domain);
    return { domain, count: rows.length, correct: rows.filter(q=>q.correct&&!q.excluded).length, excluded: rows.filter(q=>q.excluded).length, score: rows.reduce((n,q)=>n+q.earned,0), max_points: rows.reduce((n,q)=>n+q.points,0), seconds: rows.reduce((n,q)=>n+q.seconds,0) };
  });
  return { ability_levels:buildAbilityLevels(domains,data.language), ability_criteria:{source:'product_defined_not_empirical_population_norms',bands:'0–4 needs development; 5–6 typical; 7–8 strong; 9–10 very strong; counts exclude invalid responses'}, performance:buildPerformance(items), metadata_version:'visual-review-v1', experimental: data.experimental === true, version: 'anchor110-speed05-analysis-v2', language: data.language, validity: 'synthetic_preliminary_not_validated', calibration: { ability_anchor_iq:110, anchor_mean_score:40.997574, population_iq_mean:100, population_iq_sd:15, time_limit_seconds:1800, note:'30-minute limit and 5% minimum-time rule change baseline scoring; no recalibration has been performed. Domains are provisional, not validated subscales. Timings are client-reported.' }, result, domains, items };
}
const object = properties => ({ type:'object', additionalProperties:false, properties, required:Object.keys(properties) });
const string = { type:'string' };
const finding=object({ title:string, evidence:string, advice:string });
export const reportSchema=object({ summary:string, problem_solving:{type:'array',maxItems:3,items:finding}, cognitive_characteristics:{type:'array',maxItems:3,items:object({title:string,assessment:string,evidence:string})}, careers:{type:'array',maxItems:2,items:object({field:string,required_abilities:string})}, limitations:string });
export function validReport(report) {
  const text=x=>typeof x==='string' && x.length>0 && x.length<=8000;
  const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join()===keys.slice().sort().join();
  if (!exact(report,Object.keys(reportSchema.properties)) || !text(report.summary)||!text(report.limitations)) return false;
  for(const key of ['problem_solving','cognitive_characteristics','careers']) {
    const keys=Object.keys(reportSchema.properties[key].items.properties);
    if(!Array.isArray(report[key])||report[key].length>reportSchema.properties[key].maxItems||report[key].some(x=>!exact(x,keys)||keys.some(k=>!text(x[k]))))return false;
  }
  return true;
}
