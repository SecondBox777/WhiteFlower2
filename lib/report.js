import { isLanguage } from '../i18n.js';
import { reportCopy, formatCopy } from '../report-locales.js';
import { buildAbilityLevels } from './ability-levels.js';
import { itemMetadata } from './item-metadata.js';
import { buildPerformance } from './performance.js';
import { scoringItems, scoreTest, speedFactor, MIN_RESPONSE_RATIO, LIMIT_SECONDS } from '../scoring.js';

export function validateSubmission(data) {
  if (!data || !Array.isArray(data.answers) || data.answers.length !== 30 ||
      !Array.isArray(data.seconds) || data.seconds.length !== 30 ||
      data.answers.some(a => a !== null && (!Number.isInteger(a) || a < 0 || a > 3)) ||
      data.seconds.some(t => !Number.isFinite(t) || t < 0 || t > LIMIT_SECONDS) ||
      data.seconds.reduce((a,b) => a+b,0) > LIMIT_SECONDS + 0.01 ||
      (data.expiredIndex !== null && (!Number.isInteger(data.expiredIndex) || data.expiredIndex < 0 || data.expiredIndex > 29)) ||
      !isLanguage(data.language) || data.consent !== true || (data.experimental !== undefined && typeof data.experimental !== 'boolean')) {
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
  return { ability_levels:buildAbilityLevels(domains,data.language), ability_criteria:{source:'product_defined_not_empirical_population_norms',bands:'0~4개: 보완 필요; 5~6개: 보통; 7~8개: 뛰어남; 9~10개: 매우 뛰어남; 유효하지 않은 응답은 정답 수에서 제외'}, performance:buildPerformance(items), metadata_version:'visual-review-v1', experimental: data.experimental === true, version: 'anchor110-speed05-analysis-v2', language: data.language, validity: 'synthetic_preliminary_not_validated', calibration: { ability_anchor_iq:110, anchor_mean_score:40.997574, population_iq_mean:100, population_iq_sd:15, time_limit_seconds:1800, note:'30분 제한과 기준시간의 5% 미만 응답 제외 규칙이 기본 채점을 변경했으며 재보정은 수행하지 않았습니다. 영역 분류는 잠정적이며 검증된 하위 척도가 아닙니다. 풀이시간은 클라이언트가 보고한 값입니다.' }, result, domains, items };
}
export const entertainmentNotice = language => reportCopy(language).notice;

export function buildReport(analysis) {
  const copy=reportCopy(analysis.language);
  return {
    version:'entertainment-v2', summary:copy.summary,
    abilities:analysis.domains.map((d,i)=>({
      title:copy.names[i], level:Math.max(0,Math.min(5,Math.round(5*d.score/d.max_points))),
      evidence:formatCopy(copy.evidence,{score:d.score.toFixed(2),max:d.max_points,seconds:Math.round(d.seconds)})
    })), limitations:copy.notice
  };
}
export function validReport(r) {
  return r?.version === 'entertainment-v2' && typeof r.summary === 'string' && typeof r.limitations === 'string' &&
    Array.isArray(r.abilities) && r.abilities.length === 3 && r.abilities.every(a => typeof a.title==='string' && Number.isInteger(a.level) && a.level>=0 && a.level<=5 && typeof a.evidence==='string') &&
    !('items' in r);
}
