# 👻 고스트 GO

학교 건물 안에 숨겨진 QR을 찾아 유령을 수집하는 **학과체험 행사용 모바일 웹게임**.

> "학교 곳곳에 숨어 있는 유령을 찾아 QR을 스캔하고, 나만의 유령 도감을 완성하라!"

| 항목 | 값 |
|---|---|
| 행사 규모 | 3일 · 하루 약 100명 · 총 300명+ · 동시 접속 20명 내외 |
| 장소 | 학교 건물 1~3층 (GPS 미사용, QR 스캔만) |
| 유령 | 20종 (Common 8 / Rare 6 / Epic 4 / Legendary 1 / Mythic 1) |
| 랭킹 | **당일 랭킹** — 매일 다른 학생이 방문하므로 누적 순위는 불공정 |

---

## 기술 스택

| 레이어 | 선택 |
|---|---|
| 프론트엔드 | Vite + React 19 + TypeScript |
| 스타일 | Tailwind CSS v4 |
| 백엔드 | Cloudflare Pages Functions |
| DB | Cloudflare D1 (SQLite) |
| 인증 | 익명 — HMAC 서명 토큰 (개인정보 수집 없음) |
| QR 디코딩 | `BarcodeDetector` 네이티브 우선 → `zxing-wasm` 폴백 (iOS) |

**게임 판정은 전부 서버(Worker)에서 한다.** 클라이언트는 결과만 받는다.
XP·레벨·순위를 클라이언트가 계산하지 않으므로 개발자도구로 조작할 수 없다.

---

## 실행

```bash
npm install

# 1) 시드 SQL 생성 (유령 20종 + QR 코드)
npm run db:seed

# 2) 로컬 D1 에 스키마 + 시드 적용
npm run db:init

# 3) 개발 서버 (API 포함)
npm run build && npx wrangler pages dev
#   → http://127.0.0.1:8788
```

프론트만 빠르게 보려면 `npm run dev` (단 API는 동작하지 않는다).

### 📱 폰에서 카메라 테스트하기

PC의 로컬 IP로 접속하면 `http://` 라서 **브라우저가 카메라를 차단한다.**
둘 중 하나를 써야 한다.

```bash
# ① 로컬 HTTPS
npx wrangler pages dev --local-protocol=https

# ② Cloudflare Pages 배포 (권장)
npx wrangler pages deploy dist
```

---

## 🎨 유령 이미지 넣기

이미지 20개를 **`public/ghosts/` 에 넣기만 하면 끝.** 코드 수정 불필요.

형식은 **webp(권장) / png / svg** 셋 다 되고, 코드가 `svg → webp → png` 순으로 찾는다.

| 항목 | 기준 |
|---|---|
| 배경 | **투명 필수** |
| 해상도 | 512×512 이상 |
| 20종 합계 | 1.5 MB 이하 |

> 초기 설계는 Firebase Hosting(360MB/일) 기준이라 SVG 를 강제했으나,
> Cloudflare Pages 는 대역폭 무제한이라 그 제약은 사라졌다.
> 지금 기준은 학교 와이파이에서의 로딩 속도뿐이다.

파일명 목록은 [public/ghosts/README.md](public/ghosts/README.md) 참고. 넣은 뒤:

```bash
npm run check:assets
```

파일명 · 투명배경 · 해상도 · 용량을 점검한다.
**파일명이 하나만 틀려도 그 유령만 조용히 임시 그림으로 나오므로 반드시 돌릴 것.**

---

## 테스트

```bash
npm run typecheck     # 타입 검사 (클라이언트 + 서버 + 빌드설정)
npx oxlint            # 린트
npm run test:smoke    # 서버 게임 로직 회귀 검사 (dev 서버 실행 중이어야 함)
```

`test:smoke` 는 실제 HTTP 요청으로 22가지를 검사한다 —
멱등성, 중복 보상 차단, 어뷰즈 방지, 도감 스포일러 차단, 토큰 위조 거부, 닉네임 규칙.

