# ReviewPace Frontend Implementation Guide

이 문서는 내일 새로운 Codex 대화 컨텍스트에서 프론트엔드를 구현할 때 사용할 전용 명세다. `README.md`가 데이터 수집/통계 빌드까지 포함한 전체 인수인계 문서라면, 이 문서는 Figma 디자인을 실제 React 앱으로 옮기기 위한 구현 기준이다.

## 목표

ReviewPace는 우테코 PR 리뷰 흐름을 탐색하는 대시보드다.

핵심 사용 흐름:

1. 메인에서 전체 데이터 규모와 최근 활동자를 본다.
2. 크루, 리뷰어, 미션, PR, 트랙 비교 화면으로 진입한다.
3. 사람이나 미션 단위로 제출, 첫 리뷰, 재요청, 재리뷰, 완료까지 걸린 시간을 분석한다.

메인 화면은 특정 크루/리뷰어 분석 화면이 아니다. 따라서 메인에서는 상세 시간 지표를 과하게 보여주지 않는다. 상세 시간 분석은 각각의 상세 페이지에서 보여준다.

## 디자인 기준

Figma 기준:

- 파일: `우테콘`
- 페이지: `스타크`
- 주요 프레임:
  - `01 Desktop / Overview Dashboard`
  - `02 Desktop / Crew Detail`
  - `03 Desktop / Reviewer Detail`
  - `04 Desktop / Mission Detail`
  - `05 Desktop / PR Drilldown`
  - `06 Desktop / Compare`
  - `07 Mobile / Overview`
  - `08 Mobile / Crew Detail`
  - `09 Desktop / Reviewer Match`
  - `10 Desktop / Candidate Compare`
  - `11 Mobile / Reviewer Match`
  - `12 Mobile / Candidate Compare`

디자인 레퍼런스:

- `https://kawai-text-animation.pages.dev/`

적용 방향:

- 어두운 배경
- 얇은 그리드 라인
- 낮은 대비의 카드
- 큰 타이포그래피
- 보라, 연두, 하늘, 노랑 계열의 포인트 컬러
- 마케팅 랜딩 페이지가 아니라 실제 도구형 대시보드
- 카드 radius는 8px 이하
- 불필요한 설명문 대신 데이터와 탐색 액션 중심

## 페이지 구조

권장 라우트:

```text
/                  Overview
/crew/:githubId    Crew Detail
/reviewer/:githubId Reviewer Detail
/missions          Mission Board
/missions/:repo    Mission Detail
/prs/:repo/:number PR Drilldown
/compare           Track Compare
/matches           Reviewer Match
/matches/compare   Candidate Compare
```

초기 구현에서 라우팅이 부담되면 `react-router-dom` 없이 상태 기반 화면 전환으로 시작해도 된다. 다만 최종 배포 전에는 URL 공유가 가능하도록 라우팅을 넣는 것이 좋다.

## Overview 화면

메인 화면에 보여줄 것:

- `Closed PRs`
- `Review Events`
- `Repositories`
- `People`
- 검색창
- 필터 칩: `All`, `Backend`, `Frontend`, `Android`
- `Recently Active Crew` infinite avatar marquee
- `Recently Active Reviewers` infinite avatar marquee
- 상세 화면 진입 카드:
  - `Crew Pace`
  - `Reviewer Rhythm`
  - `Mission Board`
  - `Track Compare`
- `Track Distribution`
- `Data Freshness`

메인 화면에서 제외할 것:

- `Median First Review`
- `Median Completion`
- `Active Hours`

이 지표들은 전체 평균으로 보면 해석이 흐려진다. 다음 화면에서 보여준다.

- `Median First Review`: Crew Detail, Reviewer Detail, Mission Detail, Compare
- `Median Completion`: Crew Detail, Mission Detail, Compare
- `Active Hours`: Crew Detail, Reviewer Detail, Mission Detail, Compare

## Infinite Avatar Marquee

메인 화면에는 두 줄의 marquee가 들어간다.

```text
Recently Active Crew
[avatar] softmoca  [avatar] hanni  [avatar] nana  ... 무한 이동

Recently Active Reviewers
[avatar] Gomding  [avatar] brown  [avatar] eve  ... 무한 이동
```

효과 명칭:

- `Infinite Marquee`
- `Avatar Marquee`
- `Infinite scrolling marquee`

검색 키워드:

```text
infinite avatar marquee UI
CSS marquee pause on hover
infinite logo marquee dark UI
avatar marquee hover preview
```

구현 기준:

