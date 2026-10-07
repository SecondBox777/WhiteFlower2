# Polar 결제

30문항 테스트는 무료이며 AI 리포트는 Polar의 1회 결제 상품으로 제공합니다.

## 운영 설정

Cloudflare → Workers & Pages → whiteflower2 → Settings → Variables and Secrets에 `POLAR_ACCESS_TOKEN`을 **Secret**으로 등록하고 Deploy합니다. Polar 조직 설정에서 Organization Access Token을 생성하며 `checkouts:write`, `checkouts:read` 권한이 필요합니다. 키는 소스 코드나 GitHub에 넣지 않습니다. 사용자 제공 `polar.txt`는 API 참고 문서이며 실제 인증 키가 아닙니다. 이 문서는 로컬에 보관하고 Git과 배포에서 제외합니다.

`wrangler.jsonc`에 다음 설정을 포함했습니다.

- `POLAR_PRODUCT_ID`: `a2fae7e7-f650-4109-87f7-f1f46e46b9be`
- `POLAR_ENVIRONMENT`: `production`
- `PAYMENT_SESSIONS`: SQLite Durable Object binding
- `payment-sessions-v1`: Durable Object 생성 migration

OpenAI 설정이 누락된 서버는 결제를 시작하지 않습니다. Resend 설정은 이메일 발송에 별도로 필요합니다. 일반 정적 개발 서버는 결제 API를 제공하지 않으므로 `npm run worker:dev`로 확인합니다.

## 구매 흐름

1. 테스트 완료 → 리포트 언어 선택 → 성인 확인.
2. `POST /api/checkout`에서 응답을 검증하고 Polar Checkout Session을 생성합니다. 상품은 서버 설정으로 고정되며, 고객이 가격이나 상품을 변경할 수 없습니다. 답안은 Polar metadata에 보내지 않습니다.
3. 서버의 구매별 Durable Object에 답안·문항별 시간·언어와 checkout ID를 저장하고 HttpOnly/Secure/SameSite=Lax 쿠키를 발급합니다.
4. Polar hosted checkout에서 결제합니다. 실제 상품 가격과 세금은 Polar에서 표시합니다. 결제 후 `/?payment=return`, 돌아가기 버튼은 `/?payment=cancelled`로 이동합니다.
5. `GET /api/payment/status`가 저장된 답안을 복원합니다. 서버는 Polar GET `/v1/checkouts/{id}`를 호출해 `succeeded` 상태, 상품 ID, 구매별 metadata와 checkout ID를 확인합니다. 리다이렉트나 `confirmed` 상태는 결제 증거로 인정하지 않습니다.
6. 결제가 확인되면 자동으로 리포트를 요청합니다. `/api/analyze`와 호환 `/api/report` 모두 동일한 결제 확인을 통과해야 하며, 서버에 저장된 원래 답안과 언어로만 생성합니다.
7. 생성 성공 시 리포트를 저장합니다. 동시 요청은 하나의 생성 요청을 공유하며, 새로고침·재방문 시 기존 리포트를 다시 제공합니다. 생성 실패는 재결제 없이 재시도할 수 있습니다. 이메일 토큰은 재방문 시 갱신됩니다.

구매 및 리포트 데이터는 30일 후 삭제됩니다. 같은 브라우저·같은 사이트 주소에서 마지막 구매를 복원합니다. 쿠키를 삭제하거나 다른 기기에서는 자동 복원되지 않습니다. 새 테스트를 결제하면 해당 브라우저의 마지막 구매 쿠키가 교체됩니다. 현재는 계정별 구매 목록, 다른 기기로 복원, 환불 후 권한 회수, webhook 처리는 구현하지 않습니다. 결제 확인은 Polar API 조회로 수행하므로 webhook Secret은 필요하지 않습니다.

사이트의 데이터 전송 안내에 결제 단계의 서버 저장과 30일 보관을 표시합니다. 미결제 요청과 인증 실패는 OpenAI 호출 전에 차단합니다. 실험용 랜덤 답안도 동일한 결제가 필요합니다.

## 검증

`npm test`는 Polar·OpenAI를 모의 응답으로 처리해 미결제 차단, 상품/구매 불일치 차단, 성인 확인, 리다이렉트 복원, 동시 생성 방지, 저장된 답안 사용, 성공 리포트 재사용과 실패 후 재시도를 검증합니다. 실제 결제나 이메일 발송은 수행하지 않습니다.

Sandbox 검증은 별도의 Sandbox 상품 ID·토큰을 사용하고 `POLAR_ENVIRONMENT=sandbox`로 설정합니다. 운영 상품 ID와 Sandbox 상품 ID는 서로 바꿔 쓸 수 없습니다.

API 참고: [Create Checkout Session](https://polar.sh/docs/api-reference/checkouts/create-session), [Get Checkout Session](https://polar.sh/docs/api-reference/checkouts/get-session).
