# Billisan — 빌리산

얼굴 인증을 이용하는 우산 대여·반납 서비스의 소스 공개용 사본입니다. 관리자 웹,
키오스크 UI, Spring 백엔드와 우산 파손 검수용 AI 실험 코드를 포함합니다.

## 구성

| 경로 | 역할 |
| --- | --- |
| `backend/` | Java 21 / Spring Boot / MySQL / Flyway / JWT / MQTT |
| `frontend/web/` | React 관리자 웹, 재고·슬롯·검수 UI 및 목업 |
| `frontend/kiosk/` | React 키오스크, Pi WebSocket 메시지 연동 및 목업 |
| `ai/anomaly_detection/` | YOLO 검출·크롭, PatchCore 기반 파손 판정 실험 |

백엔드는 MySQL을 업무 상태의 기준으로 사용하며 Pi와 MQTT로 통신합니다.
키오스크는 Pi의 WebSocket 서버와 통신합니다. Pi/GPIO 서비스, 얼굴 인증 서비스,
모바일 앱 구현은 이 사본에 포함하지 않습니다. 목업 UI와 실제 장치 동작은 다릅니다.

## 로컬 실행

Node.js 22.12 이상, Java 21, Docker Compose가 필요합니다. UI만 확인할 때는
Java와 Docker 없이 프런트엔드 목업을 실행할 수 있습니다.

### 관리자 웹

```sh
cd frontend/web
cp .env.example .env.local
# 가상의 시연 ID/비밀번호를 .env.local에 설정합니다. 실제 계정 값은 사용하지 않습니다.
npm install --global pnpm@9.15.9
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm test`와 `pnpm build`로 확인합니다. `VITE_*` 값은 브라우저에 공개됩니다.
실제 API 연결 시 목업을 끄고 본인의 API 주소와 대여소 정보를 설정해야 합니다.
관리자 세션 API 일부는 구현되지 않았으므로 [SECURITY.md](SECURITY.md)를 확인하세요.

### 키오스크

```sh
cd frontend/kiosk
cp .env.example .env.local
npm ci
npm run dev
```

`VITE_PI_MOCK=true`로 인증 이후 흐름을 확인할 수 있습니다. 대여소 요약 요청은
별도 목업 경로를 사용합니다. 실 장치 연결에는 Pi 서버 구현이 필요합니다.
카메라 미리보기는 기본적으로 비어 있습니다. 인증을 강제하는 신뢰된 로컬 또는
동일 출처 프록시를 준비한 뒤 URL을 지정하세요. 고정 인증 토큰을 번들에 넣지 않습니다.

### 백엔드

```sh
cd backend
cp .env.example .env
# MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD, MQTT_PASSWORD, JWT_SECRET을 새로 생성해 채웁니다.
# 로컬 Java 실행 시 SPRING_DATASOURCE_PASSWORD를 MYSQL_PASSWORD와 같게 설정합니다.
docker compose --env-file .env -f local/docker-compose.yml up -d
./gradlew bootRun
```

Windows에서는 `gradlew.bat bootRun`을 사용하고 파일 복사는 `Copy-Item`으로 할 수 있습니다.
또는 `docker compose --env-file .env up --build`로 전체 로컬 스택을 실행합니다.
DB와 MQTT는 전체 스택에서 외부 포트를 열지 않습니다. 개발용 포트는 localhost에만
바인딩하며 MQTT도 비밀번호를 요구합니다. 기본 ACL은 로컬 시연용입니다.
Flyway가 빈 DB에 스키마를 구성하며 실제 사용자·관리자 계정 시드는 포함하지 않습니다.
챗봇은 선택 기능이며 사용할 LLM 서버의 URL·키·모델을 직접 설정해야 합니다.

### AI 실험

[AI 안내](ai/anomaly_detection/README.md)를 참고하세요. 학습 데이터와 모델 가중치는
포함하지 않으므로 소스만으로 즉시 추론하거나 기존 결과를 재현할 수 없습니다.

## 공개 범위

실제 촬영 이미지, 학습 데이터셋, 모델 파일, 실행 로그, 운영 계정 시드, 내부 운영 문서,
기관 서버 주소, 기존 Git 이력은 포함하지 않습니다. 예제와 목업은 실제 운영 정보가 아닙니다.
원본 프로젝트는 별도로 보관하며 이 사본은 새로운 Git 이력으로 시작합니다.

이 코드는 학습·시연용으로 공개를 준비한 상태입니다. 실서비스 배포 전 해결할 항목은
[SECURITY.md](SECURITY.md)에 기록했습니다. 저장소 공개만으로 라이선스가 부여되지 않습니다.
팀 코드 및 외부 자산의 공개·재사용 권한을 확인한 뒤 적절한 라이선스를 추가하세요.
