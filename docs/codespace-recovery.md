# Codespace 삭제 전 백업과 복원

2026-10-24 기준. 저장소: https://github.com/SecondBox777/WhiteFlower2 (`main`).

## 삭제 전

- 필요한 소스와 문서는 commit·push한다. `git status --short --branch`로 확인한다.
- `codespace-local-backup-2026-10-24.tar.gz`를 파일 탐색기에서 우클릭 → Download하여 개인 컴퓨터에 보관하고 압축파일이 열리는지 확인한다. Codespace 안에만 두면 삭제할 때 함께 사라진다.
- 압축파일에는 `polar.txt`(제공받은 API 참고 문서), `.wrangler/state/`(로컬 개발 데이터), 이 안내문이 들어 있다. 로컬 데이터에는 테스트 정보가 있을 수 있으므로 개인 보관한다. 운영 데이터의 백업은 아니다.
- 현재 프로젝트 루트에는 실제 `.env`와 `.dev.vars`가 없다. 이후 생성했다면 따로 안전하게 백업하며 Git에 올리지 않는다.
- `dist/`는 `npm run build`로 다시 생성하므로 백업하지 않아도 된다. `.wrangler/cache/`, `.wrangler/tmp/`도 다시 생성한다.
- 프로젝트 밖의 개인 파일, 터미널 기록, 편집기 확장·설정은 이 백업 범위에 포함되지 않는다.

## 운영 사이트

`wrangler.jsonc`는 Cloudflare Worker `whiteflower2`와 정적 assets, `PAYMENT_SESSIONS`/`REPORT_SHARES` Durable Objects를 정의한다. 운영 사이트와 운영 저장소는 Cloudflare에 있고 Codespace의 로컬 서버와 별개다. Codespace만 삭제해도 배포된 사이트는 유지된다. GitHub 저장소, Cloudflare Worker·도메인·Durable Objects, Polar·Resend 계정은 유지한다.

운영 비밀값 `POLAR_ACCESS_TOKEN`, `RESEND_API_KEY`, `REPORT_EMAIL_SECRET`은 Cloudflare에서 관리한다. Codespace 삭제 때문에 다시 등록할 필요는 없다. 별도 재해 복구를 위해 원래 발급한 키를 암호 관리자에 보관하는 것은 유용하다. Cloudflare의 비밀값을 Git에 넣지 않는다. 로컬 `.wrangler/state/`를 복원하는 것은 운영 데이터 복원이 아니다.

## 새 Codespace에서 복원

1. GitHub 저장소 → Code → Codespaces → Create codespace on main.
2. 필요한 경우 다운로드한 압축파일을 새 Codespace로 업로드한다. 프로젝트 루트에서 아래 명령으로 로컬 파일을 복원한다. 로컬 개발 서버는 정지한 상태에서 복원한다.

```sh
tar -xzf codespace-local-backup-2026-10-24.tar.gz
```

3. Node.js 20 이상에서 `npm run dev`를 실행하고 Ports의 3000번을 연다. 현재 정적 미리보기에는 별도 패키지 설치가 필요 없다. 결제·보고서 API는 이 정적 미리보기에서 제공하지 않는다.
4. 로컬 Worker 테스트가 필요하면 `.dev.vars.example`을 참고해 `.dev.vars`를 만들고 개발용 비밀값을 설정한 뒤 `npm run worker:dev`를 실행한다. Wrangler 설치와 Cloudflare 재로그인이 필요할 수 있다. 로컬 미리보기만 하려면 필요 없다.
5. 운영 배포 작업이 필요할 때만 Cloudflare에 재로그인하고 `npm run deploy`를 사용한다. 복원만을 위해 배포할 필요는 없다.

Git에서 소스를 다시 받으므로 프로젝트 전체를 업로드할 필요가 없다. 백업 파일은 원래 상대 경로로 복원하면 된다. 새 Codespace는 새 개발 환경이며 이전 창의 터미널·실행 프로세스·설치한 도구까지 복원하지는 않는다.

공식 안내: https://docs.github.com/en/codespaces/developing-in-a-codespace/creating-a-codespace-for-a-repository
