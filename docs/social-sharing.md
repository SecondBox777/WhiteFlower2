# SNS 결과 공유

공유 버튼은 기기 종류와 무관하게 SNS 선택 메뉴를 엽니다. 사진은 기존 보고서 표지 PNG를 그대로 사용하며 블러·저해상도 변환을 하지 않습니다. 공유 문구는 보고서 언어로 `나의 IQ 스타일 점수는 100점입니다! / 나도 검사해보기 : https://mindscope.online/` 형태로 만듭니다.

- **기기 공유:** `navigator.share`와 파일 지원을 확인하고 이미 준비된 보고서 PNG 전체와 문구를 사용자 클릭에서 전달합니다. OS 공유 시트의 대상 앱은 사용자가 선택합니다.
- **카카오톡 직접 공유:** `KAKAO_JAVASCRIPT_KEY` 환경변수에 Mindscope 앱의 JavaScript 키를 설정하고 Kakao Developers에서 JavaScript SDK 도메인과 제품 링크 도메인에 `https://mindscope.online`을 등록합니다. 다른 앱의 키를 재사용하지 않습니다. 최초 카카오톡 클릭은 원본 표지 PNG를 `Kakao.Share.uploadImage()`로 업로드합니다. 이후 활성화되는 “카카오톡으로 보내기”를 누르면 `sendDefault()`를 동기 호출하여 PC 팝업 차단을 피합니다. 실제 발송 완료를 주장하지 않고 공유창을 열었다는 상태만 표시합니다. 키가 없으면 메뉴에서 사진 복사·저장 및 문구 복사를 안내합니다.
- **WhatsApp·Telegram·X·Facebook 등:** SNS 버튼을 누르면 보고서 표지와 점수를 담은 7일 유효 공유 페이지를 만들고 해당 SNS 작성창을 엽니다. 서버가 Open Graph/Twitter 메타 태그를 반환하므로 클라이언트 JS 실행 없이 크롤러가 결과별 이미지를 읽을 수 있습니다. 미리보기 표시·크롭·본문 사전 입력은 SNS 정책에 따릅니다. WhatsApp의 `wa.me` 경로는 문구와 링크를 전달하며 로컬 PNG 파일 자체를 자동 첨부하지 않습니다.
- **AddToAny:** 일부 서비스와 더보기 버튼에 공식 `add_to/<service>` 링크를 사용합니다. 외부 위젯 JavaScript를 전체 페이지에 삽입하지 않습니다. AddToAny만 붙여서는 브라우저 안의 PNG 파일을 모든 SNS에 자동 첨부할 수 없습니다.
- **사진 복사·문구 복사·사진 저장:** PC 작성창에 직접 붙여넣거나 첨부할 수 있도록 제공합니다. 사진 복사 미지원/권한 거부는 저장 안내로, 팝업 차단은 다시 열 수 있는 링크로 처리합니다. 공유 취소 시 다른 앱을 자동 실행하지 않습니다.

## 서버 저장과 권한

`REPORT_SHARES`는 새 `ReportShare` SQLite Durable Object 바인딩입니다. 기존 구매 객체는 변경하거나 마이그레이션하지 않습니다. `report-shares-v1` 클래스 생성 마이그레이션과 `/s/*` Worker 우선 라우팅이 필요하며 `wrangler.jsonc`에 포함됩니다.

유료 보고서 API와 임시 테스트 API는 `REPORT_EMAIL_SECRET`으로 서명한 공유 전용 토큰을 발급합니다. 토큰에는 용도·난수 ID·점수·언어·24시간 만료만 담습니다. 이미지 업로드는 이 토큰, 같은 출처, PNG 형식, 2 MiB 크기 제한, 표지 크기 검증을 거칩니다. 점수와 언어는 업로드 헤더 대신 검증한 토큰에서 가져옵니다. 서버에서 생성한 토큰 없이는 공개 이미지 업로드를 할 수 없습니다.

`/api/share-card` POST는 표지 PNG만 64 KiB 청크로 보관합니다. `/s/<random-id>`와 `/s/<random-id>/result.png`는 링크를 가진 사람과 SNS 크롤러가 열 수 있습니다. 이메일·답안·결제 내역은 포함하지 않습니다. 7일 경과 시 접근을 차단하고 알람에서 저장 데이터를 삭제합니다. SNS가 이미 받은 사본과 자체 캐시는 SNS 보관 정책에 따릅니다. 링크와 이미지에는 검색 비노출 헤더를 적용합니다.

화면/텍스트/저장/기기 공유는 공유 링크 서버 없이도 작동합니다. 공개 링크는 SNS 선택 또는 결과 링크 복사를 누를 때만 생성하며 메뉴를 열기만 해서는 이미지를 업로드하지 않습니다.

## 검증 범위

자동 테스트는 토큰 변조·만료·용도 구분, 이미지 크기·출처·유료 권한, TTL·삭제·공유 메타 태그, 다국어 문구를 확인합니다. 브라우저 검증은 메뉴·기기 공유·취소·팝업 차단·클립보드 실패·원본 PNG 전달과 SDK 호출 인자를 모의 SNS로 확인합니다. Mindscope 실제 도메인과 제공받은 JavaScript 키로 카카오 SDK 초기화, 원본 샘플 PNG 업로드, 카카오 계정 로그인 공유창 열기를 확인했고 샘플 이미지는 삭제했습니다. 메시지는 발송하지 않았습니다. 로그인된 실제 카카오톡/WhatsApp 계정의 최종 메시지 전송과 미리보기는 별도 실제 기기 확인이 필요합니다.

공식 문서: [AddToAny 이미지 공유](https://www.addtoany.com/buttons/customize/image_sharing), [카카오 JavaScript 공유](https://developers.kakao.com/docs/ko/kakaotalk-share/js-link), [WhatsApp click-to-chat](https://faq.whatsapp.com/5913398998672934), [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API).
