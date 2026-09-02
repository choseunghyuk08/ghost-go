# 「고스트 GO」 확정 사항 v2 — Firebase · 500명 · 3일

> **이 문서의 지위: v2 > `GHOST_GO_기획서.md` PART 0 > PART 1~6**
> 확정 답변 5가지를 반영해 데이터 계층과 기술 스택을 재설계한 문서입니다.
> 기존 문서의 **PART 3(데이터베이스) 전체와 PART 4의 스택 절**은 이 문서로 대체됩니다.

| 항목 | 내용 |
|---|---|
| 문서 버전 | v2.0 |
| 대체 대상 | PART 3 전체, PART 4 §1~3, PART 0 모순 1·9·10·11·12·13·18 |
| 유지 대상 | PART 1(기획), PART 2(UX/화면), PART 5(리스크), PART 6(로드맵) — 단 일부 수정 |
| 작성 근거 | 무료 할당량 시뮬레이션 실측 계산 (본문 §3) |

---

## 1. 확정된 답변과 그 파급

| # | 질문 | 확정 답변 | 영향받는 설계 | 조치 |
|---|---|---|---|---|
| 1 | 행사 기간 | **3일** | PART 0 모순 17 해소 | 등급 순차 해금·일일 미션 3일치·개근 배지·Mythic 시간 게이트 **전부 유효**. 기획(PART 1) 그대로 진행 |
| 2 | 참가 인원 | **약 500명** | 대기열·할당량·인쇄 수량 | 기존 가정(150~200명)의 **2.5~3.3배**. QR 카드 다중화 필수 (§6) |
| 3 | 층수 | **1~3층** | `floor` 제약 | 기존 가정과 일치. 층별 배치 6/7/7 유지 |
| 4 | 개발 인력 | **마누스 에이전트** | 로드맵 컷 라인 | §9 참조 — 확인 필요 사항 있음 |
| 5 | 인프라 | **Firebase 웹앱 · 무료** | **PART 3 전면 무효** | 본 문서 §2~5로 전면 재설계 |

**답변 2번(500명)과 5번(Firebase 무료)이 결합되면서 새로운 제약이 생겼습니다.** 인원이 늘수록 무료 할당량 압박이 커지기 때문에, 이 둘은 따로 볼 수 없습니다.

---

## 2. Firebase 무료(Spark) 플랜의 결정적 제약

### 2-1. 🔴 Cloud Functions를 쓸 수 없습니다

Firebase의 **Cloud Functions는 무료(Spark) 플랜에서 사용할 수 없고, Blaze(종량제) 플랜이 필요합니다.**

이것이 왜 치명적이냐면 — 기존 설계(PART 3)의 핵심은 **`api_scan()` 서버 함수 하나가 스캔의 모든 판정을 원자적으로 처리**하는 것이었습니다. 중복 판정, XP·코인 지급, 레벨 계산, 미션·배지 갱신을 전부 서버에서 하고, 클라이언트는 결과만 받습니다. 그래야 "개발자도구로 XP를 조작"할 수 없습니다.

Functions가 없으면 **이 로직이 전부 학생 브라우저에서 실행**됩니다. 학생이 콘솔을 열어 자기 XP를 100,000으로 쓰는 걸 아무것도 막지 못합니다.

### 2-2. 대안 3안 비교

| 안 | 방식 | 비용 | 부정행위 방어력 | 구현 난도 | 판정 |
|---|---|---|---|---|---|
| A | Blaze 전환 + Functions | 사실상 $0 (무료 할당량 내), **신용카드 등록 필요** | ★★★★★ | 낮음 | 가능하면 최선 |
| B | **Spark + Firestore 보안 규칙으로 서버 검증 대체** | $0 | ★★★☆☆ | 높음 | **채택** |
| C | Spark + 클라이언트 전액 신뢰 | $0 | ☆☆☆☆☆ | 매우 낮음 | **절대 불가** |

**B안을 채택합니다.** "무료로 진행"이라는 확정 답변을 존중하되, C안(무방비)은 행사를 파괴하므로 배제합니다.

Firestore 보안 규칙은 단순한 읽기/쓰기 허용을 넘어 **다른 문서를 조회해서(`get()`) 쓰기 값을 검증**할 수 있습니다. 이걸 이용하면 "XP 증가량이 실제로 스캔한 유령의 보상값과 일치하는가"를 서버(규칙 엔진) 측에서 강제할 수 있습니다. 완벽하진 않지만 §5-3에 막는 것과 못 막는 것을 정직하게 구분해 두었습니다.

