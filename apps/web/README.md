# MentorBridgeX — 웹 프론트엔드 (`apps/web`)

Vite + React (JSX) 기반 웹 앱입니다.
원래 하나의 파일이었던 `초안_코드.jsx` (5148줄)을 역할별 폴더로 분리했습니다.

---

## 🚀 빠른 시작

```bash
# 1. 의존성 설치 (처음 한 번)
cd apps/web
npm install

# 2. 개발 서버 실행 (http://localhost:3000)
npm run dev

# 3. 프로덕션 빌드
npm run build
```

> **로컬 백엔드 동시 실행** (`make api` → `http://127.0.0.1:8000`)
> `vite.config.js`가 `/v1/**` 요청을 자동으로 백엔드로 프록시합니다.

---

## 📁 폴더 구조

```
apps/web/
├── index.html              # HTML 진입점 (root div)
├── vite.config.js          # Vite 설정 (React 플러그인 + /v1 프록시)
├── .env.example            # 환경 변수 샘플 → .env 로 복사해 사용
└── src/
    ├── main.jsx            # React 진입점 (createRoot)
    ├── App.jsx             # StoreProvider + AppShell + Toast
    │
    ├── api/                # ✨ 백엔드 연결 지점
    │   ├── client.js       # fetch 헬퍼, token(localStorage), request()
    │   ├── index.js        # api.auth / api.graph / api.ingest (실제 연결)
    │   └── mockData.js     # 목업 데이터 (코멘트·교사·관리자 미연결 부분)
    │
    ├── store/              # 전역 상태 (Context + Reducer)
    │   ├── initialState.js # 초기 상태 정의
    │   ├── reducer.js      # 순수 함수 리듀서
    │   └── StoreProvider.jsx  # useStore() + StoreProvider + actions
    │
    ├── theme/              # 디자인 시스템 (TDS)
    │   ├── tokens.js       # 색상·타이포·간격 토큰
    │   └── styles.css      # 전역 CSS (폰트·레이아웃·컴포넌트 기본 스타일)
    │
    ├── components/         # 재사용 UI 컴포넌트
    │   ├── ui.jsx          # TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider, DonutChart
    │   ├── NavIcon.jsx     # SVG stroke 아이콘 + NAV_ICON_PATHS
    │   ├── Toast.jsx       # 알림 토스트 (전역 오버레이)
    │   ├── ScreenPicker.jsx # 개발용 화면 점프 FAB
    │   ├── Placeholder.jsx # 미구현 화면 자리 표시자
    │   └── layout/
    │       ├── Sidebar.jsx     # 역할별 사이드바
    │       └── GlobalHeader.jsx # 상단 헤더 (검색·알림·아바타)
    │
    ├── nav/
    │   └── menus.js        # S_NAV, T_NAV, A_NAV, TITLES, SHARED_SCREENS, getLayout, requiredRole
    │
    ├── screens/            # 화면 컴포넌트 (역할별 분류)
    │   ├── index.jsx       # renderScreen(id, onNav) — 화면 ID → 컴포넌트 맵
    │   ├── student/        # S01 ~ S32 (학생 화면)
    │   ├── teacher/        # T01 ~ T10 (교사 화면)
    │   └── admin/          # A00 ~ A32 (관리자 화면)
    │
    └── utils/
        └── time.js         # timeAgo(), _uid()
```

---

## 🌐 API 연결 상태

| 메서드 | 경로 | 상태 |
|--------|------|------|
| `api.auth.signInWithPassword` | `POST /v1/auth/dev-login` | ✅ 실제 연결 |
| `api.auth.signOut` | localStorage 토큰 삭제 | ✅ 실제 연결 |
| `api.auth.signInGoogle` | `POST /v1/auth/dev-login` (고정 이메일) | 🔶 MVP 목업 |
| `api.auth.signInAdmin` | `POST /v1/auth/dev-login` (role 주입) | 🔶 MVP 목업 |
| `api.graph.fetch` | `GET /v1/students/me/graph` | ✅ 실제 연결 |
| `api.graph.addNode` | `POST /v1/students/me/graph/nodes` | ✅ 실제 연결 |
| `api.graph.addEdge` | `POST /v1/students/me/graph/edges` | ✅ 실제 연결 |
| `api.graph.removeNode` | `DELETE /v1/students/me/graph/nodes/{id}` | ✅ 실제 연결 |
| `api.graph.generateFromSeeds` | `POST /v1/students/me/graph/seed` | ✅ 실제 연결 |
| `api.graph.pruneSuggestions` | `POST /v1/students/me/recommendations/branch` | ✅ 실제 연결 |
| `api.ingest.uploadPdf` | `POST /v1/students/me/documents/import-pdf` | ✅ 실제 연결 |
| `api.ingest.uploadAudio` | — | 🔶 백엔드 미구현 |
| `api.comments.*` | — | 🔶 목업 (mockData.js) |
| `api.teacher.*` | — | 🔶 목업 (mockData.js) |
| `api.admin.*` | — | 🔶 목업 (mockData.js) |

---

## 🔧 환경 변수 설정

`.env.example`을 `.env`로 복사해 수정:

```bash
cp .env.example .env
```

```env
# 배포 백엔드
VITE_API_BASE_URL=https://api.teamcodebridge.dev

# 로컬 개발 (vite.config.js 프록시 사용 시 이 줄 주석 처리)
# VITE_API_BASE_URL=http://127.0.0.1:8000
```

---

## 🧩 새 화면 추가하는 법

1. `src/screens/student/SXX.jsx` 파일 생성
2. `export function SXX({ onNav }) { ... }` 형태로 작성
3. `src/screens/index.jsx`의 `renderScreen` 맵에 `SXX: <SXX onNav={onNav}/>` 추가
4. `src/nav/menus.js`의 `S_NAV` 배열에 메뉴 항목 추가 (선택)

---

## 💡 화면 미리보기 (개발 팁)

앱 실행 중 오른쪽 하단의 🗺 버튼을 클릭하면 76개 화면을 ID/이름으로 검색해서
로그인 없이 바로 이동할 수 있습니다.

---

## 🔗 관련 문서

- 백엔드 API: `services/api/README.md`
- 아키텍처: `docs/architecture.md`
- 온톨로지: `docs/ontology-domain.md`