---

## 배포

```bash
# D1 생성 후 wrangler.toml 의 database_id 를 교체
npx wrangler d1 create ghost-go-db

# 원격 DB 초기화
npm run db:init:remote

# 토큰 서명 키 등록 (운영 필수)
npx wrangler pages secret put TOKEN_SECRET

npm run build
npx wrangler pages deploy dist
```

---

## 🔴 운영 전 반드시 할 것

### 1. QR 슬러그를 랜덤으로 재발급

현재 시드는 `devSlug()` — **결정적 함수**라서 이 저장소를 본 사람은 20개 슬러그를
전부 계산할 수 있다. 개발 중 인쇄한 테스트 QR이 계속 동작하게 하려는 용도다.

**실제 행사 전에는 `generateSlug()`(암호학적 난수)로 다시 발급하고,
생성된 슬러그는 저장소에 커밋하지 말 것.** (`seed.sql` 은 `.gitignore` 처리되어 있다)

### 2. `TOKEN_SECRET` 설정

미설정 시 개발용 기본값이 쓰인다. 그러면 토큰을 위조할 수 있다.

### 3. QR 인쇄 규격

| 항목 | 값 |
|---|---|
| QR 크기 | 70 mm 이상 |
| 오류정정 | ECC H |
| 여백 | 사방 8 mm 완전 흰 여백 (그림·글자 침범 금지) |
| 용지 | 무광 100g 이상 (유광은 조명 반사로 인식 실패) |
| 수량 | 20장 + 예비 5장, 3일간 위치를 바꿔가며 재사용 |

---

## 프로젝트 구조

```
ghost-go/
├─ functions/            # Cloudflare Pages Functions (서버)
│  ├─ _lib/util.ts       #   토큰 인증 · 닉네임 검증 · 이벤트 게이트
│  └─ api/
│     ├─ register.ts     #   익명 가입 + 닉네임 중복 확인
│     ├─ scan.ts         #   스캔 판정 (게임의 심장)
│     ├─ state.ts        #   플레이어 + 도감
│     └─ ranking.ts      #   당일 랭킹
├─ migrations/           # D1 스키마
├─ scripts/
│  ├─ seed.ts            # 시드 SQL 생성
│  └─ manus-prompt.ts    # 에셋 발주서 생성
└─ src/
   ├─ data/ghosts.ts     # ⭐ 유령 20종 단일 원본
   ├─ lib/               # api · qr · slug
   ├─ components/        # GhostSprite(20종 SVG) · ui · TabBar
   ├─ screens/           # Onboarding · Home · Scan · Reveal · Dex · Ranking · Profile
   └─ store/game.ts
```

`src/data/ghosts.ts` 가 **유령 데이터의 유일한 원본**이다.
시드 SQL도, 에셋 발주서도 전부 이 파일에서 생성한다 —
기획 문서와 DB가 서로 다른 20종을 갖는 사고를 막기 위해서다.

---

## 개인정보 (사양 §43)

수집하지 않는 것: 실명 · 학번 · 전화번호 · 이메일 · 주소 · GPS · 사진 · 연락처

저장하는 것: 서버가 만든 익명 ID, 학생이 직접 지은 고스트 헌터 ID(2~12자), 게임 기록뿐.

---

## 진행 상황

- [x] **PHASE 1** — 온보딩 · 홈 · QR 스캔 · 발견 연출 · 도감 · XP/레벨 · 당일 랭킹 · 프로필
- [ ] **PHASE 2** — 미션 · 배지 · Ghost Coin 사용처
- [ ] **PHASE 3** — 관리자 페이지 (유령 CRUD · QR 생성/인쇄 · 통계 · 이벤트 제어)
- [ ] 유령 20종 최종 일러스트 교체 (현재는 코드로 그린 임시 SVG)
- [ ] 실기기 카메라 테스트