> **참고**: Blaze로 전환해도 이 규모(500명·3일)라면 무료 할당량을 넘지 않아 실제 청구액은 $0에 가깝습니다. 카드 등록만 가능하시면 A안이 훨씬 안전합니다. 예산 상한(예: $5)을 걸어두는 것도 가능합니다. **결정은 맡기되, B안으로 진행 가능하도록 설계했습니다.**

### 2-3. 🔴 Next.js를 쓸 수 없습니다 (스택 변경)

Spark 플랜의 Firebase Hosting은 **정적 파일만 서빙**합니다. Next.js의 서버 컴포넌트·API 라우트·SSR은 전부 서버 런타임(Functions 또는 App Hosting = Blaze)이 필요합니다.

PART 4가 확정했던 `src/app/api/staff/unlock/route.ts` 같은 API 라우트는 **존재할 수 없습니다.**

| 항목 | 기존(PART 4) | v2 확정 |
|---|---|---|
| 프레임워크 | Next.js App Router | **Vite + React (SPA)** |
| 라우팅 | Next.js 파일 라우팅 | React Router |
| API 라우트 | `app/api/*` | **없음** — Firestore SDK 직접 호출 |
| 스태프 인증 | 서버 쿠키 재검증 | **Firebase Auth 이메일 계정 + `admins` 컬렉션** |
| 빌드 산출물 | `.next` (서버 포함) | 정적 `dist/` |

부수 효과로 **번들이 작아집니다.** §3-3에서 보듯 번들 크기가 곧 무료 한도 문제라, 이 변경은 오히려 유리합니다.

### 2-4. Spark 플랜 할당량 (⚠️ 검증 필요 — 요금제는 변경될 수 있으므로 착수 전 콘솔에서 재확인)

| 서비스 | 무료 한도 | 이 프로젝트에서의 의미 |
|---|---|---|
| Firestore 읽기 | 50,000 / 일 | §3-2 — 설계에 따라 초과 가능 |
| Firestore 쓰기 | 20,000 / 일 | §3-2 — 여유 있음 |
| Firestore 저장 | 1 GiB | 텍스트만 저장하므로 문제 없음 |
| **Hosting 전송** | **360 MB / 일** | **§3-3 — 가장 빡빡한 병목** |
| Hosting 저장 | 10 GB | 문제 없음 |
| Authentication | 익명 로그인 무료 | 문제 없음 |
| **Cloud Functions** | **사용 불가** | §2-1 |
| Realtime Database 동시 연결 | 100 | **500명에 부족** → RTDB 사용 안 함 |

---

## 3. 500명 × 3일 트래픽 시뮬레이션 (실측 계산)

### 3-1. 가정

- 참가자 500명 / 유령 20종 / 3일
- 활성률: Day1 100% · Day2 80% · Day3 75%
- 1인당 스캔(중복 포함): Day1 8회 · Day2 6회 · Day3 6회 → **총 8,650회**
- 앱 콜드 스타트 3회/일, 랭킹 조회 4회/일
- 보안 규칙 내 `get()`도 문서 읽기로 과금됨을 반영

### 3-2. 🔴 기존 설계를 그대로 옮기면 첫날부터 한도를 241% 초과합니다

| 설계 | Day 1 쓰기 | Day 1 읽기 | 판정 |
|---|---|---|---|
| **A. Supabase 설계 그대로 이식** (스캔당 문서 4개 갱신 + 랭킹 쿼리 50 read) | 16,980 / 20,000 (85%) ⚠️ | **120,500 / 50,000 (241%)** ❌ | **초과** |
| **B. 비정규화 + 랭킹 스냅샷** (채택) | 8,980 / 20,000 (45%) ✅ | 18,500 / 50,000 (37%) ✅ | **안전** |

읽기를 폭발시키는 주범은 **랭킹 화면**입니다. `players`를 `orderBy(xp).limit(50)`으로 조회하면 **1회 조회당 50 read**가 발생하고, 500명이 하루 4번 보면 100,000 read입니다. 한도의 2배입니다.

**해결: 랭킹 스냅샷 패턴** — 순위표를 `leaderboard/snapshot` **단일 문서**에 미리 계산해 넣고, 학생은 이 문서 1개만 읽습니다. 조회당 50 read → **1 read**로 줄어듭니다.

