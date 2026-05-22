# ReviewPace 개발 인수인계 README

이 문서는 내일 새로운 Codex 대화 컨텍스트에서 바로 이어서 작업하기 위한 작업 지침서다. 현재 프로젝트는 데이터 수집 스크립트와 Supabase 연결 정보까지 준비된 상태이며, 아직 React/Vite 앱 본체는 만들지 않았다.

## 현재 상태

프로젝트 위치:

```bash
/Users/limkyungpyo/Desktop/woowa/woowa_tecoton
```

현재 구현된 것:

- `scripts/fetch-members.js`: who-tech API에서 우테코 멤버 데이터를 받아 `public/members.json` 생성
- `scripts/fetch-stats.js`: GitHub GraphQL API로 78개 레포의 closed/merged PR과 review 이벤트를 받아 `public/stats.json` 생성
- `src/config/repos.js`: 백엔드/프론트엔드/안드로이드 분석 대상 레포 목록
- `.env`: GitHub/Supabase 비밀값 로컬 저장. 절대 커밋하지 말 것
- `.env.example`: 필요한 환경변수 이름만 담은 샘플
- `.gitignore`: `.env`, `.cache/`, `node_modules/` 제외
- `README_Front.md`: Figma 디자인과 프론트 구현 전용 명세

현재 데이터 결과:

- `public/members.json`: 883명
- `public/stats.json`: 19,295개 PR, 219,865개 review 이벤트
- `woowacourse/ssr-basecamp`는 PR 0개라 `stats.json.prs`에는 나타나지 않지만 캐시는 생성됨

Supabase 상태:

- Supabase 프로젝트는 생성 완료
- 로컬 `.env`에는 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`이 들어가 있음
- 실제 키/비밀번호는 README에 적지 않는다
- `SUPABASE_SERVICE_ROLE_KEY`는 서버/배치/GitHub Actions 전용이며 브라우저 코드에 절대 노출하지 않는다
- `DATABASE_URL`은 Node 배치 스크립트에서 Postgres에 직접 연결할 때 사용한다

현재 `stats.json`의 PR 구조:

```json
{
  "repo": "woowacourse/spring-roomescape-member",
  "track": "backend",
  "prNumber": 410,
  "title": "[...]",
  "author": "softmoca",
  "createdAt": "2026-05-07T07:49:28Z",
  "closedAt": "2026-05-09T15:18:26Z",
  "mergedAt": "2026-05-09T15:18:26Z",
  "url": "https://github.com/...",
  "reviews": [
    {
      "reviewer": "Gomding",
      "authorRole": "reviewer",
      "submittedAt": "2026-05-07T15:09:24Z",
      "state": "CHANGES_REQUESTED",
      "url": "https://github.com/..."
    }
  ]
}
```

중요한 해석:

- GitHub `PullRequestReview`에는 PR 작성자의 인라인 답변도 `COMMENTED` review 이벤트로 들어온다.
- 그래서 `reviewer`가 PR `author`와 같을 수 있다.
- 이를 구분하기 위해 `authorRole`을 저장한다.
- `authorRole === "reviewer"`: PR 작성자가 아닌 사람이 남긴 review 이벤트
- `authorRole === "crew"`: PR 작성자가 남긴 review/comment 이벤트
- `authorRole === "unknown"`: 삭제 계정 등 login을 알 수 없는 이벤트

## 내일 작업 목표

최종 목표는 닉네임으로 사람을 검색하면 다음을 보여주는 웹 서비스다.

- 리뷰어로서 얼마나 빨리 첫 리뷰를 해주는가
- 리뷰어로서 변경 요청 이후 재리뷰까지 얼마나 걸리는가
- 크루로서 PR 제출 후 첫 리뷰를 받기까지 얼마나 걸리는가
- 크루로서 변경 요청을 받은 뒤 재요청/응답까지 얼마나 걸리는가
- 크루로서 미션 완료까지 얼마나 걸리는가
- 특정 크루의 활동 주기와 가장 잘 맞는 리뷰어를 추천한다
- 특정 크루에 대해 리뷰어 후보 여러 명을 직접 넣고, 그중 가장 잘 맞는 리뷰어를 비교한다

앱에서 66MB `stats.json`을 직접 매번 계산하면 느릴 수 있다. 따라서 다음 단계는 두 가지 경로 중 하나를 선택한다.

권장 경로:

1. 먼저 기존 `stats.json`을 기반으로 `person-stats.json`, `summary.json`, `recent-activity.json`을 만든다.
2. 이어서 Supabase DB에 기존 데이터를 import한다.
3. 이후부터는 매일 새벽 4시에 변경분만 수집해 DB에 누적 저장한다.
4. 웹은 Supabase 기반 API 또는 요약 JSON을 통해 동적으로 조회한다.

이렇게 하면 사용자가 원한 다음 목표를 달성할 수 있다.

- 변경분을 정확히 누적 저장
- 과거 PR 이벤트를 안정적으로 관리
- 웹에서 필요한 데이터만 동적으로 조회

전날밤/사전준비 스크립트는 최종적으로 3개가 된다.

```bash
npm run fetch:members
npm run fetch:stats
npm run build:person-stats
```

DB 기반 자동 동기화까지 가면 최종 스크립트는 다음처럼 확장된다.

```bash
npm run db:init
npm run db:import
npm run db:sync
npm run db:build-summaries
```

## 다음에 Codex에 줄 첫 프롬프트

새 대화 컨텍스트에서는 아래 프롬프트로 시작하면 된다.

```text
이 프로젝트는 /Users/limkyungpyo/Desktop/woowa/woowa_tecoton 에 있어.
README.md를 먼저 읽고 현재 코드베이스를 확인한 다음 Plan Mode로 진행해줘.

