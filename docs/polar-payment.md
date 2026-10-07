# Polar 결제

30문항 테스트는 무료이며 AI 리포트는 Polar의 1회 결제 상품으로 제공합니다.

## Sandbox 설정

Cloudflare → Workers & Pages → whiteflower2 → Settings → Variables and Secrets에 `POLAR_ACCESS_TOKEN`을 **Secret**으로 등록하고 Deploy합니다. Polar 조직 설정에서 Organization Access Token을 생성하며 `checkouts:write`, `checkouts:read`, `orders:read`, `refunds:read`, `refunds:write` 권한이 필요합니다. 키는 소스 코드나 GitHub에 넣지 않습니다. 사용자 제공 `polar.txt`는 API 참고 문서이며 실제 인증 키가 아닙니다. 이 문서는 로컬에 보관하고 Git과 배포에서 제외합니다.

`wrangler.jsonc`에 다음 설정을 포함했습니다.

- `POLAR_PRODUCT_ID`: `a2fae7e7-f650-4109-87f7-f1f46e46b9be`
- `POLAR_ENVIRONMENT`: `sandbox`
- `PAYMENT_SESSIONS`: SQLite Durable Object binding
- `payment-sessions-v1`: Durable Object 생성 migration

OpenAI 설정이 누락된 서버는 결제를 시작하지 않습니다. Resend 설정도 새 결제를 시작하기 전에 확인합니다. 일반 정적 개발 서버는 결제 API를 제공하지 않으므로 `npm run worker:dev`로 확인합니다.

## 구매 흐름

1. 테스트 완료 → 리포트 언어 선택 → 성인 확인 → 수신 이메일 입력.
2. `POST /api/checkout`에서 응답을 검증하고 Polar Checkout Session을 생성합니다. 상품은 서버 설정으로 고정되며, 고객이 가격이나 상품을 변경할 수 없습니다. 답안은 Polar metadata에 보내지 않습니다.
3. 서버의 구매별 Durable Object에 답안·문항별 시간·언어·수신 이메일과 checkout ID를 저장하고 HttpOnly/Secure/SameSite=Lax 쿠키를 발급합니다.
4. Polar hosted checkout에서 결제합니다. 실제 상품 가격과 세금은 Polar에서 표시합니다. 결제 후 `/?payment=return`, 돌아가기 버튼은 `/?payment=cancelled`로 이동합니다.
5. `GET /api/payment/status`가 저장된 답안을 복원합니다. Polar 주문의 `paid` 상태·상품·checkout ID·구매별 metadata도 교차 확인하며, 환불 진행·완료 주문은 새 리포트를 생성하지 않습니다. 서버는 Polar GET `/v1/checkouts/{id}`를 호출해 `succeeded` 상태, 상품 ID, 구매별 metadata와 checkout ID를 확인합니다. 리다이렉트나 `confirmed` 상태는 결제 증거로 인정하지 않습니다.
6. 결제가 확인되면 자동으로 리포트를 요청합니다. `/api/analyze`와 호환 `/api/report` 모두 동일한 결제 확인을 통과해야 하며, 서버에 저장된 원래 답안과 언어로만 생성합니다.
7. 생성 성공 시 리포트를 저장합니다. 동시 요청은 하나의 생성 요청을 공유하며, 새로고침·재방문 시 기존 리포트를 다시 제공합니다. 생성 실패는 자동으로 재시도하며, 3회 실패하면 실제 주문의 남은 세전 결제액에 대해 `service_disruption` 사유로 자동 환불을 요청합니다. 세금 환불은 Polar가 계산합니다. 보고서 생성 직후 서버에서 저장한 이메일로 자동 발송합니다. 발송 결과는 구매별로 저장하고 같은 보고서를 중복 발송하지 않습니다. 이메일 실패는 1분 간격으로 최대 5회 시도하며, Resend의 중복 방지 유효시간에 맞춰 최초 시도 후 23시간이 지나면 재시도를 중단합니다. 수신 이메일은 OpenAI에 전달하지 않습니다.

구매 및 리포트 데이터는 30일 후 삭제됩니다. 일반 새로고침·홈페이지 방문에서는 홈 화면을 유지하고 결제 복귀 URL(`/?payment=return` 또는 `/?payment=cancelled`)에서만 같은 브라우저의 마지막 구매를 복원합니다. 쿠키를 삭제하거나 다른 기기에서는 자동 복원되지 않습니다. 새 테스트를 결제하면 해당 브라우저의 마지막 구매 쿠키가 교체됩니다. 현재는 계정별 구매 목록, 다른 기기로 복원, webhook 처리는 구현하지 않습니다. 결제 확인은 Polar API 조회로 수행하므로 webhook Secret은 필요하지 않습니다.

사이트의 데이터 전송 안내에 결제 단계의 서버 저장과 30일 보관을 표시합니다. 미결제 요청과 인증 실패는 OpenAI 호출 전에 차단합니다. 실험용 랜덤 답안도 동일한 결제가 필요합니다.

## 자동 환불

리포트 생성 실패 후 Durable Object alarm이 재시도합니다. 브라우저를 닫아도 재시도가 진행되며, 성공하면 리포트를 저장하고 환불하지 않습니다. 결제 조회·통신 실패나 결제 미완료만으로는 환불을 실행하지 않습니다. 3회 생성 실패 시 주문 및 기존 환불 내역을 다시 확인한 후 환불합니다. 이메일 실패는 이미 제공된 리포트의 환불 사유가 아닙니다.

환불 요청 전 서버에 의도를 저장합니다. 네트워크가 끊겨 결과가 불명확해도 같은 환불 POST를 다시 보내지 않고, 환불 목록을 조회해 처리 결과를 확인합니다. 이때 실패 응답이 실제로 접수되지 않았으면 자동으로 재요청하지 않으므로 관리자 확인이 필요할 수 있습니다. Polar의 환불 상태가 `pending`이면 진행 중, `succeeded`이면 완료로 표시하며 실패·취소는 고객 지원 안내를 표시합니다. 환불을 완료한 것으로 미리 표시하지 않습니다. 장기 대기 상태는 Polar Dashboard에서 확인하세요.

## 검증

`npm test`는 Polar·OpenAI를 모의 응답으로 처리해 미결제 차단, 상품/구매 불일치 차단, 성인 확인, 리다이렉트 복원, 동시 생성 방지, 저장된 답안 사용, 성공 리포트 재사용과 실패 후 재시도를 검증합니다. 실제 결제나 이메일 발송은 수행하지 않습니다. 자동 환불·중복 요청 방지·환불 상태 확인·실결제 주문 검증도 모의 API로 검증합니다.

현재는 Sandbox 상품 ID·토큰을 사용하고 `POLAR_ENVIRONMENT=sandbox`로 고정합니다. 운영 상품 ID와 Sandbox 상품 ID는 서로 바꿔 쓸 수 없습니다.

API 참고: [Create Checkout Session](https://polar.sh/docs/api-reference/checkouts/create-session), [Get Checkout Session](https://polar.sh/docs/api-reference/checkouts/get-session).