스냅샷 갱신은 Functions가 없으므로 **관리자 페이지가 열려 있는 동안 60초마다 자동 실행**합니다. 행사 중 운영자 노트북에 관리자 탭을 띄워두면 그게 사실상 크론 역할을 합니다. (갱신 1회 = 500 read + 1 write. 8시간 × 60회 = 480회 → 하루 240,000 read... **한도 초과**)

> ⚠️ **정정**: 60초 주기 갱신은 그 자체로 한도를 초과합니다. **갱신 주기를 5분으로 늘리고(96회/일 × 500 read = 48,000 read) — 이것도 한도의 96%라 위험합니다.**
>
> **최종 확정안**: 스냅샷 갱신 시 `orderBy(xp).limit(50)`만 조회 → 갱신 1회 = **50 read**.
> 5분 주기 × 8시간 = 96회 × 50 = **4,800 read/일**. 안전합니다.
> 전체 참가자 수 같은 집계는 Firestore `count()` 집계 쿼리를 쓰면 문서 읽기 없이 얻을 수 있습니다(집계 쿼리는 별도 과금 체계 — 검증 필요).

### 3-3. Hosting 전송량 — 가장 빡빡한 병목

| 시나리오 | 첫 로드 크기 | 500명 Day1 전송 | 판정 |
|---|---|---|---|
| **목표 예산** (JS 180 + CSS 15 + HTML 5 + SVG 20종 160 + 폰트 40) | 400 KB | 195 MB / 360 MB (54%) | ✅ |
| 라이브러리 남용 | 800 KB | 391 MB / 360 MB (109%) | ❌ 초과 |
| **유령 이미지를 PNG로 제작** | 1,500 KB | 732 MB / 360 MB (203%) | ❌ 초과 |

**여기서 나오는 강제 규칙 3가지:**

1. **유령 이미지는 반드시 SVG.** PNG를 쓰면 하루치 전송량이 2배 넘게 초과되어 **행사 도중 사이트가 죽습니다.** (PART 1 §3-4의 아트 제작 방식 결정에 이 제약을 반영해야 합니다 — AI 생성 이미지를 쓴다면 SVG 벡터화 후처리가 **선택이 아니라 필수**입니다.)
2. **번들 gzip 250 KB 하드 예산.** CI에서 초과 시 빌드 실패 처리.
3. **서비스워커 캐시 필수.** 재방문 전송량을 0으로 만들어야 Day2·Day3가 버팁니다.

### 3-4. 결론

**B 설계 + SVG + 250KB 예산을 지키면 500명 × 3일을 Firebase 무료로 완주할 수 있습니다.** 단 위 3가지 중 하나라도 어기면 행사 중 서비스가 중단됩니다.

---

## 4. Firestore 데이터 모델 (PART 3 전면 대체)

### 4-1. 설계 원칙

관계형 정규화를 **버립니다.** 읽기 횟수가 곧 비용이므로, **한 번의 읽기로 화면 하나를 그릴 수 있게** 비정규화합니다.

| 원칙 | 이유 |
|---|---|
| 플레이어의 모든 상태를 `players/{uid}` **단일 문서**에 | 앱 진입 시 1 read로 홈·도감·미션·배지를 전부 그림 |
| 발견한 유령 정보를 `discoveries` 맵에 **복사 저장** | 도감 상세 진입 시 추가 read 0 |
| 랭킹은 `leaderboard/snapshot` **단일 문서** | 조회당 50 read → 1 read |
| 도감 그리드는 `catalog/public` **단일 문서** | 미발견 유령 정보 노출 없이 1 read |
| 원장(`scanLogs`)은 **쓰기 전용** | 학생은 읽지 못함. 시상 시 사후 재계산용 |

### 4-2. 컬렉션 구조