- 같은 리스트를 2번 이어 붙여 끊김 없이 반복한다.
- `Recently Active Crew`와 `Recently Active Reviewers`는 서로 반대 방향으로 움직여도 좋다.
- marquee 영역 양끝에는 gradient mask를 넣어 자연스럽게 사라지게 한다.
- marquee 영역에 hover하면 애니메이션을 멈춘다.
- avatar item에 hover하면 살짝 커지고 glow가 강해진다.
- avatar item 클릭 시 해당 사람의 상세 페이지로 이동한다.

CSS 예시:

```css
.marquee {
  overflow: hidden;
  mask-image: linear-gradient(
    90deg,
    transparent,
    #000 8%,
    #000 92%,
    transparent
  );
}

.marquee-track {
  display: flex;
  width: max-content;
  animation: marquee-left 38s linear infinite;
}

.marquee:hover .marquee-track {
  animation-play-state: paused;
}

@keyframes marquee-left {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
```

## Glow 스타일

현재 디자인 결정:

- 기본 상태부터 은은한 glow가 있다.
- hover 시 glow가 더 진해진다.
- 명시적인 컬러 테두리는 추가하지 않는다.
- 카드 경계는 레이아웃 구분용 아주 약한 기본 라인만 둔다.
- 효과는 `box-shadow`와 뒤쪽 aura 느낌으로 만든다.

기본값:

```css
.surface {
  border: 1px solid rgba(42, 42, 42, 0.28);
  box-shadow: 0 0 32px rgba(168, 85, 247, 0.18);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background-color 180ms ease;
}
```

hover:

```css
.surface:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 48px rgba(168, 85, 247, 0.30);
}
```

avatar item:

```css
.avatar-item {
  border-color: transparent;
  box-shadow: 0 0 24px rgba(183, 255, 90, 0.14);
}

.avatar-item:hover {
  transform: scale(1.03);
  box-shadow: 0 0 36px rgba(183, 255, 90, 0.26);
}
```

주의:

- 모든 카드에 같은 색 glow를 쓰면 단조롭다. 카드 유형별로 보라, 연두, 하늘, 노랑을 섞는다.
- glow opacity를 더 올릴 때는 큰 패널보다 작은 카드/아바타에 먼저 적용한다.
- border 색상을 강하게 바꾸면 지금 원하는 느낌과 달라진다.

## Active Hours

`Active Hours`는 GitHub 잔디밭처럼 보이되, 색의 의미가 즉시 읽혀야 한다.

구성:

- 요일 축: `Mon` ~ `Sun`
- 시간 축: `00`, `03`, `06`, `09`, `12`, `15`, `18`, `21`
- 범례:
  - `0`
  - `1-2`
  - `3-5`
  - `6-9`
  - `10+`
- 선택된 칸 설명:
  - 예: `Wed 15:00-18:00`
  - `12 reviews`
  - `첫 리뷰 8건 · 재리뷰 4건`

메인 화면에는 `Active Hours`를 넣지 않는다. 아래 상세 화면에 넣는다.

- Crew Detail
- Reviewer Detail
- Mission Detail
- Compare

## 데이터 사용 원칙

브라우저에서 `public/stats.json`을 직접 읽지 않는다. 현재 `stats.json`은 약 66MB라서 앱 진입 시 매번 계산하면 느리다.

프론트는 최종적으로 아래 파일만 읽는 것을 목표로 한다.

- `public/members.json`
- `public/person-stats.json`
- 필요하면 `public/summary.json`
- 필요하면 `public/recent-activity.json`

아직 `person-stats.json`, `summary.json`, `recent-activity.json`이 없다면 먼저 빌드 스크립트를 만든다.

## 권장 산출 JSON

### `public/person-stats.json`

사람 상세 화면용.

```json
{
  "generatedAt": "2026-05-22T00:00:00.000Z",
  "people": {
    "softmoca": {
      "githubId": "softmoca",
      "nickname": "모카",
      "avatarUrl": "https://...",
      "track": "backend",
      "cohort": 7,
      "asCrew": {
        "totalPRs": 22,
        "avgFirstReviewHours": 7.3,
        "avgReRequestHours": 9.5,
        "avgMissionHours": 54.2,
        "activityByHour": [0, 1, 0]
      },
      "asReviewer": {
        "reviewedPRs": 12,
        "reviewEvents": 48,
        "avgFirstResponseHours": 5.1,
        "avgRereviewHours": 6.4,
        "rereviewSamples": 9,
        "activityByHour": [0, 0, 2]
      }
    }
  }
}
```

### `public/summary.json`

메인/비교 화면용.

