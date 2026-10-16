# 임시 무료 보고서 테스트

결과 화면에서 성인 확인과 이메일 입력 후 **테스트용: 바로 확인하기**를 누르면 `/api/test-report`가 답안·시간을 서버에서 채점하고 선택 언어의 보고서를 화면에 반환하며 Resend로 이메일을 보냅니다. 실제 결제·환불·구매 데이터는 생성하지 않습니다. 이메일 전송이 실패해도 화면에는 보고서를 표시하고 발송 실패 상태를 알립니다. 같은 응답·이메일의 재요청은 같은 Resend 멱등 키를 사용합니다.

현재 `wrangler.jsonc`의 `TEMPORARY_TEST_REPORT_ENABLED=true`일 때 이 전용 API를 사용할 수 있습니다. 비활성화하려면 이를 `false`로 바꾸고 `temporary-test-report.js`의 `temporaryTestReportsEnabled=false`로 바꿔 배포합니다. 기존 유료 보고서 API는 결제 검증을 계속 적용합니다.

완전히 삭제할 때:

1. `temporary-test-report.js`, `lib/temporary-test-report.js`, `tests/temporary-test-report.test.mjs`, 이 문서를 삭제합니다.
2. `src/index.js`의 `TEMPORARY TEST FEATURE` import와 `/api/test-report` 라우트를 제거합니다.
3. `app.js`의 같은 주석으로 표시된 import·버튼·상태 연결을 제거하고 `generateReport`의 `temporaryTest` 분기와 인자를 제거합니다. 기존 결제 확인과 `/api/analyze`, `{email:emailAddress}` 요청을 유지합니다.
4. `wrangler.jsonc`에서 `TEMPORARY_TEST_REPORT_ENABLED`를, `scripts/build.mjs`·`server.mjs`·`tests/build.test.mjs`에서 `temporary-test-report.js` 항목을 제거합니다.
5. `npm test`, `npm run build` 후 배포합니다. `/api/test-report`가 404이고 기존 결제 흐름만 표시되는지 확인합니다.
