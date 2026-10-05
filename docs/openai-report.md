# Workers + Static Assets로 AI 보고서 생성

프롬프트 수정은 [`lib/report-prompt.js`](../lib/report-prompt.js)에서 합니다. 지시문과 입력 지표의 설명 문장은 한국어이며, 코드와 연결되는 JSON 필드명·분류 식별자는 유지합니다. [가상 응시 결과와 전송 전문](examples/openai-report-full.md)에 한글 지시문, 30문항 입력 데이터, 출력 스키마를 생략 없이 기록했습니다. [요청 본문 JSON](examples/openai-request.json)은 실제 전송 형식이며, `node scripts/export-report-example.mjs`로 외부 호출 없이 다시 생성할 수 있습니다. 예시는 실험 데이터로 표시되고 운영 보고서 차단은 유지됩니다.

## 기존 GitHub 자동 배포 유지

현재 커밋의 원래 설정은 `whiteflower2` Workers 정적 배포입니다. Pages 설정 대신 Worker entry point를 추가했습니다. Dashboard 자체의 Git 연결/배포 명령은 저장소에서 조회할 수 없으므로 아래 항목을 확인하세요.

1. Workers & Pages → 기존 Worker → Settings → Build에서 GitHub 저장소, 배포 브랜치, 저장소 루트를 유지합니다.
2. 배포 명령은 `npx wrangler deploy`. `--assets .` 같은 저장소 전체 업로드 옵션이나 Pages 명령은 제거합니다. Wrangler가 `npm run build`를 실행하므로 Dashboard 빌드 명령은 비워도 됩니다. 기존 `npm run build`를 유지해도 기능에는 문제가 없지만 두 번 빌드됩니다.
3. `wrangler.jsonc`의 `name: whiteflower2`가 실제 기존 Worker 이름과 같은지 확인합니다.
4. 변경 파일을 GitHub 배포 브랜치에 반영하여 먼저 Worker 코드와 정적 파일을 함께 배포합니다. 첫 배포는 Secret이 없어도 가능하며 API만 503을 반환하고 사이트는 정상 제공됩니다.
5. 코드 배포 완료 후 Workers & Pages → 기존 Worker → Settings → Variables and Secrets → Add에서 Type **Secret**, 이름 **OPENAI_API_KEY**, 값 실제 키를 등록합니다. static assets only 메시지가 계속 보이면 최신 배포 로그에서 `src/index.js` 진입점을 포함했는지 확인하세요.
6. 같은 런타임 설정에 `OPENAI_MODEL` 텍스트 변수를 추가합니다. 계정에서 사용 가능한 Responses API + Structured Outputs 지원 모델 ID를 입력합니다. Save/Deploy로 적용합니다. Build variables에만 입력하면 런타임 binding이 생기지 않습니다.
7. 테스트 완료 → 전송 안내 확인 → AI 보고서 생성으로 확인합니다. 실제 OpenAI 호출에는 API 비용이 발생합니다.

`keep_vars: true`는 Dashboard에서 입력한 일반 변수를 Git 재배포 시 유지합니다. Secret은 Wrangler vars에 선언하지 않습니다. 현재 작업에서는 Git push/실제 Cloudflare 배포/실제 OpenAI 호출을 수행하지 않았습니다.

## 로컬 실행

```sh
cp .dev.vars.example .dev.vars
# .dev.vars에 실제 OPENAI_API_KEY와 OPENAI_MODEL을 입력
npm run worker:dev
```

`.dev.vars`는 Git에서 제외되며 `dist` 빌드에도 포함되지 않습니다. `npm run dev`는 정적 사이트만 제공합니다.

## 파일 역할

- `wrangler.jsonc`: Worker entry point, 정적 에셋 경로/binding, API 우선 라우팅과 빌드 설정.
- `src/index.js`: `/api/analyze`와 이전 `/api/report` 호환 경로 처리. 일반 요청은 `env.ASSETS.fetch(request)`로 전달하고 다른 API 경로는 JSON 404 반환.
- `lib/analyze.js`: JSON 요청 검증, 서버 재채점, Secret을 통한 OpenAI 호출 및 오류 처리.
- `lib/report.js`: 제출 형식/통계 조립/출력 JSON schema. 프롬프트는 `lib/report-prompt.js`, 문항 분류는 `lib/item-metadata.js`, 지표는 `lib/performance.js`에서 조정.
- `functions/api/report.js`: 기존 Pages용 호환 adapter이며 Workers 배포에는 사용되지 않음.

## 브라우저 → Worker

`POST /api/analyze`에 아래 JSON을 보냅니다. 배열은 반드시 Q01~Q30 순서의 **30개**입니다.