```json
{
  "generatedAt": "2026-05-22T00:00:00.000Z",
  "totalPRs": 19295,
  "totalReviewEvents": 219865,
  "totalRepos": 78,
  "totalPeople": 883,
  "trackDistribution": [
    { "track": "backend", "prs": 9205 },
    { "track": "frontend", "prs": 6210 },
    { "track": "android", "prs": 3880 }
  ]
}
```

### `public/recent-activity.json`

메인 marquee용.

```json
{
  "generatedAt": "2026-05-22T00:00:00.000Z",
  "crew": [
    {
      "githubId": "softmoca",
      "nickname": "모카",
      "avatarUrl": "https://...",
      "track": "backend",
      "repo": "woowacourse/spring-roomescape-member",
      "eventType": "RE_REQUEST",
      "occurredAt": "2026-05-21T12:00:00.000Z"
    }
  ],
  "reviewers": [
    {
      "githubId": "Gomding",
      "nickname": null,
      "avatarUrl": null,
      "track": "backend",
      "repo": "woowacourse/spring-roomescape-member",
      "eventType": "FIRST_REVIEW",
      "occurredAt": "2026-05-21T12:10:00.000Z"
    }
  ]
}
```

## 컴포넌트 구조

권장 파일 구조:

```text
src/
  App.jsx
  main.jsx
  styles/
    globals.css
  data/
    loaders.js
  hooks/
    useMembers.js
    usePersonStats.js
    useSummary.js
    useRecentActivity.js
  utils/
    time.js
    stats.js
    classNames.js
  components/
    layout/
      AppShell.jsx
      Header.jsx
      PageGrid.jsx
    common/
      Surface.jsx
      MetricCard.jsx
      SearchBox.jsx
      TrackChip.jsx
      EmptyState.jsx
    marquee/
      AvatarMarquee.jsx
      AvatarMarqueeItem.jsx
    charts/
      ActiveHoursHeatmap.jsx
      TrackDistribution.jsx
      Timeline.jsx
    pages/
      OverviewPage.jsx
      CrewDetailPage.jsx
      ReviewerDetailPage.jsx
      MissionBoardPage.jsx
      MissionDetailPage.jsx
      PrDrilldownPage.jsx
      ComparePage.jsx
      ReviewerMatchPage.jsx
      CandidateComparePage.jsx
```

## 컴포넌트별 구현 메모

### `Surface`

모든 카드의 기본 래퍼.

역할:

- dark panel 배경
- 아주 약한 border
- 기본 glow
- hover glow
- radius 8px

props:

```js
{
  as,
  className,
  glow = "purple" | "green" | "cyan" | "yellow",
  interactive = false,
  children
}
```

### `AvatarMarquee`

props:

```js
{
  title,
  subtitle,
  items,
  direction = "left" | "right",
  onItemClick
}
```

동작:

- `items`를 2번 이어 붙여 렌더링한다.
- hover 시 animation pause.
- item hover 시 glow 강화와 scale.
- click 시 상세 화면 이동.

### `ActiveHoursHeatmap`

props:

```js
{
  matrix,
  selectedSlot,
  onSelectSlot
}
```

주의:

- 색만으로 의미를 전달하지 않는다.
- 축과 범례를 반드시 같이 보여준다.
- 모바일에서는 가로 스크롤 또는 축 축약을 고려한다.

### `Timeline`

PR Drilldown과 사람 상세 화면에 사용.

보여줄 이벤트:

- PR opened
- first review
- changes requested
- crew re-request
- re-review
- approved
- merged/closed

### `ReviewerMatch`

Reviewer Match는 두 화면으로 구성한다.

- `ReviewerMatchPage`: 특정 크루와 주기가 가장 잘 맞는 같은 트랙 리뷰어 자동 추천
- `CandidateComparePage`: 특정 크루에 대해 후보 리뷰어를 직접 추가하고 후보 안에서 비교

Figma 기준:

- `09 Desktop / Reviewer Match`
- `10 Desktop / Candidate Compare`
- `11 Mobile / Reviewer Match`
- `12 Mobile / Candidate Compare`

주의 문구:

```text
리뷰 품질이 아닌 활동 시간대와 응답 이력을 기준으로 한 추천입니다.
```

트랙 제한:

- 자동 추천은 반드시 같은 트랙 리뷰어만 후보로 사용한다.
- backend 크루는 backend 리뷰어만 추천한다.
- frontend 크루는 frontend 리뷰어만 추천한다.
- android 크루는 android 리뷰어만 추천한다.
- 후보 직접 비교에서는 다른 트랙 후보가 들어올 수 있지만, 기본 비교에서는 제외하고 `different track` 경고를 보여준다.
- 다른 트랙 후보를 포함하는 모드는 나중에 옵션으로 열 수 있다.

