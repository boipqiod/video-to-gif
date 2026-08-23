# Looply — Video to GIF

브라우저에서 영상을 GIF로 변환하는 가벼운 웹앱입니다. 영상 파일은 서버로
전송되지 않고 사용자의 기기 안에서 처리됩니다.

## 주요 기능

- MP4, MOV, WEBM 등 브라우저에서 재생 가능한 영상 불러오기
- 최대 12초 구간 선택
- 8/12/16 FPS, 320/480/640px, 색상 수 조절
- 완성된 GIF 미리보기 및 다운로드
- 모바일·데스크톱 반응형 UI

## 로컬 실행

```bash
npm install
npm run dev
```

## 검증

```bash
npm run lint
npm run typecheck
npm run build
```

`main` 브랜치에 푸시하면 GitHub Actions가 GitHub Pages에 자동 배포합니다.