```
codes/{slug}                  ← 문서 ID = QR에 인코딩된 랜덤 슬러그
  ghostId          string     // GHOST_007
  ghostName        string     // 복도령        (비정규화)
  ghostDesc        string     //               (비정규화)
  rarity           string     // COMMON | RARE | EPIC | LEGENDARY | MYTHIC
  attribute        string     // DUST | SOUND | ...
  imageKey         string     // ghost-007  (SVG 파일명)
  floor            number     // 1 | 2 | 3
  xpReward         number
  coinReward       number
  isActive         boolean
  activeFrom       timestamp  // 등급별 순차 해금 (Day2 Epic, Day3 Legendary/Mythic)
  activeUntil      timestamp
  placement        string     // "2층 복도 정수기 옆" (운영자 메모)
  copyNo           number     // 1|2|3 - 같은 유령의 몇 번째 카드인가

catalog/public                ← 단일 문서, 도감 그리드용
  ghosts           array      // [{ no, ghostId, rarity, floor, silhouetteKey }]
  totalCount       number     // 20
  updatedAt        timestamp
  ※ 이름·설명 없음 = 미발견 유령 스포일러 차단

eventConfig/current           ← 단일 문서
  status           string     // 'before' | 'running' | 'ended'
  startsAt         timestamp
  endsAt           timestamp
  levelThresholds  array      // 누적 XP 임계값 20개
  duplicateCoin    number     // 중복 발견 코인
  rules            map        // { scanCooldownSec, maxScansPerMin,
                              //   sameGhostDailyLimit, duplicateRewardEnabled }

players/{uid}                 ← uid = Firebase 익명 인증 UID
  nickname         string     // 2~8자
  xp, coins, level number
  discoveries      map        // { [ghostId]: { firstAt, lastAt, count,
                              //                name, rarity, imageKey, floor } }
  missions         map        // { [missionId]: { progress, completed, completedAt } }
  badges           map        // { [badgeId]: earnedAt }
  lastScanAt       timestamp  // 쿨다운 판정용
  lastScanSlug     string     // 보안 규칙이 검증에 사용
  recoveryCode     string     // GG-XXXX-XXXX (계정 유실 복구)
  createdAt, lastActiveAt

scanLogs/{autoId}             ← 원장. 학생은 쓰기만 가능, 읽기 불가
  uid, slug, ghostId, isNew, xpGained, coinGained, source, at

leaderboard/snapshot          ← 단일 문서, 관리자 탭이 5분마다 갱신
  top              array      // [{ rank, nickname, level, xp }]
  totalPlayers     number
  updatedAt        timestamp

admins/{uid}                  ← 관리자 화이트리스트 (Firebase 콘솔에서 직접 추가)
  role             string     // 'admin' | 'staff'
```

### 4-3. 핵심 트릭 — 슬러그를 모르면 유령의 존재조차 알 수 없다

PART 0 모순 1에서 확정한 **랜덤 슬러그**를 Firestore에서는 이렇게 구현합니다.

- `codes` 컬렉션의 **문서 ID 자체를 슬러그**로 씁니다 (`codes/GG1-7K3M9XQ2VB`).
- 보안 규칙에서 **`list`(목록 조회)를 금지하고 `get`(단건 조회)만 허용**합니다.
- 그러면 학생은 **정확한 슬러그를 알아야만** 문서를 읽을 수 있습니다. 슬러그를 안다 = QR을 봤다.
- 순차 ID(`G01`)였다면 20번 시도로 전부 뚫렸을 공격이 **원천 차단**됩니다.

이게 Functions 없이도 성립하는 이유입니다. 인증·권한이 아니라 **탐색 공간의 크기**로 방어합니다.

### 4-4. QR 페이로드 최종 확정

```
HTTPS://<프로젝트>.WEB.APP/S/GG1-XXXXXXXXXX
```

- 전부 **대문자** — QR 영숫자 모드를 유지해 모듈 수를 줄임 (인식률 ↑)
- 슬러그: Crockford Base32 10자 (혼동 문자 I·L·O·U 제외) → 탐색 공간 32^10 ≈ 1.1 × 10^15
- `GG1-` 프리픽스로 외부 QR과 구분
- 슬러그는 **유령당 3개**(카드 3장) 발급 → 총 60개, 전부 같은 `ghostId`를 가리킴

---

## 5. 보안 규칙 (RLS 대체)