점수 구성:

```text
40% 시간대 궁합
25% 첫 리뷰 응답 속도
20% 재리뷰 응답 속도
10% 같은 트랙/레포 경험
5% 최근 활동성
```

필요 컴포넌트:

- `ReviewerMatchCard`
- `CandidatePicker`
- `MatchScoreBreakdown`
- `OverlapHeatmap`
- `ReviewerRankingTable`

API 초안:

```text
GET /api/matches/:crewGithubId
POST /api/matches/compare
```

`GET /api/matches/:crewGithubId`는 같은 트랙 리뷰어만 반환해야 한다.

`POST /api/matches/compare`는 기본적으로 같은 트랙 후보만 비교하고, 다른 트랙 후보는 `excludedCandidates`로 보여준다.

## 데이터 해석 주의

`stats.json`의 `reviews`에는 PR 작성자가 남긴 `COMMENTED`도 들어온다.

따라서 아래처럼 처리한다.

- `authorRole === "crew"`: PR 작성자 본인의 이벤트
- `authorRole === "reviewer"`: PR 작성자가 아닌 사람의 리뷰 이벤트
- `authorRole === "unknown"`: 삭제 계정 등 login 없음

중요:

- `reviewer` 필드 이름만 보고 모두 리뷰어로 취급하면 안 된다.
- PR 작성자와 같은 GitHub ID의 `COMMENTED`는 재요청/응답 이벤트로 볼 수 있다.
- `members.json`에 없는 GitHub ID도 제거하지 않고 그대로 표시한다.

## 사람 표시 규칙

화면에서는 GitHub ID를 기본 이름처럼 크게 보여주지 않는다. `members.json`에 매핑되는 사람은 우테코 닉네임을 primary label로 사용한다.

표시 형식:

```text
모카
8기 BE · @softmoca
```

구체 규칙:

- primary: `nickname`
- secondary: `{cohort}기 {trackLabel} · @{githubId}`
- avatar: `avatarUrl`
- `trackLabel`은 `backend -> BE`, `frontend -> FE`, `android -> AN`로 축약한다.
- `nickname`이 없으면 primary는 GitHub ID를 사용한다.
- `cohort` 또는 `track`이 없으면 해당 meta 조각은 생략한다.
- `members.json`에 없는 사람은 fallback으로 `@githubId`를 보여준다.
- marquee에서도 닉네임 아래에는 repo가 아니라 기수/트랙을 보여준다.
- 최근 활동 시간은 유지하되 `8기 BE · 12분 전`처럼 기수/트랙 뒤에 작게 붙이거나 별도 작은 라인으로 보여준다.

예시:

```text
members.json 매핑 있음
모카
8기 BE · @softmoca

members.json 매핑 없음
Gomding
@Gomding
```

## 구현 순서

프론트 구현 전에 먼저 데이터 전처리 산출물을 만든다.

1. `scripts/build-person-stats.js` 구현
2. `public/person-stats.json` 생성
3. 가능하면 `public/summary.json`, `public/recent-activity.json`도 생성
4. React + Vite + Tailwind 세팅
5. 공통 스타일 토큰과 `Surface` 구현
6. `OverviewPage` 구현
7. `AvatarMarquee` 구현
8. `CrewDetailPage`, `ReviewerDetailPage` 구현
9. `ActiveHoursHeatmap`, `Timeline` 구현
10. `MissionBoardPage`, `MissionDetailPage`, `PrDrilldownPage`, `ComparePage` 구현
11. `ReviewerMatchPage`, `CandidateComparePage` 구현
12. 모바일 확인
13. `npm run build` 통과
14. Vercel 배포 준비

## Tailwind 토큰 제안

`tailwind.config.js`에 색상을 명시하면 구현이 편하다.

```js
theme: {
  extend: {
    colors: {
      rp: {
        bg: "#080808",
        panel: "#111111",
        panel2: "#151515",
        line: "#2A2A2A",
        text: "#F2F2F2",
        muted: "#A3A3A3",
        subtle: "#6F6F6F",
        purple: "#A855F7",
        green: "#B7FF5A",
        cyan: "#6EE7F9",
        yellow: "#FDE047"
      }
    }
  }
}
```

전역 배경:

```css
body {
  background: #080808;
  color: #f2f2f2;
}

.page-grid {
  background-image:
    linear-gradient(rgba(42, 42, 42, 0.32) 1px, transparent 1px),
    linear-gradient(90deg, rgba(42, 42, 42, 0.32) 1px, transparent 1px);
  background-size: 80px 80px;
}
```

