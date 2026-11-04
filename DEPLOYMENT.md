# GitHub 및 Render 배포

브라우저에서 실행되는 React/Vite 정적 사이트다. 서버, 데이터베이스, API 키 없이 배포할 수 있다.

## 배포 설정

- GitHub: `hyeonw00512/aram-solo-simulator` (공개)
- 배포 브랜치: `main`
- Render 유형: Static Site
- 빌드 명령: `npm ci --include=dev && npm run build`
- 게시 폴더: `dist`
- Node.js: 24 (`.node-version`)
- 환경 변수: `SKIP_INSTALL_DEPS=true` (빌드 명령에서 의존성 설치)
- 자동 배포: `main`에 업로드할 때 활성화

## 로컬 검증과 업데이트

```powershell
npm ci --include=dev
npm test -- --testTimeout=15000
npm run build
git add src public data tests scripts package.json package-lock.json
git commit -m "Update game"
git push origin main
```

Render에서 해당 커밋의 배포 상태가 Live가 된 뒤 게임 화면과 이미지가 정상 로드되는지 확인한다. 빌드 실패 시 이전 배포를 유지하므로 오류를 고친 커밋을 업로드한다.

`dist`와 `node_modules`는 저장소에 올리지 않는다. Render가 저장소 소스에서 빌드한다. 테스트에 필요한 JSON 데이터와 게임 이미지 파일은 포함한다.

## 저장 데이터

경기 진행은 접속한 브라우저의 localStorage에 저장된다. 계정 간·기기 간 동기화는 없으며 로컬 개발 주소에서 진행한 경기는 배포 주소로 자동 이전되지 않는다. 사이트 코드 업데이트는 같은 주소의 기존 저장 데이터를 삭제하지 않는다.

팬 제작 비공식 게임이다. 포함된 챔피언·아이템 이미지와 원본 게임 데이터의 권리는 해당 권리자에게 있다.
