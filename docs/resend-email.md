# Resend로 AI 보고서 이메일 발송

결과 화면에서 AI 보고서를 생성한 뒤, 이메일 주소를 입력하고 **AI 보고서 이메일로 받기**를 누르면 같은 보고서를 메일 본문으로 받습니다. 예비 IQ·점수·정답 수·요약·문제풀이·인지적 특성·추천 직업·한계가 포함됩니다. 한국어/영어 보고서 모두 지원하며 PDF 첨부는 없습니다. 이메일 발송은 OpenAI를 다시 호출하지 않습니다.

현재 `REPORTS_PAUSED=true`이므로 보고서 생성과 이메일 발송은 둘 다 중지되어 있습니다. Resend 설정을 등록해도 이 차단은 자동으로 해제되지 않습니다.

## 1. 발신 도메인 인증

[Resend Domains](https://resend.com/domains)에서 본인이 소유한 도메인 또는 발송용 서브도메인을 추가합니다. 예: `mail.example.com`. Resend가 표시하는 SPF/DKIM DNS 레코드를 해당 도메인의 DNS 관리 화면에 등록하고 Verified 상태가 될 때까지 확인합니다. [공식 도메인 안내](https://resend.com/docs/dashboard/domains/introduction)를 참고하세요.

`whiteflower2.pepermint916.workers.dev`는 Cloudflare가 소유한 도메인이므로 자신의 이메일 발신 도메인으로 인증할 수 없습니다. 별도로 소유한 도메인이 필요하며 웹사이트 주소는 지금 주소를 유지해도 됩니다. 메일 수신함을 개설할 필요는 없고, 인증된 발신 도메인에 속한 주소를 사용합니다. 예: `reports@mail.example.com`.

`onboarding@resend.dev`는 초기 테스트용입니다. 일반 사용자에게 보내는 운영 서비스에는 인증된 도메인을 사용하세요. [테스트 도메인 제한 안내](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

## 2. API 키와 Worker 설정

[Resend API Keys](https://resend.com/api-keys)에서 발송 전용 API 키를 만듭니다. 가능하면 인증한 도메인으로 범위를 제한합니다. [API 키 안내](https://resend.com/docs/dashboard/api-keys/introduction).

Cloudflare → Workers & Pages → `whiteflower2` → Settings → Variables and Secrets에 다음 런타임 설정을 등록하고 Deploy합니다. 빌드 환경변수에만 등록하면 동작하지 않습니다.

| 이름 | 종류 | 값 |
|---|---|---|
| `RESEND_API_KEY` | Secret | Resend에서 만든 `re_...` API 키 |
| `RESEND_FROM` | Text | `Mindscope <reports@mail.example.com>`처럼 인증된 도메인의 발신 주소 |
| `REPORT_EMAIL_SECRET` | Secret | 무작위 32바이트 이상을 사용한 별도의 서명 비밀값 |

서명 비밀값은 `openssl rand -hex 32`로 생성할 수 있습니다. OpenAI API 키와 다른 값을 사용하세요. 비밀값은 소스·브라우저·공개 채팅에 넣지 않습니다. 기존 `OPENAI_API_KEY`와 `OPENAI_MODEL`도 유지합니다. `keep_vars:true`로 Dashboard 텍스트 변수를 유지합니다.

로컬 Worker에서는 `.dev.vars.example`을 참고하여 비공개 `.dev.vars`에 설정하고 `npm run worker:dev`로 실행합니다. `npm run dev`는 정적 서버라 API가 동작하지 않습니다.

## 3. 활성화와 확인

설정을 마친 뒤 사용자가 보고서 재개를 요청하면 `app.js`의 `REPORTS_PAUSED=false`와 `wrangler.jsonc`의 `vars.REPORTS_PAUSED="false"`를 함께 반영하여 배포합니다. 전체 테스트는 `TESTING_PAUSED=false`를 유지합니다.

테스트 완료 → 언어 선택 → AI 보고서 생성 → 본인 이메일 입력 → AI 보고서 이메일로 받기 순서로 확인합니다. 보고서 생성은 OpenAI API 비용이 발생합니다. 보고서 생성 후 30분 이내에 이메일을 요청해야 합니다. 설정을 추가하기 전에 생성한 보고서는 이메일 발송 토큰이 없으므로 새로 생성해야 합니다.

성공 메시지는 Resend가 발송 요청을 접수했다는 의미입니다. 최종 수신 여부는 Resend Emails 화면에서 확인하고 받은편지함·스팸함을 확인하세요. 실제 수신 완료를 화면에서 추적하는 웹훅은 아직 구현하지 않았습니다.

## 구현과 중복 방지

- `lib/analyze.js`: 서버가 검증한 최종 보고서에 이메일 발송용 HMAC 서명을 발급합니다. 이메일 설정이 준비되지 않으면 화면 보고서는 정상 반환하고 이메일 발송 버튼은 사용할 수 없습니다. 이메일 주소는 OpenAI에 전달하지 않습니다.
- `lib/report-email.js`: 서명·만료시간을 검증하고 서버가 생성한 보고서만 `POST https://api.resend.com/emails`로 발송합니다. HTML의 특수문자를 이스케이프하고 일반 텍스트 본문도 제공합니다. [공식 발송 API](https://resend.com/docs/api-reference/emails/send-email).
- `POST /api/email-report`: `{email, token, consent:true}`를 받습니다. 임의의 보고서 본문이나 제목을 직접 전송할 수 없습니다. 30분 제한·200KB 본문 제한·Origin 검증·중지 설정을 적용합니다.
- 같은 보고서 토큰에는 같은 Resend `Idempotency-Key`를 사용합니다. 같은 주소로 재시도하면 중복 발송을 방지하며, 같은 토큰으로 수신 주소를 바꾸면 Resend가 409로 거절합니다. Resend는 이 키를 24시간 유지하며 토큰은 30분만 유효합니다. [중복 방지 안내](https://resend.com/changelog/idempotency-keys).

이메일 발송에는 OpenAI 토큰이 추가로 들지 않지만 Resend의 이메일 발송 한도는 적용됩니다. 새 보고서 생성 자체를 제한하는 사용자 인증이나 요청 횟수 제한은 기존과 같이 별도 구현이 필요합니다.

## 오류 확인

- 중지 안내: `REPORTS_PAUSED` 또는 `TESTING_PAUSED`가 켜져 있습니다.
- 이메일 기능 미준비: 위 런타임 설정 3개를 확인하고 새 보고서를 생성합니다.
- 발송 실패: Resend Logs에서 API 키의 발송 권한, 인증된 도메인, 발신 주소, 서비스 한도를 확인합니다.
- 만료: 보고서를 다시 생성합니다. 새 OpenAI 호출에 비용이 발생합니다.
- 응답 시간초과: 같은 주소로 재시도합니다. 같은 토큰의 중복 방지 키가 유지됩니다.

`npm test`는 가상 API 응답으로 서명 변조·만료·HTML 이스케이프·중복 방지 키·중지 설정·오류 처리를 검증합니다. 실제 OpenAI/Resend 호출이나 실메일 발송은 수행하지 않습니다.