## 내일 사용할 프롬프트

### 프롬프트 1: 프론트 작업 준비

```text
/Users/limkyungpyo/Desktop/woowa/woowa_tecoton 프로젝트에서 작업해줘.

먼저 README.md와 README_Front.md를 읽고 현재 코드베이스를 확인해줘.
Figma 우테콘 파일의 스타크 페이지 디자인을 기준으로 프론트를 구현할 거야.

아직 Plan Mode로 진행하고, 구현 전에 다음을 정리해줘:
- 필요한 데이터 산출물
- 라우트 구조
- 컴포넌트 구조
- Overview부터 어디까지 구현할지
- Vercel 배포 전에 제외해야 할 파일
```

### 프롬프트 2: 데이터 산출물 구현

```text
PLEASE IMPLEMENT THIS PLAN.

우선 scripts/build-person-stats.js를 만들고,
가능하면 public/summary.json, public/recent-activity.json까지 생성해줘.

브라우저 앱은 public/stats.json을 직접 읽지 않게 만들 거야.
```

### 프롬프트 3: 앱 세팅

```text
React + Vite + Tailwind CSS v3 앱을 현재 프로젝트에 세팅해줘.
기존 scripts와 public JSON 파일은 유지해줘.

src 구조는 README_Front.md의 권장 구조를 따르고,
우선 AppShell, Surface, OverviewPage, AvatarMarquee까지 구현해줘.
```

### 프롬프트 4: Figma 기준 Overview 구현

```text
Figma 우테콘 > 스타크 > 01 Desktop / Overview Dashboard 디자인을 기준으로 OverviewPage를 구현해줘.

중요:
- 메인에는 Median First Review, Median Completion, Active Hours를 넣지 않는다.
- Recently Active Crew와 Recently Active Reviewers는 infinite avatar marquee로 구현한다.
- 기본 상태부터 glow가 있고, hover 시 glow가 더 진해진다.
- 명시적인 컬러 테두리는 추가하지 않는다.
- marquee hover 시 애니메이션을 pause한다.
- avatar 클릭 시 상세 페이지로 이동할 수 있게 이벤트 구조를 잡는다.
```

### 프롬프트 5: 상세 페이지 구현

```text
Figma 우테콘 > 스타크 페이지의 나머지 화면을 기준으로 상세 페이지를 구현해줘.

대상:
- Crew Detail
- Reviewer Detail
- Mission Board
- Mission Detail
- PR Drilldown
- Compare
- Reviewer Match
- Candidate Compare

Active Hours는 메인이 아니라 상세 화면에 넣고,
축과 범례, 선택된 칸 설명을 반드시 포함해줘.

Reviewer Match는 리뷰 품질 추천이 아니라 활동 시간대/응답성/경험 기반 추천이라는 점을 UI에 명확히 드러내줘.
```

### 프롬프트 6: 검증

```text
npm run build를 통과시키고 dev server를 띄워줘.
Browser로 실제 화면을 확인하면서 다음을 검증해줘.

- Overview layout
- infinite marquee 동작
- marquee hover pause
- avatar hover glow
- 검색/상세 이동
- 모바일 화면 텍스트 겹침 여부
- stats.json을 브라우저에서 직접 fetch하지 않는지
```

## Vercel 배포 메모

Vite 정적 앱 기준:

- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

배포에 포함할 것:

- `public/members.json`
- `public/person-stats.json`
- `public/summary.json`
- `public/recent-activity.json`

배포에서 제외하는 것을 권장:

- `public/stats.json`
- `.env`
- `.cache/`
- `node_modules/`

주의:

- `GH_TOKENS`는 프론트나 Vercel 환경변수에 필요 없다.
- 데이터 재수집은 로컬에서 실행한다.
- 재수집 후 JSON 산출물을 갱신하고 다시 배포한다.

## 완료 기준

1차 완료:

- Overview 화면이 Figma 방향과 유사하다.
- 최근 활동 크루/리뷰어 marquee가 동작한다.
- 기본 glow와 hover glow가 구현되어 있다.
- `npm run build`가 통과한다.

2차 완료:

- 크루/리뷰어 상세 화면에서 실제 통계가 나온다.
- Active Hours가 축/범례와 함께 나온다.
- 사람 검색과 상세 이동이 가능하다.

최종 완료:

- Mission/PR/Compare 화면까지 연결된다.
- 모바일에서 레이아웃이 깨지지 않는다.
- Vercel에 배포된다.