```js
const payload = {
  answers: answers, // 30개: A=0, B=1, C=2, D=3, 미응답=null
  seconds: clock.seconds, // 30개: 재방문 포함 누적 풀이 시간, 초 단위 실수
  expiredIndex: expired ? current : null, // 제한 종료 문항: 0~29, 정상 완료=null
  language: 'ko', // 'ko' 또는 'en'
  consent: true
};
const response = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
const { result, domains, report } = await response.json();
```

브라우저의 점수/IQ 값은 신뢰하지 않고 서버에서 기존 `scoring.js`로 다시 계산합니다. 단, 응답과 시간 자체는 클라이언트가 보낸 값입니다. 현재는 조작 방지 세션/서버 타임스탬프를 구현하지 않았습니다.

## Worker → OpenAI

`lib/report.js`의 `buildAnalysis`가 서버에서 아래 구조를 만듭니다. 모든 30문항이 items에 포함되고, 이름·이메일·API 키·문제 이미지는 모델 입력에 넣지 않습니다.

```js
{
  version: 'anchor110-speed05-analysis-v2',
  language: 'ko',
  validity: 'synthetic_preliminary_not_validated',
  calibration: { /* IQ110 기준, 모집단 가정, 30분 제한, 규준의 한계 */ },
  result: { score: 95, correct: 30, iq: 145.60277564287145 },
  domains: [
    // 영역별 문항 수, 유효 정답 수, 제외 수, 가중 점수, 최대 배점, 누적 시간
  ],
  items: [
    { id: 'Q01', domain: 'pattern', selected: 'A', correct: true,
      excluded: null, seconds: 20, reference_seconds: 20,
      points: 2, earned: 1.9 }
    // Q02~Q30
  ]
}
```

`excluded`는 `too_fast`, `time_limit`, `unanswered` 또는 null입니다. 빠른 응답 제외는 문항 기준시간 5% 미만입니다. `correct`는 답지 일치 여부, 영역의 correct와 result.correct는 제외 문항을 뺀 유효 정답 수입니다.

Function은 `https://api.openai.com/v1/responses`에 이 데이터를 `input: JSON.stringify(analysis)`로 보냅니다. 고정 instructions와 strict JSON Schema (`text.format`)를 함께 전달합니다. `store:false`, 출력 최대 6,000토큰, 요청 제한시간 60초입니다. 자동 재시도로 중복 API 비용을 발생시키지 않습니다.

AI는 점수/IQ를 재계산하지 않고 다음 구조를 작성합니다.

```js
{
  summary: '전체 결과 해석',
  problem_solving: [{ title: '풀이 방법', evidence: '문제 유형을 쉬운 말로 설명한 근거', advice: '구체적인 풀이 방법' }],
  cognitive_characteristics: [{ title: '인지 능력', assessment: '검사 내 상대적 강점/보완할 능력', evidence: '쉬운 말로 설명한 근거' }],
  careers: [{ field: '추천 직업', required_abilities: '이 직업에서 특히 요구되는 능력' }],
  limitations: '합성 모형 및 해석 한계'
}
```

관심·경력·기술 설문이 없으므로 직업은 일반적인 탐색 아이디어입니다. 문항 이미지/풀이를 보내지 않으므로 AI는 특정 오개념을 추측하지 않도록 지시했습니다. 모델 출력은 서버에서 형식을 검사하고 화면에서는 textContent로 표시합니다. 형식 검증이 내용의 사실성을 보장하지는 않습니다.

문항별 과제 설명·유형·내부 난이도·작업 능력 태그와 `performance` 지표도 입력에 포함합니다. [30문항 분류 및 분석 지표](item-analysis.md)에 전체 내용과 공식이 있습니다.

## 운영 범위

현재는 체험용 공개 API입니다. 동일 출처 검사와 요청 크기·형식 제한은 있지만 사용자 인증, 결제 확인, 영구 저장, 분산 요청 제한은 없습니다. 동일 출처 검사만으로 직접 API 호출을 막을 수는 없습니다. 공개 유료 서비스 전에는 Cloudflare의 `/api/analyze` 요청 제한, 사용자별 생성 횟수 제한/결제 확인 및 중복 생성 방지를 연결하세요. 새로고침이나 새 세션으로 다시 생성할 수 있습니다.

30분 제한 및 초고속 0점 규칙은 기본 합성 회귀식의 검증된 보정이 아닙니다. 모형 결과를 실제 IQ 규준이나 직업 적합성 판정으로 해석하지 않습니다. 단위 테스트는 모의 OpenAI 응답으로 수행하며 실제 API 응답 품질과 배포 계정 설정은 키를 설정한 후 확인해야 합니다.

## 공식 문서

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Workers Static Assets binding과 라우팅](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Workers Git 빌드 설정](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