우선 README.md와 README_Front.md를 읽고 현재 코드베이스를 확인해줘.

이 프로젝트는 이제 두 목표가 있어:
1. 기존 public/stats.json 기반으로 person-stats.json, summary.json, recent-activity.json을 만드는 것
2. Supabase Postgres에 PR/review 이벤트를 누적 저장하고, 이후 변경분만 sync하는 구조로 확장하는 것

Plan Mode에서 먼저 어떤 순서로 갈지 계획을 세워줘.
추천은 scripts/build-person-stats.js를 먼저 만든 뒤, Supabase 스키마와 import/sync 스크립트를 추가하는 거야.
```

Plan Mode에서 방향이 확정되면 다음 프롬프트로 구현을 요청한다.

```text
PLEASE IMPLEMENT THIS PLAN.
```

## 1단계: `build-person-stats.js` 만들기

이 단계가 가장 중요하다. 앱 UI보다 먼저 해야 한다.

추가할 파일:

- `scripts/build-person-stats.js`
- `public/person-stats.json` 생성

`package.json`에 추가할 script:

```json
{
  "scripts": {
    "build:person-stats": "node scripts/build-person-stats.js"
  }
}
```

입력:

- `public/members.json`
- `public/stats.json`

출력 예시:

```json
{
  "generatedAt": "2026-05-21T00:00:00.000Z",
  "people": {
    "Gomding": {
      "githubId": "Gomding",
      "nickname": null,
      "avatarUrl": null,
      "cohort": null,
      "track": null,
      "asReviewer": {
        "hasData": true,
        "reviewedPRs": 123,
        "reviewEvents": 456,
        "avgFirstResponseHours": 12.4,
        "avgRereviewHours": 9.8,
        "activityByHour": [0, 0, 1]
      },
      "asCrew": {
        "hasData": true,
        "totalPRs": 42,
        "avgMissionHours": 56.2,
        "avgFirstReviewHours": 18.5,
        "avgReRequestHours": 7.1,
        "avgRoundsPerPR": 2.3
      }
    }
  }
}
```

권장 계산 정의:

리뷰어 통계:

- 대상 이벤트: `review.authorRole === "reviewer"`
- `reviewedPRs`: 해당 사람이 리뷰어 이벤트를 남긴 고유 PR 수
- `reviewEvents`: 해당 사람의 review 이벤트 수
- `avgFirstResponseHours`: 각 PR에서 해당 리뷰어의 첫 이벤트 시각 - `pr.createdAt`
- `avgRereviewHours`: 같은 PR에서 직전 `CHANGES_REQUESTED` 이후 같은 리뷰어의 다음 `reviewer` 이벤트까지 걸린 시간
- `activityByHour`: `submittedAt`을 KST(UTC+9)로 변환해 0~23시 count

크루 통계:

- 대상 PR: `pr.author === githubId`
- `totalPRs`: 해당 사람이 작성한 PR 수
- `avgMissionHours`: `(pr.mergedAt || pr.closedAt) - pr.createdAt`
- `avgFirstReviewHours`: 첫 `authorRole === "reviewer"` 이벤트 - `pr.createdAt`
- `avgReRequestHours`: `reviewer`의 `CHANGES_REQUESTED` 이후 다음 `authorRole === "crew"` + `COMMENTED` 이벤트까지 걸린 시간
- `avgRoundsPerPR`: PR별 `authorRole === "reviewer"` + `CHANGES_REQUESTED` 개수 평균

사람 표시 형식:

```text
모카
8기 BE · @softmoca
```

- 1줄 primary label은 닉네임만 사용한다.
- 2줄 secondary label에 `{cohort}기 {trackLabel} · @{githubId}`를 표시한다.
- `trackLabel`: `backend -> BE`, `frontend -> FE`, `android -> AN`
- marquee에서도 닉네임 아래에는 repo가 아니라 `기수 + 트랙`을 보여준다.
- 최근 활동 시간(`12분 전`, `1h ago` 등)은 유지하되 기수/트랙과 분리해서 작게 보여준다.

활동 주기 통계:

- `activityByHour`: KST 기준 0~23시 count
- `activityByWeekday`: KST 기준 Mon~Sun count
- `activityHeatmap`: KST 기준 요일 x 시간대 matrix
- 크루의 활동 주기는 `pr.createdAt`과 `authorRole === "crew"` 이벤트를 분리해서 저장하는 것을 권장한다.
- 리뷰어의 활동 주기는 `authorRole === "reviewer"` 이벤트 기준으로 저장한다.

주의할 점:

- `COMMENTED`는 무조건 리뷰어 코멘트가 아니다. `authorRole`로 분리해야 한다.
- GitHub ID가 `members.json`에 없어도 제거하지 말고 GitHub ID 기준으로 통계를 만든다.
- `members.json`에 있으면 nickname/avatar/cohort/track을 붙이고, 없으면 null로 둔다.
- 화면의 기본 표시 이름은 GitHub ID가 아니라 우테코 닉네임이다.
- `members.json`에 매핑되는 사람이면 `nickname`, `cohort`, `track`을 우선 표시하고 GitHub ID는 보조 정보로 보여준다.
- 예: `모카`를 primary로 보여주고, 그 아래에 `8기 BE · @softmoca`를 표시한다.
- `members.json`에 없는 GitHub ID는 fallback으로 `@githubId` 또는 `githubId`를 표시한다.
- 시간은 hours 단위 number로 저장하고, 소수점 1자리 반올림한다.
- 계산 불가능한 평균은 `null`로 둔다. `0`으로 두면 “정말 0시간”과 구분이 안 된다.
- PR 작성자가 남긴 `COMMENTED`가 없으면 재요청 시간 표본에서 제외한다.

검증 프롬프트:

```text
person-stats.json 생성 후 softmoca, Gomding, Livenow14 기준으로 샘플 통계를 출력해서 이상한 값이 없는지 확인해줘.
특히 spring-roomescape-member #410 에서 softmoca의 COMMENTED 이벤트가 crew로 처리되는지 확인해줘.
```

## 2단계: Supabase DB 기반 누적 저장 구조

이 단계는 JSON 파일만으로 끝내지 않고, 매일 변경분을 누적 저장하고 웹에서 동적으로 조회하기 위한 확장 단계다.

핵심 방향:

- DB는 Supabase Postgres를 사용한다.
- 원본 GitHub payload는 필요하면 `jsonb`로 보관한다.
- 분석에 자주 쓰는 값은 컬럼으로 분리한다.
- 중복 저장을 막기 위해 모든 import/sync는 idempotent upsert로 구현한다.
- 브라우저에 `SUPABASE_SERVICE_ROLE_KEY`를 노출하지 않는다.

필요한 환경변수:

```bash
GITHUB_TOKENS=...
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...
```

주의:

- 실제 값은 `.env`에만 둔다.
- GitHub Actions에는 repository secrets로 넣는다.
- Vercel에는 서버에서 필요한 값만 환경변수로 넣는다.
- `SUPABASE_SERVICE_ROLE_KEY`에는 `VITE_` prefix를 붙이지 않는다.

### 추천 테이블

Supabase Free 플랜에서 시작하므로 DB에는 분석에 필요한 이벤트 메타데이터만 저장한다. PR 제목은 화면에서 필요하고 용량 부담이 작으므로 저장한다. 반면 본문/댓글/diff/raw payload는 용량을 크게 키울 수 있으므로 일단 저장하지 않는다.

저장하는 데이터:

- PR 제목
- repo/track
- PR number
- PR author
- PR created/closed/merged/updated 시각
- PR URL
- review event reviewer
- review event authorRole
- review event state
- review event submittedAt
- review event URL

저장하지 않는 데이터:

- PR body
- review body
- issue comment body
- inline comment body
- diff hunk
- GitHub raw payload 전체

```sql
create table if not exists repos (
  id bigserial primary key,
  full_name text not null unique,
  owner text not null,
  name text not null,
  track text not null check (track in ('backend', 'frontend', 'android')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists members (
  github_id text primary key,
  nickname text,
  cohort integer,
  roles text[],
  track text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists pull_requests (
  id bigserial primary key,
  github_node_id text unique,
  repo_id bigint not null references repos(id),
  pr_number integer not null,
  title text,
  author_login text,
  created_at timestamptz not null,
  closed_at timestamptz,
  merged_at timestamptz,
  github_updated_at timestamptz,
  url text,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (repo_id, pr_number)
);

create table if not exists review_events (
  id bigserial primary key,
  github_node_id text unique,
  pr_id bigint not null references pull_requests(id) on delete cascade,
  reviewer_login text,
  author_role text not null check (author_role in ('crew', 'reviewer', 'unknown')),
  state text,
  submitted_at timestamptz not null,
  url text,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sync_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'failed')),
  mode text not null check (mode in ('full', 'incremental')),
  fetched_prs integer not null default 0,
  fetched_reviews integer not null default 0,
  error_message text
);
```

요약/조회용 테이블은 import 이후 추가한다.

```sql
create table if not exists person_summary_stats (
  github_id text primary key,
  nickname text,
  avatar_url text,
  track text,
  cohort integer,
  as_crew jsonb not null default '{}'::jsonb,
  as_reviewer jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists repo_summary_stats (
  repo_full_name text primary key,
  track text not null,
  summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists recent_activities (
  id bigserial primary key,
  github_id text not null,
  nickname text,
  avatar_url text,
  role text not null check (role in ('crew', 'reviewer')),
  track text,
  repo_full_name text,
  pr_number integer,
  event_type text not null,
  occurred_at timestamptz not null,
  url text
);

create table if not exists reviewer_match_scores (
  crew_github_id text not null,
  reviewer_github_id text not null,
  score numeric not null,
  time_overlap_score numeric not null,
  first_review_speed_score numeric not null,
  rereview_speed_score numeric not null,
  same_track_repo_score numeric not null,
  recent_activity_score numeric not null,
  first_review_median_hours numeric,
  rereview_median_hours numeric,
  same_track_review_count integer not null default 0,
  same_repo_review_count integer not null default 0,
  recent_30d_review_count integer not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (crew_github_id, reviewer_github_id)
);
```

권장 인덱스:

```sql
create index if not exists pull_requests_repo_created_idx on pull_requests (repo_id, created_at desc);
create index if not exists pull_requests_author_idx on pull_requests (author_login);
create index if not exists pull_requests_github_updated_idx on pull_requests (github_updated_at desc);
create index if not exists review_events_pr_idx on review_events (pr_id, submitted_at);
create index if not exists review_events_reviewer_idx on review_events (reviewer_login, submitted_at desc);
create index if not exists review_events_role_idx on review_events (author_role, submitted_at desc);
create index if not exists recent_activities_role_time_idx on recent_activities (role, occurred_at desc);
create index if not exists reviewer_match_scores_crew_score_idx on reviewer_match_scores (crew_github_id, score desc);
```

## Reviewer Match 기능

추가된 추천 기능은 두 가지다.

1. 특정 크루와 주기가 가장 잘 맞는 같은 트랙 리뷰어 찾기
2. 특정 크루에 대해 리뷰어 여러 명을 직접 넣고 그중 가장 잘 맞는 리뷰어 찾기

Figma 기준:

- `09 Desktop / Reviewer Match`
- `10 Desktop / Candidate Compare`
- `11 Mobile / Reviewer Match`
- `12 Mobile / Candidate Compare`

이 기능은 리뷰 품질을 판단하지 않는다. 활동 시간대, 응답 속도, 같은 트랙/레포 리뷰 경험, 최근 활동성을 기준으로 “시간 주기와 응답성 측면에서 잘 맞는 리뷰어”를 추천한다.

중요한 제한:

- 자동 추천은 반드시 같은 트랙 안에서만 수행한다.
- backend 크루는 backend 리뷰어만 추천한다.
- frontend 크루는 frontend 리뷰어만 추천한다.
- android 크루는 android 리뷰어만 추천한다.
- 후보 직접 비교 기능은 사용자가 후보를 직접 넣는 기능이므로 다른 트랙 후보를 입력할 수는 있지만, UI에서 `different track` 경고를 보여주고 점수 계산에서 감점하거나 비교에서 제외하는 정책을 선택해야 한다.

### 필요한 데이터

현재 `stats.json`만으로 계산 가능한 값:

- 크루의 PR 제출 시간대: `pr.author === githubId`, `pr.createdAt`
- 크루의 재요청/응답 시간대: `review.authorRole === "crew"`, `review.submittedAt`
- 리뷰어의 리뷰 활동 시간대: `review.authorRole === "reviewer"`, `review.submittedAt`
- 첫 리뷰 응답 시간: 첫 `authorRole === "reviewer"` 이벤트 - `pr.createdAt`
- 재리뷰 응답 시간: 크루 재요청 이벤트 이후 다음 리뷰어 이벤트까지 걸린 시간
- 같은 track 리뷰 수
- 같은 repo 리뷰 수
- 최근 30일 리뷰 이벤트 수

현재 데이터로 불가능하거나 제외하는 것:

- 리뷰 본문 품질 분석
- 댓글 내용 기반 분류
- 라인 코멘트 개수 기반 분석
- diff hunk 기반 분석

### 점수 계산 초안

추천 점수는 100점 만점으로 계산한다.

```text
matchScore =
  40% 시간대 궁합
+ 25% 첫 리뷰 응답 속도
+ 20% 재리뷰 응답 속도
+ 10% 같은 트랙/레포 경험
+ 5% 최근 활동성
```

각 항목:

- `timeOverlapScore`: 크루 activityHeatmap과 리뷰어 activityHeatmap의 cosine similarity 또는 dot product 기반 점수
- `firstReviewSpeedScore`: 리뷰어의 첫 리뷰 median hours가 낮을수록 높은 점수
- `rereviewSpeedScore`: 크루 재요청 이후 리뷰어 재리뷰 median hours가 낮을수록 높은 점수
- `sameTrackRepoScore`: 같은 track/repo 리뷰 이벤트 수 기반 점수
- `recentActivityScore`: 최근 30일 리뷰 이벤트 수 기반 점수

주의:

- 자동 추천 후보군은 `crew.track === reviewer.track`으로 먼저 필터링한다.
- 크루의 “주기”는 PR 제출만 볼지, 재요청 이벤트까지 섞을지 결정해야 한다.
- 추천 정확도를 위해서는 `PR 제출 주기`와 `재요청 주기`를 분리 저장하는 편이 좋다.
- 후보 직접 비교 기능은 모든 조합을 미리 계산하지 않아도 된다. 후보 리스트를 입력받아 API에서 즉시 계산하거나, `reviewer_match_scores`에서 후보만 필터링할 수 있다.
- 후보 직접 비교에서 다른 트랙 리뷰어가 들어오면 기본 추천은 `exclude`가 안전하다. 사용자가 원하면 `include with penalty` 모드를 추가할 수 있다.

### 출력 예시

```json
{
  "crewGithubId": "softmoca",
  "matches": [
    {
      "reviewerGithubId": "Gomding",
      "score": 91,
      "timeOverlapScore": 84,
      "firstReviewSpeedScore": 92,
      "rereviewSpeedScore": 88,
      "sameTrackRepoScore": 80,
      "recentActivityScore": 76,
      "firstReviewMedianHours": 3.2,
      "rereviewMedianHours": 5.7,
      "sameTrackReviewCount": 241,
      "sameRepoReviewCount": 18,
      "recent30dReviewCount": 36,
      "reasons": [
        "재요청이 많은 Wed/Fri 15-18 KST 구간과 리뷰어 활동 구간이 크게 겹칩니다.",
        "spring-roomescape 계열 리뷰 경험이 있습니다."
      ]
    }
  ]
}
```

### API 초안

```text
GET /api/matches/:crewGithubId
```

특정 크루에게 잘 맞는 같은 트랙 리뷰어 top N을 반환한다.

```text
POST /api/matches/compare
```

body:

```json
{
  "crewGithubId": "softmoca",
  "candidateReviewerGithubIds": ["Gomding", "brown", "eve", "pobi"]
}
```

후보 리뷰어 안에서만 점수를 계산하거나 필터링해 순위를 반환한다.

`POST /api/matches/compare`의 기본 정책:

- 기본값은 같은 트랙 후보만 비교한다.
- 다른 트랙 후보는 응답에 `excludedCandidates`로 반환한다.
- 필요하면 옵션으로 `includeDifferentTrackWithPenalty: true`를 받을 수 있다.

### 추가할 스크립트

권장 파일:

- `scripts/db/init-db.js`: SQL migration 실행
- `scripts/db/import-json-to-db.js`: 기존 `members.json`, `stats.json`을 Supabase에 최초 import
- `scripts/db/sync-db.js`: GitHub API에서 변경분만 조회 후 upsert
- `scripts/db/build-db-summaries.js`: DB 기준 summary 테이블 재계산

권장 `package.json` scripts:

```json
{
  "scripts": {
    "db:init": "node scripts/db/init-db.js",
    "db:import": "node scripts/db/import-json-to-db.js",
    "db:sync": "node scripts/db/sync-db.js",
    "db:build-summaries": "node scripts/db/build-db-summaries.js"
  }
}
```

필요한 의존성:

```bash
npm install pg
```

Supabase JS client를 API route에서 쓸 경우에만 추가:

```bash
npm install @supabase/supabase-js
```

### Import 규칙

`public/stats.json`에서 DB로 옮길 때:

- `repos.full_name` 기준 upsert
- `pull_requests`는 `(repo_id, pr_number)` 또는 `github_node_id` 기준 upsert
- `review_events`는 `github_node_id`가 있으면 `github_node_id` 기준 upsert
- 현재 `stats.json`에 review node id가 없다면 임시 unique key가 필요하다
- 임시 unique key 예: `pr_id + reviewer_login + submitted_at + state + url`
- 향후 `fetch-stats.js`/`sync-db.js`는 GitHub GraphQL node id를 저장하도록 개선한다

중요:

- 같은 import를 두 번 실행해도 row가 중복되면 안 된다.
- PR이 나중에 merge/close/update되면 기존 row를 갱신해야 한다.
- review 이벤트가 추가되면 새 row만 추가되어야 한다.

### 변경분 Sync 규칙

`sync-db.js`는 전체 재수집이 아니라 변경분 수집을 목표로 한다.

권장 방식:

1. `repos.last_synced_at` 또는 마지막 성공한 `sync_runs.finished_at`을 읽는다.
2. GitHub GraphQL에서 repo별 closed/merged PR 중 `updatedAt >= lastSyncedAt - safetyWindow`인 PR을 조회한다.
3. safety window는 6~24시간 정도 둔다. GitHub API/시간차/재시도 때문에 약간 겹쳐 가져오는 편이 안전하다.
4. 가져온 PR과 review 이벤트를 upsert한다.
5. repo별 `last_synced_at`을 갱신한다.
6. `sync_runs`에 성공/실패 결과를 기록한다.

실패 처리:

- sync 시작 시 `sync_runs.status = 'running'`
- 성공 시 `success`, 실패 시 `failed`
- 실패해도 기존 데이터는 유지한다.
- 다음 실행 때 safety window 때문에 누락 없이 다시 잡히도록 한다.

### 웹 조회 방식

권장 구조:

```text
Browser
→ Vercel API route
→ Supabase Postgres 조회
→ 필요한 JSON만 응답
```

이 방식을 추천하는 이유:

- `SUPABASE_SERVICE_ROLE_KEY`를 브라우저에 노출하지 않는다.
- RLS 정책을 과하게 복잡하게 만들지 않아도 된다.
- 대용량 통계 조회를 서버에서 제한/가공할 수 있다.

초기에는 Supabase anon key + RLS public read로 직접 조회해도 되지만, 최종 구조는 Vercel API 경유가 더 안전하다.

예상 API:

```text
GET /api/summary
GET /api/recent-activity
GET /api/people/:githubId
GET /api/repos/:owner/:repo
GET /api/prs/:owner/:repo/:number
```

## 3단계: GitHub Actions 자동 동기화

매일 새벽 4시(KST)에 변경분을 수집하려면 GitHub Actions를 쓴다. GitHub Actions cron은 UTC 기준이므로 KST 04:00은 UTC 19:00이다.

추가할 파일:

- `.github/workflows/daily-sync.yml`

예시:

```yaml
name: Daily ReviewPace Sync

on:
  workflow_dispatch:
  schedule:
    - cron: "0 19 * * *"

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run db:sync
        env:
          GITHUB_TOKENS: ${{ secrets.GITHUB_TOKENS }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      - run: npm run db:build-summaries
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

GitHub repository secrets에 넣을 값:

- `GITHUB_TOKENS`
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

주의:

- secrets 값은 workflow yaml에 직접 적지 않는다.
- 동기화 스크립트 로그에 토큰/DB URL/service role key를 출력하지 않는다.
- 처음에는 `workflow_dispatch`로 수동 실행해 검증한 뒤 schedule을 믿는다.

## 4단계: React + Vite + Tailwind 앱 세팅

`build-person-stats.js`가 끝난 다음 앱을 만든다.

Codex에 줄 프롬프트:

```text
React + Vite + Tailwind CSS v3 앱을 현재 프로젝트에 세팅해줘.
기존 scripts, public/members.json, public/stats.json, public/person-stats.json은 유지해줘.

조건:
- npm 사용
- src/components, src/hooks, src/utils 구조 생성
- App.jsx는 우선 ReviewPace 제목과 검색창 자리만 보여줘
- Tailwind v3 사용
- Vercel 정적 배포가 가능하도록 npm run build가 dist를 생성해야 해
```

설치 예상:

```bash
npm install react react-dom
npm install -D vite @vitejs/plugin-react tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

`package.json`에 추가될 script:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

주의:

- 기존 Node 스크립트가 ESM이므로 `"type": "module"`은 유지한다.
- `.env`의 GitHub PAT는 Vite 앱에서 쓰면 안 된다.
- Vercel 배포 앱은 정적 JSON만 읽어야 한다.

## 5단계: 데이터 로딩 훅

Codex에 줄 프롬프트:

```text
public/members.json과 public/person-stats.json을 읽는 React hook을 만들어줘.

파일:
- src/hooks/useMembers.js
- src/hooks/usePersonStats.js

useMembers는 닉네임 부분 검색을 지원하고, query가 빈 문자열이면 전체 멤버를 cohort 내림차순으로 반환하게 해줘.
usePersonStats는 githubId를 받아 person-stats.json의 people[githubId]를 반환하게 해줘.
로딩/에러 상태도 포함해줘.
```

`useMembers` 반환 형태:

```js
{
  members,
  loading,
  error,
  searchByNickname,
  getByGithubId
}
```

`usePersonStats` 반환 형태:

```js
{
  stats,
  loading,
  error
}
```

## 6단계: 메인 UI 구현

Codex에 줄 프롬프트:

```text
ReviewPace 메인 UI를 구현해줘.

기능:
- 닉네임 검색 자동완성
- 멤버 선택 시 프로필 표시
- 리뷰어로서 통계 표시
- 크루로서 통계 표시
- 데이터가 없으면 역할별로 "기록이 없습니다" 표시

디자인:
- Tailwind CSS
- 실제 도구 화면처럼 간결한 대시보드
- 모바일 대응
- 큰 마케팅 랜딩 페이지 말고 검색/통계 화면이 첫 화면이어야 해
```

추천 컴포넌트:

- `src/components/SearchBar.jsx`
- `src/components/ProfileCard.jsx`
- `src/components/StatsSection.jsx`
- `src/components/MetricCard.jsx`

시간 표시 유틸:

- `src/utils/time.js`
- `formatHours(hours)`
- `hours < 24`: `N시간 M분`
- `hours >= 24`: `N일 M시간`
- `null`: `-`

## 7단계: 차트 추가

Codex에 줄 프롬프트:

```text
recharts를 설치하고 리뷰어 활동 시간대 차트를 추가해줘.

파일:
- src/components/Charts.jsx

ReviewerActivityChart:
- props: activityByHour
- 0~23시 bar chart
- 모바일에서도 깨지지 않게 ResponsiveContainer 사용
```

설치:

```bash
npm install recharts
```

## 8단계: 검증

앱 구현 후 반드시 실행:

```bash
npm run build
npm run dev
```

브라우저에서 확인할 것:

- 닉네임 검색이 된다.
- 멤버 선택 후 통계가 뜬다.
- 통계가 없는 역할은 빈 상태로 나온다.
- `softmoca` 같은 PR 작성자 이벤트가 리뷰어 통계로 섞이지 않는다.
- `Gomding` 같은 리뷰어 이벤트가 리뷰어 통계로 잡힌다.
- 모바일 폭에서 텍스트가 겹치지 않는다.

Codex에 줄 검증 프롬프트:

```text
npm run build를 실행해서 빌드 오류를 고쳐줘.
그 다음 dev server를 띄우고 Browser로 화면을 확인해줘.
검색, 멤버 선택, 통계 카드 렌더링까지 실제로 검증해줘.
```

## Vercel 배포 계획

Vercel 공식 문서 기준 Vite 프로젝트는 Vercel에서 지원되며, Vercel은 프레임워크에 따라 build command와 output directory를 자동 설정할 수 있다. Vite 앱의 일반적인 output directory는 `dist`다.

참고 문서:

- Vite on Vercel: https://vercel.com/docs/frameworks/vite
- Vercel CLI deploy: https://vercel.com/docs/cli/deploy
- Vercel deployment methods: https://vercel.com/docs/deployments/deployment-methods

배포 전 확인:

```bash
npm run build
```

`dist/`가 생성되어야 한다.

Vercel Dashboard Git 연동 배포:

1. 프로젝트를 GitHub repo로 push한다.
2. Vercel Dashboard에서 New Project를 누른다.
3. GitHub repo를 import한다.
4. Framework Preset은 `Vite`로 잡히는지 확인한다.
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Install Command: `npm install`
8. Deploy를 누른다.

Vercel CLI 배포:

```bash
npm install -g vercel
vercel login
vercel
vercel --prod
```

주의:

- 정적 JSON만 읽는 구조라면 `GITHUB_TOKENS`는 Vercel 환경변수에 올릴 필요가 없다.
- Vercel API route에서 Supabase를 조회한다면 `DATABASE_URL` 또는 `SUPABASE_SERVICE_ROLE_KEY`를 Vercel 서버 환경변수에 넣는다.
- `SUPABASE_SERVICE_ROLE_KEY`는 절대 `VITE_` prefix를 붙이지 않는다.
- 배포된 앱은 초기에는 생성된 `public/person-stats.json`과 `public/members.json`만 읽어도 된다.
- 데이터 재수집은 로컬에서 실행하고 JSON을 갱신한 뒤 다시 배포한다.
- DB 기반 구조가 완성되면 데이터 재수집은 GitHub Actions가 처리하고, 앱은 Vercel API/Supabase 요약 테이블을 조회한다.
- `public/stats.json`은 66MB라 배포에 포함할지 재검토해야 한다. 앱이 `person-stats.json`만 사용하게 되면 `stats.json`은 배포 대상에서 빼는 편이 낫다.

권장 배포 구조:

- 배포 포함: `public/members.json`, `public/person-stats.json`
- DB 기반 전환 후 배포 포함: 앱 소스와 필요한 public fallback JSON
- 배포 제외 가능: `public/stats.json`
- 로컬 캐시 제외: `.cache/`
- 비밀값 제외: `.env`

`stats.json`을 배포에서 빼려면:

1. 앱 코드가 `stats.json`을 직접 fetch하지 않는지 확인한다.
2. `public/stats.json`을 repo에 커밋하지 않는다.
3. 필요하면 `.gitignore`에 `public/stats.json`을 다시 추가한다.

## 내일 완성까지의 추천 순서

1. `build-person-stats.js` 구현
2. `person-stats.json` 검증
3. `summary.json`, `recent-activity.json` 생성 스크립트 구현
4. Supabase 스키마 확정
5. `db:init`, `db:import` 구현
6. 기존 `members.json`, `stats.json`을 Supabase에 import
7. `db:sync`, `db:build-summaries` 구현
8. GitHub Actions daily sync 초안 작성
9. React/Vite/Tailwind 세팅
10. 데이터 hook 또는 API client 구현
11. Overview UI 구현
12. 상세 화면 구현
13. `npm run build` 통과
14. 브라우저 검증
15. Vercel 배포

## 내일 Codex에 단계별로 줄 프롬프트 모음

### 프롬프트 1: 전체 계획

```text
/Users/limkyungpyo/Desktop/woowa/woowa_tecoton 프로젝트에서 작업해줘.

README.md와 README_Front.md를 먼저 읽고 현재 코드베이스를 확인해줘.

목표는 두 가지야.
1. 기존 public/stats.json 기반으로 person-stats.json, summary.json, recent-activity.json을 생성한다.
2. Supabase Postgres에 기존 PR/review 이벤트를 import하고, 이후 변경분만 db:sync로 누적 저장할 수 있게 만든다.

Plan Mode에서 먼저 구현 순서를 제안해줘.
```

### 프롬프트 2: JSON 통계 산출물 구현

```text
PLEASE IMPLEMENT THIS PLAN.

먼저 scripts/build-person-stats.js를 만들고,
가능하면 scripts/build-summary.js와 scripts/build-recent-activity.js도 만들어줘.

브라우저 앱은 public/stats.json을 직접 읽지 않게 할 거야.
```

### 프롬프트 3: Supabase 스키마/import 구현

```text
이제 Supabase DB 기반으로 확장하자.

README.md의 Supabase DB 기반 누적 저장 구조를 기준으로:
- scripts/db/init-db.js
- scripts/db/import-json-to-db.js

를 구현할 계획을 세워줘.

DATABASE_URL은 .env에 있고, 실제 값은 로그에 출력하지 마.
```

### 프롬프트 4: Supabase sync 구현

```text
PLEASE IMPLEMENT THIS PLAN.

기존 stats.json/members.json을 Supabase에 import하고,
같은 스크립트를 두 번 실행해도 중복 row가 생기지 않는지 검증해줘.
```

### 프롬프트 5: 변경분 sync와 GitHub Actions

```text
scripts/db/sync-db.js와 scripts/db/build-db-summaries.js 구현 계획을 세워줘.

목표:
- repo별 last_synced_at 또는 마지막 성공 sync_runs 기준으로 변경 PR만 조회
- safety window를 두고 누락 없이 upsert
- sync_runs에 성공/실패 기록
- 매일 04:00 KST에 돌릴 GitHub Actions workflow 초안 작성
```

### 프롬프트 6: 앱 세팅 계획

```text
DB import/sync 기반이 준비됐어.
이제 React + Vite + Tailwind 앱을 만들 계획을 세워줘.
README_Front.md와 Figma 우테콘 > 스타크 페이지를 기준으로 구현해줘.
```

### 프롬프트 7: Overview UI 구현

```text
Figma 우테콘 > 스타크 > 01 Desktop / Overview Dashboard 디자인을 기준으로 OverviewPage를 구현해줘.

중요:
- 메인에는 Median First Review, Median Completion, Active Hours를 넣지 않는다.
- Recently Active Crew와 Recently Active Reviewers는 infinite avatar marquee로 구현한다.
- 기본 상태부터 glow가 있고, hover 시 glow가 더 진해진다.
- 명시적인 컬러 테두리는 추가하지 않는다.
```

### 프롬프트 8: 검증과 배포 준비

```text
npm run build를 통과시키고 dev server에서 실제 화면을 검증해줘.
Vercel 배포 전에 필요한 설정, 환경변수, 제외해야 할 파일이 있으면 정리해줘.
```

## 남은 의사결정

다음은 내일 Plan Mode에서 확정하면 된다.

- `avgReRequestHours`를 크루의 첫 `COMMENTED`만 볼지, 여러 `COMMENTED` 중 변경 요청 이후 첫 이벤트만 볼지
- reviewer의 `COMMENTED`를 응답 시간에 포함할지, `APPROVED`/`CHANGES_REQUESTED`만 리뷰 응답으로 볼지
- `stats.json`을 repo에 커밋할지, 로컬 산출물로만 둘지
- `person-stats.json`에 랭킹용 summary를 추가할지
- DB import 시 현재 `stats.json`에 없는 GitHub review node id를 어떻게 보완할지
- Vercel API route를 먼저 만들지, Supabase anon read를 먼저 쓸지
- GitHub Actions sync 결과를 JSON 파일에도 다시 export할지

현재 추천 기본값:

- 크루 재요청: `CHANGES_REQUESTED` 이후 첫 `authorRole === "crew"` 이벤트
- 리뷰어 응답: `authorRole === "reviewer"`인 모든 review 이벤트
- 화면 표시 초기값: `person-stats.json`, `summary.json`, `recent-activity.json` 사용
- DB 전환 후 화면 표시: Vercel API route가 Supabase 요약 테이블 조회
- 배포: `stats.json`은 제외하고 필요한 요약 JSON 또는 API 기반 데이터만 사용