### 5-1. `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    function signedIn()      { return request.auth != null; }
    function isSelf(uid)     { return signedIn() && request.auth.uid == uid; }
    function isAdmin()       { return signedIn() && exists(/databases/$(db)/documents/admins/$(request.auth.uid)); }
    function cfg()           { return get(/databases/$(db)/documents/eventConfig/current).data; }
    function eventOpen()     { return cfg().status == 'running'
                                 && request.time >= cfg().startsAt
                                 && request.time <= cfg().endsAt; }

    // 유령 코드: get만 허용. list 금지 → 슬러그를 모르면 존재조차 알 수 없음
    match /codes/{slug} {
      allow get:    if signedIn();
      allow list:   if isAdmin();
      allow write:  if isAdmin();
    }

    match /catalog/{doc}     { allow read: if signedIn(); allow write: if isAdmin(); }
    match /eventConfig/{doc} { allow read: if signedIn(); allow write: if isAdmin(); }
    match /leaderboard/{doc} { allow read: if signedIn(); allow write: if isAdmin(); }
    match /admins/{uid}      { allow read: if isAdmin();  allow write: if false; }

    // 원장: 학생은 쓰기만. 자기 로그도 읽지 못함(조작 유인 차단)
    match /scanLogs/{id} {
      allow create: if isSelf(request.resource.data.uid) && eventOpen();
      allow read, update, delete: if isAdmin();
    }

    match /players/{uid} {
      allow get:  if isSelf(uid) || isAdmin();
      allow list: if isAdmin();

      allow create: if isSelf(uid)
        && request.resource.data.xp == 0
        && request.resource.data.coins == 0
        && request.resource.data.level == 1
        && request.resource.data.discoveries.size() == 0
        && request.resource.data.nickname is string
        && request.resource.data.nickname.size() >= 2
        && request.resource.data.nickname.size() <= 8;

      allow update: if isSelf(uid) && eventOpen() && validScan();
      allow delete: if isAdmin();

      // ---- 스캔 갱신 검증 ----
      function code() {
        return get(/databases/$(db)/documents/codes/$(request.resource.data.lastScanSlug)).data;
      }
      function isNew()      { return !(code().ghostId in resource.data.discoveries); }
      function expectXp()   { return isNew() ? code().xpReward : 0; }
      function expectCoin() { return isNew() ? code().coinReward : cfg().duplicateCoin; }
      function cooldownOk() {
        return resource.data.lastScanAt == null
          || request.time > resource.data.lastScanAt
                            + duration.value(cfg().rules.scanCooldownSec, 's');
      }
      // 새로 추가된 도감 키가 '방금 스캔한 그 유령'인지 확인
      function dexOk() {
        return isNew()
          ? request.resource.data.discoveries.keys()
              .removeAll(resource.data.discoveries.keys()) == [code().ghostId]
          : request.resource.data.discoveries.keys() == resource.data.discoveries.keys();
      }
      function validScan() {
        return request.resource.data.diff(resource.data).affectedKeys().hasOnly([
                 'xp','coins','level','discoveries','missions','badges',
                 'lastScanAt','lastScanSlug','lastActiveAt'
               ])
          && code().isActive == true
          && request.time >= code().activeFrom
          && request.time <= code().activeUntil
          && cooldownOk()
          && request.resource.data.lastScanAt == request.time
          && request.resource.data.xp    == resource.data.xp    + expectXp()
          && request.resource.data.coins == resource.data.coins + expectCoin()
          && dexOk();
      }
    }
  }
}
```

> ⚠️ **에뮬레이터 검증 필수.** 위 규칙은 설계안이며, 특히 `removeAll()`·`keys()` 리스트 비교·`duration.value()` 동작은 Firebase 에뮬레이터(`firebase emulators:start`)로 **반드시 테스트한 뒤** 배포해야 합니다. 규칙 버그는 곧 전면 개방입니다.
>
> 또한 규칙 내 `get()`은 **단일 요청당 10회 제한**이 있습니다. 위 규칙은 `eventConfig/current`와 `codes/{slug}` 2개 문서만 접근하므로 여유가 있습니다.

### 5-2. 이 규칙이 막는 것 / 못 막는 것 (정직하게)

| 공격 | 방어 여부 | 근거 |
|---|---|---|
| 콘솔로 `xp: 999999` 쓰기 | ✅ 완전 차단 | XP 증가량이 스캔한 코드의 보상값과 정확히 일치해야 함 |
| 코드 추측(`G01`~`G20` 입력) | ✅ 완전 차단 | 슬러그 탐색 공간 10^15 + `list` 금지 |
| 남의 계정 조작 | ✅ 완전 차단 | `isSelf(uid)` |
| 같은 QR 연속 스캔으로 코인 파밍 | ✅ 차단 | 쿨다운 + 중복은 XP 0 |
| 이벤트 종료 후 스캔 | ✅ 차단 | `eventOpen()` |
| 값싼 유령 스캔하며 비싼 유령을 도감에 추가 | ✅ 차단 | `dexOk()` |
| 미발견 유령의 이름·설명 미리 보기 | ✅ 차단 | `catalog/public`에 이름 없음 |
| **QR 사진을 찍어 친구에게 전송** | ❌ **못 막음** | Functions가 있어도 동일. 물리적 방문 여부는 어떤 서버도 알 수 없음 |
| **`badges`·`missions` 필드 임의 조작** | ❌ **못 막음** | 검증 로직이 너무 복잡해 규칙으로 표현 불가 |

**못 막는 2가지에 대한 대응:**

- **QR 사진 공유** → 코드 다중화(유령당 3장)로 "어느 카드를 찍었는지"가 로그에 남습니다. 같은 슬러그가 짧은 시간에 여러 계정에서 스캔되면 `scanLogs`에서 탐지됩니다. 완전 차단이 아니라 **사후 탐지 + 억제**입니다.
- **배지·미션 조작** → 화면에 보이는 배지·미션은 **표시용**으로만 취급합니다. **최종 시상은 반드시 `scanLogs` 원장을 기준으로 재계산**합니다. 학생이 배지를 위조해도 시상에는 영향이 없습니다. (이 원칙을 학생에게 미리 공지하면 시도 자체가 줄어듭니다.)

---

## 6. 500명 대응 — QR 다중화

### 6-1. 대기열 계산 (쉬는 시간 10분, 활동 학생 300명 기준)

| 유령당 카드 | QR 지점 수 | 지점당 인원 | 예상 대기 | 판정 |
|---|---|---|---|---|
| 1장 | 20 | 15.0명 | 120초 | ⚠️ 쉬는 시간의 20%를 줄 서기에 소모 |
| 2장 | 40 | 7.5명 | 60초 | ✅ |
| **3장** | **60** | **5.0명** | **40초** | ✅ **채택** |
| 4장 | 80 | 3.8명 | 30초 | 과잉 (인쇄·부착 부담) |

*처리 시간 8초/명 = 접근 3s + 스캔 2s + 연출 4.2s + 이탈 3s (중첩 반영)*

### 6-2. 확정 인쇄 수량

| 항목 | 수량 |
|---|---|
| 유령 종수 | 20종 |
| 유령당 카드 | 3장 (서로 다른 슬러그, 같은 `ghostId`) |
| **총 QR 카드** | **60장** |
| 층별 배치 | 1층 18장(6종) · 2층 21장(7종) · 3층 21장(7종) |
| QR 크기 | 70 mm (어두운 구역은 120 mm 별도 세트) |
| A4 배치 | 4장/A4 → **15장** |
| 예비 인쇄 | +5장 (훼손·도난 대비) |
| **총 인쇄** | **A4 20장** |

같은 유령의 카드 3장은 **서로 다른 장소**에 배치합니다. 한 곳에 몰리면 다중화 효과가 없습니다.

---

## 7. 3일 일정 확정 (모순 17 해소)

행사 3일 확정으로 PART 1의 등급 순차 해금 설계가 **그대로 유효**합니다.

| 일차 | 활성 유령 | 누적 | 운영 |
|---|---|---|---|
| Day 1 | Common 8 + Rare 6 | 14종 | 온보딩. 1층 Common을 눈높이에 배치 |
| Day 2 | + Epic 4 | 18종 | 아침 방송 "3층에 새 유령이 나타났다" |
| Day 3 오전 | + Legendary 1 | 19종 | 안내 방송 1회 |
| Day 3 12:20~13:20 | + **Mythic 1** | 20종 | **60분 한정.** `activeUntil`로 서버가 자동 마감 |

해금은 코드 수정 없이 `codes/{slug}`의 `activeFrom`·`activeUntil` 값으로 제어합니다. 관리자 페이지에서 일괄 편집할 수 있어야 합니다.

---

## 8. 변경된 기술 스택 (PART 4 §1~3 대체)

| 레이어 | v2 확정 | 비고 |
|---|---|---|
| 프레임워크 | **Vite + React 18 + TypeScript** | Next.js 불가 (§2-3) |
| 라우팅 | React Router | |
| 스타일 | Tailwind CSS | PART 2의 디자인 토큰 그대로 사용 |
| 상태 | TanStack Query + Zustand(경량) | 번들 예산 주의 |
| DB | **Cloud Firestore** | §4 |
| 인증 | **Firebase Auth 익명 로그인** | 관리자만 이메일 계정 |
| 서버 로직 | **없음 — 보안 규칙으로 대체** | §5 |
| 호스팅 | **Firebase Hosting** (정적) | 360 MB/일 주의 |
| QR 스캔 | `BarcodeDetector` 우선 → 미지원 시 라이브러리 폴백 | PART 4 §2 계층 설계 유지 |
| PWA | `vite-plugin-pwa` | 설치 유도 UI는 기본 OFF (모순 21) |
| 이미지 | **SVG 전용** | PNG 금지 (§3-3) |
| 번들 예산 | **gzip 250 KB 하드 리밋** | CI에서 초과 시 빌드 실패 |

---

## 9. 확인이 필요한 사항

### 9-1. 「마누스 에이전트로 만들 예정」의 범위

답변 4번을 주셨는데, 제가 다음 단계로 무엇을 해야 할지가 달라집니다.

- **(a)** 마누스가 코드를 작성 → 저는 마누스가 그대로 실행할 수 있는 **정밀 구현 명세**를 만듭니다
- **(b)** 제가 PHASE 1 코드를 작성 → 원래 요청대로 바로 코딩에 들어갑니다
- **(c)** 유령 아트 20종만 마누스가 제작 → 코드는 제가 작성합니다

**유령 아트를 마누스로 만드신다면 §3-3의 SVG 제약을 반드시 전달하셔야 합니다.** PNG로 받으면 행사 당일 사이트가 전송량 초과로 중단됩니다.

### 9-2. Blaze 전환 여부 (선택)

무료로 진행하는 데 지장 없도록 설계했지만, 카드 등록이 가능하시면 Blaze + 예산 상한 $5 설정이 부정행위 방어 측면에서 확실히 낫습니다. **결정은 맡깁니다 — B안(무료)으로도 완주 가능합니다.**

### 9-3. Firebase 요금제 재확인

§2-4의 할당량 수치는 제 지식 기준이며 요금제는 변경될 수 있습니다. **프로젝트 생성 직후 Firebase 콘솔에서 실제 한도를 확인**하고, 특히 다음 두 가지를 검증해야 합니다.

1. Cloud Functions가 정말 Spark에서 불가한지
2. Firestore `count()` 집계 쿼리의 과금 방식

---

## 10. 문서 간 정합성 — 무효화된 기존 결정

| 기존 결정 | 위치 | v2 처리 |
|---|---|---|
| PostgreSQL `CREATE TABLE` 전체 | PART 3 §2 | ❌ 폐기 → §4-2 |
| `api_scan()` plpgsql RPC | PART 3 §4, 모순 9 | ❌ 폐기 → §5 보안 규칙 |
| RLS 정책 SQL | PART 3 §5, 모순 12 | ❌ 폐기 → §5-1 |
| `idempotency_key` (모순 8) | PART 0 | ⚠️ 재설계 필요 — Firestore 트랜잭션으로 대체 |
| snake_case 응답 규약 (모순 10) | PART 0 | ❌ 무의미 → Firestore는 camelCase 통일 |
| HTTP 200 + `{ok:false}` (모순 11) | PART 0 | ❌ 무의미 → SDK 예외 처리로 대체 |
| `coin_ledger` 테이블 (모순 18) | PART 0 | ⚠️ `scanLogs`가 원장 역할 겸함 |
| Next.js 폴더 구조 (모순 23) | PART 0 | ❌ 폐기 → Vite 구조로 재작성 필요 |
| 랜덤 슬러그 (모순 1) | PART 0 | ✅ **유지** — Firestore 문서 ID로 구현 |
| 스태프 대행 입력 (모순 2) | PART 0 | ⚠️ API 라우트 불가 → `admins` 컬렉션 방식으로 변경 |
| 유령 20종 단일 진실 (치명 2) | PART 0 | ✅ **유지** — `codes` 시드가 정본 |
| QR 70mm / ECC H (모순 14) | PART 0 | ✅ **유지** |
| 발견 연출 4.2초 (모순 6) | PART 0 | ✅ **유지** — §6-1 대기열 계산의 근거 |
| 계단 2m 룰 (모순 15) | PART 0 | ✅ **유지** |

---

*작성: 2026-09-01 · 대체 대상 문서: `GHOST_GO_기획서.md`*
