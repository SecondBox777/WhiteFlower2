// 실제 보고서 전송 경로의 요청을 로컬에서 가로채 예시를 저장합니다. 외부 API를 호출하지 않습니다.
import { mkdir, writeFile } from 'node:fs/promises';
import { handleReport } from '../lib/analyze.js';
import { scoringItems, speedFactor } from '../scoring.js';

const wrong = new Set([7, 10, 18, 23, 25, 27, 28, 30]);
const seconds = [12, 14, 18, 22, 28, 45, 20, 42, 95, 110, 16, 12, 15, 20, 24, 60, 80, 95, 100, 105, 40, 25, 50, 55, 65, 85, 90, 100, 80, 70];
const submission = {
  answers: scoringItems.map((q, i) => {
    const answer = 'ABCD'.indexOf(q.answer);
    return wrong.has(i + 1) ? (answer + 1) % 4 : answer;
  }),
  seconds, expiredIndex: null, language: 'ko', consent: true, experimental: true
};
let captured;
await handleReport({
  request: new Request('https://example.com/api/analyze', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(submission)
  }),
  // 예시 추출 전용 설정. 실제 배포의 보고서 차단 설정이나 비밀키는 사용하거나 변경하지 않습니다.
  env: {OPENAI_API_KEY: 'local-placeholder', OPENAI_MODEL: 'gpt-6-sol'}
}, async (url, options) => {
  captured = {url, method: options.method, body: JSON.parse(options.body)};
  return new Response('', {status: 503});
});
if (!captured) throw new Error('요청을 추출하지 못했습니다.');
const analysis = JSON.parse(captured.body.input);
const output = new URL('../docs/examples/', import.meta.url);
await mkdir(output, {recursive: true});
const pretty = value => JSON.stringify(value, null, 2);
await writeFile(new URL('report-submission.json', output), pretty(submission) + '\n');
await writeFile(new URL('openai-request.json', output), pretty(captured.body) + '\n');
const rows = analysis.items.map((q, i) => `| ${q.id} | ${'ABCD'[submission.answers[i]]} | ${scoringItems[i].answer} | ${q.correct ? '정답' : '오답'} | ${q.seconds} | ${q.reference_seconds} | ${speedFactor(q.seconds / q.reference_seconds)} | ${q.earned.toFixed(2)} |`).join('\n');
const document = `# 가상 응시 결과와 OpenAI 전송 전문

실제 사람이 아닌 가상 응시자 1명의 예시입니다. 30문항을 모두 응답했으며 시간초과나 제외 응답은 없습니다. experimental=true로 시연 데이터임을 전달합니다. 실제 사람의 일반 응시는 experimental=false입니다. 외부 API 호출 없이 lib/analyze.js의 실제 전송 경로에서 요청 본문을 추출했습니다. 실제 배포의 AI 보고서 차단은 유지됩니다.

## 채점 결과

- 정답: ${analysis.result.correct}/30
- 총 풀이시간: ${seconds.reduce((a,b)=>a+b,0)}초
- 점수: ${analysis.result.score.toFixed(2)}/100 (원본 값: ${analysis.result.score})
- 예비 IQ: ${analysis.result.iq} (화면 표시: ${Math.round(analysis.result.iq)})
${analysis.domains.map(d => `- ${{pattern:'패턴',logic:'논리',spatial:'공간'}[d.domain]}: ${d.correct}/10 정답, ${d.score.toFixed(2)}/${d.max_points}점, ${d.seconds}초`).join('\n')}

정답이고 제외되지 않은 문항의 점수 = 배점 × (0.8 + 0.2 × 속도계수). 오답은 0점입니다. 속도계수는 풀이시간/기준시간 비율이 0.4 이하이면 1, 0.65 이하이면 0.9, 1 이하이면 0.75, 1.5 이하이면 0.5, 2 이하이면 0.25, 그보다 크면 0입니다. 기준시간의 5% 미만인 응답, 미응답, 시간초과 문항은 제외합니다.

IQ = 79.76334234199149 + 0.6930466663250522 × 점수

IQ는 서버에서 계산하여 전달합니다. OpenAI가 IQ를 산출하지 않습니다. 인지 영역의 평가 문장도 서버에서 미리 정해 전달하며, 모델 응답 후 서버가 다시 적용합니다. 이 예비 IQ 식은 합성 자료 기반입니다.

| 문항 | 선택 | 정답 | 결과 | 풀이시간(초) | 기준시간(초) | 속도계수 | 획득점수 |
|---|---|---|---|---:|---:|---:|---:|
${rows}

## 전송 구성

POST ${captured.url}

model은 저장소의 wrangler.jsonc 기준 gpt-6-sol로 생성했습니다. 실제 운영에서는 OPENAI_MODEL 런타임 값이 사용됩니다. Authorization 헤더에는 비밀키가 들어가므로 이 문서에는 포함하지 않습니다. instructions는 아래 지시문 문자열, input은 아래 입력 JSON을 JSON.stringify로 직렬화한 문자열입니다. openai-request.json에는 이 문자열 형태까지 포함한 요청 본문 전체가 있습니다. 출력 스키마와 모든 입력 필드를 생략 없이 아래에 표시합니다.

## instructions: 한글 지시문 전문

\`\`\`text
${captured.body.instructions}
\`\`\`

## input: OpenAI에 전달하는 입력 데이터 전문

\`\`\`json
${pretty(analysis)}
\`\`\`

## 나머지 요청 설정 및 출력 스키마 전문

\`\`\`json
${pretty(Object.fromEntries(Object.entries(captured.body).filter(([key]) => !['instructions','input'].includes(key))))}
\`\`\`
`;
await writeFile(new URL('openai-report-full.md', output), document);
console.log(pretty({result:analysis.result, total_seconds:seconds.reduce((a,b)=>a+b,0),domains:analysis.domains,files:['docs/examples/report-submission.json','docs/examples/openai-request.json','docs/examples/openai-report-full.md']}));
