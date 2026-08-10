# Billisan App

얼굴 온디바이스 인증 기반 공유 우산 대여 서비스의 사용자 모바일 앱(React Native / Expo).
로그인 후 현재 대여·이용 내역·미정산·결제·알림·챗봇 등 **조회 중심** 기능을 제공한다.
얼굴 인증·슬롯 제어는 Kiosk 전담이며 App은 관여하지 않는다.

## 기술 스택

- **Framework**: React 19.1 + React Native 0.81 + Expo SDK 54(Expo Go)
- **Language**: TypeScript ~5.9 (`strict`)
- **Navigation**: React Navigation (`native` + `native-stack` + `bottom-tabs`)
- **State**: Zustand
- **Server State**: TanStack Query v5
- **Styling**: NativeWind v4 (Tailwind CSS v3 문법)
- **지도**: 카카오맵 JS SDK 커스텀 타일셋 (`react-native-webview`로 로컬 HTML 주입)
- **저장소**: `expo-secure-store` (Access Token 등)
- **Formatter**: Prettier(+ prettier-plugin-tailwindcss)

## 시작하기

```bash
npm install
npm start        # Expo Go 앱으로 QR 스캔
npm run android   # Android 에뮬레이터
npm run ios       # iOS 시뮬레이터 (맥 전용)
npm run web       # 웹 미리보기
```

`.env` 파일이 필요하다 (직접 만들지 말고 팀 채널에서 값 받을 것 — 임의로 수정 금지):

```
EXPO_PUBLIC_API_BASE_URL=
EXPO_PUBLIC_KAKAO_JS_KEY=
```

Node 버전은 로컬 확인 기준 v24 사용 중(별도 `.nvmrc` 없음 — 팀 공통 버전 확정 시 추가 필요).

## APK 배포 (EAS Build)

EAS Build로 내부 배포용 APK 만듦.

**설정 현황**

- 패키지명: `dev.billisan.app` (`app.json`)
- 빌드 프로필: `eas.json`의 `preview` (내부 배포용 APK, Play Store용 AAB 아님)
- 서명키(keystore): EAS가 자동 생성해 자체 서버에 보관(EAS-managed) — 최초 1회만 생성, 이후 빌드는 계속 재사용
- OTA 업데이트(`expo-updates`): 미도입 — 코드가 바뀌면 반드시 다시 빌드 + 재설치해야 반영됨

**빌드 방법**

```bash
npx eas login       # 최초 1회, Expo 계정 로그인 (팀 공용 계정 확인 필요)
npx eas build --platform android --profile preview
```

빌드가 끝나면 터미널에 QR/다운로드 링크가 뜬다. 그 링크로 APK를 받아 폰에 설치한다.

**주의사항**

- 자동 업데이트가 아니다 — 기능 추가·버그 수정 후에는 **매번 새로 빌드해서 재설치**해야 반영된다.
- keystore 생성 여부를 묻는 프롬프트가 다시 뜨면 **반드시 기존 키 사용(Use existing)**을 선택한다.
  서명키가 바뀌면 기존에 설치된 앱과 충돌해 재설치가 안 된다(최초 1회만 "새로 생성"이 맞았음).
- `eas.json`/`app.json`은 git에 커밋되므로 팀 전체가 같은 설정으로 빌드된다. `.env`는 각자 로컬에 있어야
  한다(git 미포함, 임의 수정 금지).

## 스크립트

| 명령어 | 설명 |
|---|---|
| `npm start` | Expo 개발 서버 실행 (QR로 Expo Go 접속) |
| `npm run android` | Android 에뮬레이터로 실행 |
| `npm run ios` | iOS 시뮬레이터로 실행 (맥 전용) |
| `npm run web` | 웹 미리보기 실행 |
| `npm run format` | Prettier로 전체 파일 포맷 |
| `npm run format:check` | Prettier 포맷 여부만 검사 |

> 타입 체크는 `npx tsc --noEmit`으로 직접 실행 (별도 스크립트 없음)

## 폴더 구조

```
├── App.tsx              # 엔트리 — GestureHandlerRootView / QueryClientProvider / SafeAreaProvider
├── index.ts             # Expo 등록 진입점
├── app.json             # Expo 설정(아이콘, 플러그인 등)
├── docs/
│   ├── PROJECT_GUIDE.md     # 기획 문서(06/09/12-R) 발췌 — API 계약·화면 명세 요약
│   ├── app-screen-flow.md   # 화면별 Variant·흐름 상세(09번 발췌)
│   ├── PHASE.md             # 현재 구현 Phase(반드시 Phase 순서대로 진행)
│   └── plans/                # 화면별 PLAN 문서(YYYY-MM-DD-{Screen ID}.md)
└── src/
    ├── api/          # Screen/도메인별 API 클라이언트 (Mock 우선, client.ts가 axios 인스턴스)
    ├── assets/       # 이미지·SVG·카카오맵 타일 등 정적 리소스
    ├── components/
    │   ├── common/   # 공통 컴포넌트 (Button, TextField, ConfirmModal, ErrorBanner 등)
    │   └── layout/   # 공통 레이아웃 (AppHeader, Screen)
    ├── hooks/        # 커스텀 훅 (예: useAlertPolling)
    ├── lib/          # 순수 유틸 (secureStorage, notifications 등)
    ├── navigation/   # RootNavigator / RootStackNavigator / TabNavigator / MyPageStackNavigator
    ├── screens/      # Screen ID(SCR-APP-*) 기준 화면 폴더
    │   ├── SCR-APP-AUTH-001/
    │   ├── SCR-APP-HOME-001/
    │   ├── SCR-APP-STATION-001/    # 카카오맵 WebView
    │   ├── SCR-APP-MYPAGE-001/
    │   ├── SCR-APP-HISTORY-001/
    │   ├── SCR-APP-NOTIFICATION-001/
    │   ├── SCR-APP-INQUIRY-001/
    │   └── SCR-APP-CHATBOT-001/
    ├── store/        # Zustand 스토어 (useAuthStore, useAlertReadStore 등)
    └── types/        # 상태 코드·enum·DTO 타입 (임의로 새 상태값 만들지 않음)
```

## 참고 문서

- [`CLAUDE.md`](./CLAUDE.md) — 프로젝트 규칙, 코드 스타일, 보안 규칙, 워크플로 규칙
- [`AGENTS.md`](./AGENTS.md) — Expo SDK 버전 확인 필수 안내
- [`docs/PROJECT_GUIDE.md`](./docs/PROJECT_GUIDE.md) — 기획 문서(06/09/12-R) 기준 App 전용 지침서(API 계약·화면 카탈로그·정책)
- [`docs/app-screen-flow.md`](./docs/app-screen-flow.md) — 화면별 Variant·흐름 상세
- [`docs/PHASE.md`](./docs/PHASE.md) — 현재 구현 Phase(한 번에 하나의 Phase만 구현)
- [`docs/plans/`](./docs/plans/) — 화면별 PLAN 문서 이력
- [`PROGRESS.md`](./PROGRESS.md) — 구현 진행 로그
