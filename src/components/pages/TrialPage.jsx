import { useEffect, useMemo, useState } from "react";
import AppHeader from "../common/AppHeader.jsx";
import { Link, useParams } from "react-router-dom";
import MetricCard from "../common/MetricCard.jsx";
import Surface from "../common/Surface.jsx";
import {
  loadGithubSession,
  logoutGithub,
  postLineComment,
  postReviewReply,
  startGithubLogin,
} from "../../data/githubAuth.js";
import { loadTrialPr, parseGithubPrUrl } from "../../data/trial.js";
import { cn } from "../../utils/classNames.js";

const ASSETS = {
  courtroom: "/trial-assets/courtroom.png",
  prosecutor: "/trial-assets/prosecutor.png",
  objection: "/trial-assets/objection.png",
  attorney: "/trial-assets/attorney.png",
};

const DEFAULT_PR_URL = "https://github.com/Woovengers/test-repository/pull/1";

const demoEvidenceLines = [
  { type: "hunk", oldLine: null, newLine: null, line: null, code: "@@ -42,6 +42,6 @@" },
  { type: "context", oldLine: 42, newLine: 42, line: 42, code: "public Reservation approve(Long id) {" },
  { type: "context", oldLine: 43, newLine: 43, line: 43, code: "  Reservation reservation = findById(id);" },
  { type: "context", oldLine: 44, newLine: 44, line: 44, code: "  if (user.isActive()) {" },
  { type: "add", oldLine: null, newLine: 45, line: 45, code: "    reservation.approve();", flagged: true },
  { type: "context", oldLine: 46, newLine: 46, line: 46, code: "  }" },
  { type: "context", oldLine: 47, newLine: 47, line: 47, code: "  return reservation;" },
];

const demoReviewComments = [
  {
    id: "3167455981",
    label: "이의 있음",
    actor: "웨지",
    role: "prosecutor",
    inReplyToId: null,
    body: "상태 검증 없이 approve가 호출됩니다.",
    claim: "상태 검증 없이 approve가 호출됩니다.",
    evidence: "리뷰어 주장은 이 라인이 도메인 정책을 충분히 증명하지 못한다는 점을 겨냥합니다.",
    color: "red",
    path: "ReservationService.java",
    line: 45,
    diffLines: demoEvidenceLines,
  },
  {
    id: "3167456024",
    label: "잠깐!",
    actor: "웨지",
    role: "prosecutor",
    inReplyToId: null,
    body: "DTO 경계가 흐려진 것으로 보입니다.",
    claim: "DTO 경계가 흐려진 것으로 보입니다.",
    evidence: "리뷰어는 계층 간 책임 분리를 증거로 요구하고 있습니다.",
    color: "red",
    path: "ReservationService.java",
    line: 45,
    diffLines: demoEvidenceLines,
  },
  {
    id: "3167456188",
    label: "증거 제출",
    actor: "나루호도",
    role: "attorney",
    inReplyToId: "3167455981",
    body: "Controller에서 이미 검증되고 있습니다.",
    claim: "Controller에서 이미 검증되고 있습니다.",
    evidence: "검증 위치와 테스트 보강 계획이 답변의 핵심 증거입니다.",
    color: "blue",
    path: "ReservationService.java",
    line: 45,
    diffLines: demoEvidenceLines,
  },
];

const demoIssueComments = [
  {
    id: "issue-1",
    actor: "bunny",
    body: "리뷰 반영 방향은 테스트 보강과 책임 분리 명확화로 잡겠습니다.",
    url: "https://github.com/Woovengers/Ace-PRtorney/pull/410#issuecomment-1",
    authorAssociation: "AUTHOR",
  },
  {
    id: "issue-2",
    actor: "웨지",
    body: "좋습니다. 변경 후 approve 흐름이 어디서 보장되는지도 같이 확인할게요.",
    url: "https://github.com/Woovengers/Ace-PRtorney/pull/410#issuecomment-2",
    authorAssociation: "COLLABORATOR",
  },
];

function GithubAuthBar({ session, loading, onLogin, onLogout }) {
  return (
    <Surface glow="cyan" className="mt-8 flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-extrabold text-rp-text">GitHub 연결</p>
        <p className="mt-2 text-sm text-rp-muted">
          실제 PR 리뷰 코멘트에 답글을 달려면 GitHub 로그인이 필요합니다.
        </p>
      </div>
      {session?.authenticated ? (
        <div className="flex flex-wrap items-center gap-3">
          {session.user?.avatarUrl ? (
            <img className="h-9 w-9 rounded-full" src={session.user.avatarUrl} alt="" />
          ) : null}
          <span className="text-sm font-semibold text-rp-text">@{session.user?.login}</span>
          <button
            type="button"
            onClick={onLogout}
            className="h-10 rounded-lg border border-rp-line bg-rp-panel2 px-5 text-sm font-semibold text-rp-text"
          >
            로그아웃
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onLogin}
          disabled={loading}
          className="h-10 rounded-lg bg-rp-text px-6 text-sm font-semibold text-rp-bg transition hover:bg-rp-yellow disabled:cursor-wait disabled:opacity-70"
        >
          GitHub 로그인
        </button>
      )}
    </Surface>
  );
}

function Pill({ children, tone = "red" }) {
  const tones = {
    red: "bg-[#ef262c] text-rp-text",
    blue: "bg-[#2961fa] text-rp-text",
    green: "bg-rp-green text-rp-bg",
  };

  return (
    <span className={cn("inline-flex h-7 items-center rounded-full px-4 text-[11px] font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

function renderInlineMarkdown(text) {
  const parts = [];
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      parts.push(<strong key={`${match.index}-strong`}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(
        <code key={`${match.index}-code`} className="rounded bg-rp-panel2 px-1 py-0.5 font-mono text-[0.9em] text-rp-yellow">
          {match[3]}
        </code>,
      );
    } else if (match[4] && match[5]) {
      parts.push(
        <a key={`${match.index}-link`} className="font-semibold text-rp-cyan underline" href={match[5]} target="_blank" rel="noreferrer">
          {match[4]}
        </a>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function MarkdownPreview({ value }) {
  const blocks = value.trim().split(/\n{2,}/);

  if (!value.trim()) {
    return <p className="text-sm text-rp-subtle">작성한 Markdown 미리보기가 여기에 표시됩니다.</p>;
  }

  return (
    <div className="space-y-4 text-sm leading-relaxed text-rp-text">
      {blocks.map((block, index) => {
        const key = `${index}-${block.slice(0, 16)}`;

        if (block.startsWith("```")) {
          const code = block.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "");
          return (
            <pre key={key} className="overflow-x-auto rounded-lg border border-rp-line bg-[#050505] p-4 font-mono text-xs text-rp-text">
              <code>{code}</code>
            </pre>
          );
        }

        if (block.startsWith("### ")) {
          return <h3 key={key} className="text-base font-extrabold">{renderInlineMarkdown(block.slice(4))}</h3>;
        }

        if (block.startsWith("## ")) {
          return <h2 key={key} className="text-lg font-extrabold">{renderInlineMarkdown(block.slice(3))}</h2>;
        }

        if (block.startsWith("# ")) {
          return <h1 key={key} className="text-xl font-extrabold">{renderInlineMarkdown(block.slice(2))}</h1>;
        }

        const lines = block.split("\n");
        const isList = lines.every((line) => /^[-*] /.test(line));
        if (isList) {
          return (
            <ul key={key} className="list-disc space-y-1 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={`${key}-${lineIndex}`}>{renderInlineMarkdown(line.slice(2))}</li>
              ))}
            </ul>
          );
        }

        const isQuote = lines.every((line) => /^> ?/.test(line));
        if (isQuote) {
          return (
            <blockquote key={key} className="border-l-4 border-rp-purple pl-4 text-rp-muted">
              {lines.map((line, lineIndex) => (
                <p key={`${key}-${lineIndex}`}>{renderInlineMarkdown(line.replace(/^> ?/, ""))}</p>
              ))}
            </blockquote>
          );
        }

        return (
          <p key={key} className="whitespace-pre-wrap">
            {renderInlineMarkdown(block)}
          </p>
        );
      })}
    </div>
  );
}

function PrUrlInput({ value, loading, onChange, onLoadEvidence }) {
  return (
    <Surface glow="purple" className="mt-8 p-5">
      <label className="text-sm font-extrabold text-rp-text" htmlFor="trial-pr-url">
        PR 링크 입력
      </label>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
        <input
          id="trial-pr-url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 rounded-lg border border-rp-line bg-[#0b0b0b] px-4 text-sm text-rp-text outline-none transition placeholder:text-rp-subtle focus:border-rp-purple"
          placeholder="https://github.com/Woovengers/Ace-PRtorney/pull/410"
        />
        <button
          type="button"
          onClick={onLoadEvidence}
          disabled={loading}
          className="h-12 rounded-lg bg-rp-text px-5 text-sm font-semibold text-rp-bg transition hover:bg-rp-yellow disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? "불러오는 중" : "증거 기록 불러오기"}
        </button>
      </div>
    </Surface>
  );
}

function EvidenceCode({ lines, path, selectedLine, onSelectLine, commentCount }) {
  const rowTone = {
    add: "border-l-2 border-l-rp-green bg-[#07130c] text-rp-text",
    delete: "border-l-2 border-l-[#ef262c] bg-[#180809] text-rp-text",
    context: "border-l-2 border-l-transparent bg-[#0b0b0b] text-rp-text",
    hunk: "border-l-2 border-l-rp-purple bg-[#120d1e] text-rp-purple",
  };
  const markers = {
    add: "+",
    delete: "-",
    context: " ",
    hunk: "",
  };

  return (
    <Surface glow="purple" className="min-h-[500px] overflow-hidden p-0">
      <div className="border-b border-rp-line bg-[#080808] px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-extrabold text-rp-text">증거 코드 diff</h2>
          <p className="rounded-full border border-rp-line bg-rp-panel2 px-3 py-1 font-mono text-xs text-rp-muted">{path}</p>
        </div>
        <div className="mt-4 grid grid-cols-[56px_56px_28px_1fr_auto] border-y border-rp-line bg-[#050505] px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-rp-subtle">
          <span>old</span>
          <span>new</span>
          <span />
          <span>code</span>
          <span>review</span>
        </div>
      </div>
      <div className="max-h-[640px] overflow-auto bg-[#050505] p-4 font-mono text-xs">
        {lines.map((item, index) => (
          <button
            type="button"
            onClick={() => onSelectLine(item)}
            disabled={!item.line}
            key={`${item.oldLine ?? "-"}-${item.newLine ?? "-"}-${index}-${item.code}`}
            className={cn(
              "grid min-h-[30px] w-full grid-cols-[56px_56px_28px_minmax(0,1fr)_auto] items-center px-3 text-left transition",
              rowTone[item.type ?? "context"],
              item.line && "hover:bg-rp-panel2",
              selectedLine?.line === item.line && item.line && "ring-1 ring-inset ring-rp-cyan",
              item.flagged && "ring-1 ring-inset ring-rp-yellow",
            )}
          >
            <span className="select-none text-rp-subtle">{item.oldLine ?? ""}</span>
            <span className="select-none text-rp-subtle">{item.newLine ?? ""}</span>
            <span className={cn(
              "select-none font-extrabold",
              item.type === "add" && "text-rp-green",
              item.type === "delete" && "text-[#ef262c]",
              item.type === "hunk" && "text-rp-purple",
            )}>
              {markers[item.type ?? "context"]}
            </span>
            <span className={cn(
              "min-w-0 overflow-x-auto whitespace-pre text-rp-text",
              item.type === "hunk" && "font-semibold text-rp-purple",
            )}>{item.code}</span>
            {item.flagged ? (
              <span className="ml-3 rounded-full bg-[#ef262c] px-3 py-1 font-sans text-[11px] font-extrabold text-rp-text">
                이의 있음 {Math.max(commentCount, 1)}
              </span>
            ) : null}
          </button>
        ))}
        {lines.length === 0 ? (
          <div className="rounded-lg border border-rp-line bg-[#0b0b0b] px-4 py-8 text-sm text-rp-muted">
            GitHub API 응답에 표시 가능한 diff hunk가 없습니다.
          </div>
        ) : null}
      </div>
    </Surface>
  );
}

function CommentList({ comments, selectedComment, onSelect, onOpenTrial }) {
  return (
    <Surface glow="yellow" className="min-h-[500px] p-5">
      <h2 className="text-lg font-extrabold text-rp-text">라인 코멘트 목록</h2>
      <p className="mt-2 text-xs text-rp-muted">코멘트를 클릭하면 공방 화면으로 전환됩니다.</p>
      <div className="mt-7 space-y-4">
        {comments.map((comment) => {
          const selected = selectedComment.id === comment.id;
          return (
            <button
              key={comment.id}
              type="button"
              onClick={() => onSelect(comment)}
              className={cn(
                "grid w-full grid-cols-[98px_1fr] gap-4 rounded-xl border p-4 text-left transition",
                selected
                  ? "border-[#ef262c] bg-[#1a0a0b]"
                  : "border-rp-line bg-rp-panel2 hover:border-rp-muted",
              )}
            >
              <span className="flex h-12 items-center justify-center overflow-hidden rounded-lg bg-[#2a0506]">
                <img className="h-16 w-24 object-contain" src={ASSETS.objection} alt="이의 있음" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-rp-muted">{comment.actor}</span>
                <span className="mt-2 block text-xs font-medium text-rp-text">{comment.body}</span>
              </span>
            </button>
          );
        })}
        {comments.length === 0 ? (
          <div className="rounded-xl border border-rp-line bg-rp-panel2 p-5 text-sm leading-6 text-rp-muted">
            이 PR에는 라인 리뷰 코멘트가 없습니다. 변경 파일의 첫 diff를 증거로 표시합니다.
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onOpenTrial}
        className="mt-9 h-10 w-full rounded-lg bg-rp-text text-sm font-semibold text-rp-bg transition hover:bg-rp-yellow"
      >
        선택한 코멘트로 재판 열기
      </button>
    </Surface>
  );
}

function IssueCommentList({ comments }) {
  return (
    <Surface glow="green" className="mt-8 p-5">
      <h2 className="text-lg font-extrabold text-rp-text">PR 코멘트</h2>
      <p className="mt-2 text-xs text-rp-muted">코드 라인에 묶이지 않은 PR 전체 대화입니다.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {comments.map((comment) => (
          <a
            key={comment.id}
            href={comment.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-rp-line bg-rp-panel2 p-4 transition hover:border-rp-green"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-rp-text">{comment.actor}</span>
              {comment.authorAssociation ? (
                <span className="rounded-full border border-rp-line px-2 py-0.5 text-[10px] font-semibold text-rp-muted">
                  {comment.authorAssociation}
                </span>
              ) : null}
            </div>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-rp-muted">{comment.body}</p>
          </a>
        ))}
        {comments.length === 0 ? (
          <div className="rounded-xl border border-rp-line bg-rp-panel2 p-5 text-sm leading-6 text-rp-muted">
            이 PR에는 전체 PR 코멘트가 없습니다.
          </div>
        ) : null}
      </div>
    </Surface>
  );
}

function ChangedFiles({ files, selectedPath }) {
  return (
    <Surface glow="cyan" className="mt-8 p-5">
      <h2 className="text-lg font-extrabold text-rp-text">변경 파일 목록</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {files.map((file) => (
          <span
            key={file.path}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold",
              file.path === selectedPath
                ? "border-rp-cyan bg-rp-cyan/10 text-rp-cyan"
                : "border-rp-line bg-rp-panel2 text-rp-muted",
            )}
          >
            {file.path} · +{file.additions ?? 0}/-{file.deletions ?? 0}
          </span>
        ))}
      </div>
    </Surface>
  );
}

function LineCommentComposer({ trialData, selectedLine, evidencePath, githubSession }) {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handlePost() {
    setPosting(true);
    setResult(null);
    setError(null);

    try {
      const response = await postLineComment({
        owner: trialData.pr.owner,
        repo: trialData.pr.repo,
        pullNumber: trialData.pr.number,
        commitId: trialData.pr.headSha,
        path: evidencePath,
        line: selectedLine?.line,
        body,
      });
      setResult(response);
    } catch (postError) {
      setError(postError);
    } finally {
      setPosting(false);
    }
  }

  return (
    <Surface glow="purple" className="mt-8 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold">이의 있음! 리뷰 작성</h2>
          <p className="mt-2 text-sm text-rp-muted">선택한 코드 라인에 GitHub PR 라인 코멘트를 직접 게시합니다.</p>
        </div>
        <Pill tone="red">이의 있음!</Pill>
      </div>
      <div className="mt-5 rounded-xl border border-rp-line bg-[#0b0b0b] p-4 font-mono text-xs">
        <p className="text-rp-subtle">{evidencePath}</p>
        <p className="mt-2 text-rp-text">
          {selectedLine?.line ?? "-"} {selectedLine?.code ?? "diff에서 코드 라인을 선택하세요."}
        </p>
      </div>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className="mt-4 min-h-[110px] w-full resize-none rounded-xl border border-rp-line bg-[#0b0b0b] p-4 text-sm leading-6 text-rp-text outline-none transition focus:border-rp-purple"
        placeholder="리뷰 내용을 입력하세요."
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handlePost}
          disabled={!githubSession?.authenticated || posting || !selectedLine?.line || !body.trim() || !trialData.pr.headSha}
          className="h-10 rounded-lg bg-rp-text px-6 text-sm font-semibold text-rp-bg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {posting ? "게시 중" : "GitHub에 게시"}
        </button>
        {!githubSession?.authenticated ? (
          <span className="text-xs font-semibold text-rp-yellow">GitHub 로그인이 필요합니다.</span>
        ) : null}
      </div>
      {result ? (
        <p className="mt-4 rounded-lg border border-rp-green/50 bg-rp-green/10 px-4 py-3 text-sm font-semibold text-rp-green">
          라인 코멘트가 게시되었습니다.
          {result.url ? (
            <a className="ml-2 underline" href={result.url} target="_blank" rel="noreferrer">
              보기
            </a>
          ) : null}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-[#ef262c]/50 bg-[#1a0a0b] px-4 py-3 text-sm font-semibold text-rp-text">
          라인 코멘트 게시 실패: {error.message}
        </p>
      ) : null}
    </Surface>
  );
}

function CourtScene({ mode, selectedComment, reply, attorneyName }) {
  const isAttorney = mode === "attorney";
  const character = isAttorney ? ASSETS.attorney : ASSETS.prosecutor;
  const speaker = isAttorney ? attorneyName : selectedComment.actor;
  const tone = isAttorney ? "blue" : "red";
  const title = isAttorney ? "작성자 답변" : "리뷰어 반박";
  const dialogue = isAttorney
    ? (reply || "")
    : selectedComment.body;

  return (
    <section className="relative min-h-[420px] overflow-hidden rounded-lg border border-rp-line bg-rp-panel shadow-glow-purple md:min-h-[560px]">
      <img className="absolute inset-0 h-full w-full object-cover opacity-70" src={ASSETS.courtroom} alt="" />
      <div className="absolute inset-0 bg-rp-bg/30" />
      <img
        className={cn(
          "absolute bottom-0 z-10 max-h-[90%] object-contain opacity-95",
          isAttorney ? "left-[4%] w-[70%] md:w-[64%]" : "-left-8 w-[55%] md:w-[52%]",
        )}
        src={character}
        alt=""
      />
      {!isAttorney ? (
        <img
          className="absolute left-[38%] top-7 z-20 w-[34%] max-w-[450px] object-contain"
          src={ASSETS.objection}
          alt=""
        />
      ) : null}
      <div className="absolute left-8 top-7 z-30">
        <Pill tone={tone}>{title}</Pill>
      </div>
      <div className="absolute inset-x-8 bottom-8 z-30">
        <div className="relative rounded-xl border border-rp-line bg-[#050913]/70 px-6 pb-8 pt-12">
          <span className={cn(
            "absolute -top-4 left-6 min-w-[138px] rounded-lg border border-rp-text px-4 py-2 text-center text-sm font-semibold",
            isAttorney ? "bg-[#2961fa]" : "bg-[#ef262c]",
          )}>
            {speaker}
          </span>
          <div className="text-lg font-semibold leading-relaxed text-rp-text md:text-xl">
            <MarkdownPreview value={dialogue} />
          </div>
          <span className="absolute bottom-3 right-6 text-3xl font-extrabold text-rp-yellow">»</span>
        </div>
      </div>
    </section>
  );
}

function ProsecutorStep({
  selectedComment,
  reply,
  onReplyChange,
  onAdvance,
  onBack,
}) {
  const evidenceLine = selectedComment.diffLines?.find((line) => line.flagged)
    ?? selectedComment.diffLines?.[0]
    ?? { line: selectedComment.line ?? "-", code: selectedComment.body };

  return (
    <>
      <CourtScene mode="prosecutor" selectedComment={selectedComment} reply={reply} />
      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,820px)_436px]">
        <Surface glow="purple" className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold">반박하기</h2>
              <p className="mt-2 text-sm text-rp-muted">PR 작성자가 리뷰어 주장에 답변할 Markdown을 직접 작성합니다.</p>
            </div>
            <Pill tone="green">Markdown</Pill>
          </div>
          <textarea
            value={reply}
            onChange={(event) => onReplyChange(event.target.value)}
            placeholder={"Markdown으로 답변을 작성하세요.\n예: **수정 완료했습니다.**\n- 테스트를 추가했습니다.\n```js\nexpect(result).toBe(true)\n```"}
            className="mt-5 min-h-[160px] w-full resize-y rounded-xl border border-rp-line bg-[#0b0b0b] p-5 font-mono text-sm leading-relaxed text-rp-text outline-none transition placeholder:text-rp-subtle/50 focus:border-rp-purple"
          />
          <div className="mt-4 rounded-xl border border-rp-line bg-rp-panel2 p-5">
            <p className="mb-3 text-xs font-extrabold uppercase text-rp-subtle">Markdown 미리보기</p>
            <MarkdownPreview value={reply} />
          </div>
          <div className="mt-5 flex flex-wrap gap-4">
            <button type="button" onClick={onBack} className="h-10 rounded-lg border border-rp-line bg-rp-panel2 px-8 text-sm font-semibold text-rp-text">
              증거로 돌아가기
            </button>
            <button type="button" onClick={onAdvance} className="h-10 rounded-lg bg-rp-text px-8 text-sm font-semibold text-rp-bg">
              답변 미리보기
            </button>
          </div>
        </Surface>
        <Surface glow="yellow" className="p-5">
          <h2 className="text-lg font-extrabold">선택된 증거</h2>
          <div className="mt-5 grid min-h-[34px] grid-cols-[42px_1fr] items-center rounded-lg border border-rp-yellow bg-[#1e1406] px-4 font-mono text-xs">
            <span className="text-rp-subtle">{evidenceLine.line}</span>
            <span className="whitespace-pre-wrap text-rp-text">{evidenceLine.code}</span>
          </div>
          <p className="mt-3 text-xs text-rp-subtle">{selectedComment.path}</p>
          <p className="mt-6 text-sm leading-relaxed text-rp-muted">{selectedComment.evidence}</p>
        </Surface>
      </section>
    </>
  );
}

function AttorneyStep({ trialData, selectedComment, reply, githubSession, attorneyName, onBack, onBackToEvidence }) {
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState(null);
  const [postError, setPostError] = useState(null);
  const finalReply = reply.trim();

  async function handlePostReply() {
    setPosting(true);
    setPostError(null);
    setPostResult(null);

    try {
      const result = await postReviewReply({
        owner: trialData.pr.owner,
        repo: trialData.pr.repo,
        pullNumber: trialData.pr.number,
        commentId: selectedComment.id,
        body: finalReply,
      });
      setPostResult(result);
    } catch (error) {
      setPostError(error);
    } finally {
      setPosting(false);
    }
  }

  return (
    <>
      <CourtScene mode="attorney" selectedComment={selectedComment} reply={reply} attorneyName={attorneyName} />
      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,820px)_436px]">
        <Surface glow="cyan" className="p-5">
          <h2 className="text-xl font-extrabold">GitHub 답글 게시 전 확인</h2>
          <p className="mt-2 text-sm text-rp-muted">선택한 리뷰 코멘트에 PR 작성자 답변을 Markdown 그대로 등록합니다.</p>
          <div className="mt-5 min-h-[116px] rounded-xl border border-rp-line bg-[#0b0b0b] p-5">
            <MarkdownPreview value={finalReply} />
          </div>
          <div className="mt-5 flex flex-wrap gap-4">
            <button type="button" onClick={onBack} className="h-10 rounded-lg border border-rp-line bg-rp-panel2 px-8 text-sm font-semibold text-rp-text">
              수정하기
            </button>
            <button type="button" onClick={onBackToEvidence} className="h-10 rounded-lg border border-rp-line bg-rp-panel2 px-8 text-sm font-semibold text-rp-text">
              증거 코드 diff로 돌아가기
            </button>
            <button
              type="button"
              onClick={handlePostReply}
              disabled={!githubSession?.authenticated || posting || !finalReply || Boolean(selectedComment.inReplyToId)}
              className="h-10 rounded-lg bg-rp-text px-8 text-sm font-semibold text-rp-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {posting ? "게시 중" : "GitHub에 답글 게시"}
            </button>
          </div>
          {!githubSession?.authenticated ? (
            <p className="mt-4 rounded-lg border border-rp-yellow/50 bg-rp-yellow/10 px-4 py-3 text-sm font-semibold text-rp-yellow">
              답글을 게시하려면 먼저 GitHub 로그인을 완료하세요.
            </p>
          ) : null}
          {selectedComment.inReplyToId ? (
            <p className="mt-4 rounded-lg border border-rp-yellow/50 bg-rp-yellow/10 px-4 py-3 text-sm font-semibold text-rp-yellow">
              GitHub은 답글의 답글을 지원하지 않습니다. 최상위 리뷰 코멘트를 선택하세요.
            </p>
          ) : null}
          {postResult ? (
            <p className="mt-4 rounded-lg border border-rp-green/50 bg-rp-green/10 px-4 py-3 text-sm font-semibold text-rp-green">
              GitHub 답글이 게시되었습니다.
              {postResult.url ? (
                <a className="ml-2 underline" href={postResult.url} target="_blank" rel="noreferrer">
                  보기
                </a>
              ) : null}
            </p>
          ) : null}
          {postError ? (
            <p className="mt-4 rounded-lg border border-[#ef262c]/50 bg-[#1a0a0b] px-4 py-3 text-sm font-semibold text-rp-text">
              답글 게시 실패: {postError.message}
            </p>
          ) : null}
        </Surface>
      </section>
    </>
  );
}

function demoTrialData(owner, repo, number) {
  return {
    pr: {
      owner: owner ?? "Woovengers",
      repo: repo ?? "Ace-PRtorney",
      number: number ?? 410,
      title: "역전 PR 리뷰 플로우",
      author: "bunny",
      headSha: "demo-head-sha",
      url: "https://github.com/Woovengers/Ace-PRtorney/pull/410",
      changedFiles: 8,
      additions: 214,
      deletions: 52,
      reviewComments: 13,
      conversationComments: demoIssueComments.length,
    },
    files: [
      {
        path: "ReservationService.java",
        patchLines: demoEvidenceLines,
      },
    ],
    comments: demoReviewComments,
    issueComments: demoIssueComments,
    selectedComment: demoReviewComments[0],
  };
}

function linesForComment(trialData, selectedComment) {
  if (selectedComment?.diffLines?.length) return selectedComment.diffLines;
  return trialData.files?.[0]?.patchLines ?? demoEvidenceLines;
}

function pathForComment(trialData, selectedComment) {
  return selectedComment?.path ?? trialData.files?.[0]?.path ?? "diff";
}

function firstCommentableLine(lines) {
  return lines?.find((line) => line.line) ?? null;
}

export default function TrialPage() {
  const { owner, repo, number } = useParams();
  const [prUrl, setPrUrl] = useState(
    owner && repo && number
      ? `https://github.com/${owner}/${repo}/pull/${number}`
      : DEFAULT_PR_URL,
  );
  const [stage, setStage] = useState("evidence");
  const [trialData, setTrialData] = useState(() => demoTrialData(owner, repo, number));
  const [selectedComment, setSelectedComment] = useState(() => demoReviewComments[0]);
  const [selectedLine, setSelectedLine] = useState(() => demoEvidenceLines.find((line) => line.flagged) ?? demoEvidenceLines[0]);
  const [reply, setReply] = useState("");
  const [githubSession, setGithubSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [loadingPr, setLoadingPr] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [hasLoadedPr, setHasLoadedPr] = useState(false);
  const evidenceLines = linesForComment(trialData, selectedComment);
  const evidencePath = pathForComment(trialData, selectedComment);
  const attorneyName = githubSession?.user?.login ?? trialData.pr.author;

  useEffect(() => {
    let cancelled = false;
    setAuthLoading(true);

    loadGithubSession()
      .then((session) => {
        if (!cancelled) setGithubSession(session);
      })
      .catch(() => {
        if (!cancelled) setGithubSession({ authenticated: false, user: null });
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogoutGithub() {
    setAuthLoading(true);
    try {
      await logoutGithub();
      setGithubSession({ authenticated: false, user: null });
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLoadEvidence() {
    if (!parseGithubPrUrl(prUrl)) {
      setLoadError(new Error("GitHub PR 링크를 입력해주세요."));
      return;
    }

    setLoadingPr(true);
    setLoadError(null);

    try {
      const payload = await loadTrialPr(prUrl);
      const nextSelected = payload.selectedComment ?? payload.comments?.[0] ?? demoReviewComments[0];
      const nextLines = nextSelected.diffLines ?? payload.files?.[0]?.patchLines ?? [];
      setTrialData(payload);
      setSelectedComment(nextSelected);
      setSelectedLine(firstCommentableLine(nextLines));
      setHasLoadedPr(true);
      setReply("");
      setStage("evidence");
    } catch (error) {
      setLoadError(error);
      setStage("evidence");
    } finally {
      setLoadingPr(false);
    }
  }

  function handleSelectComment(comment) {
    setSelectedComment(comment);
    setSelectedLine(firstCommentableLine(comment.diffLines));
  }

  return (
    <main className="page-grid min-h-screen overflow-x-hidden text-rp-text">
      <AppHeader active="trial" />
      <div className="mx-auto w-full max-w-[1440px] px-6 pb-20 pt-10 md:px-[54px]">
        <section className="max-w-5xl">
          <p className="text-xs font-semibold text-rp-purple">COURTROOM REVIEW MODE</p>
          <h1 className="mt-3 text-[40px] font-extrabold leading-tight md:text-[56px]">
            {!hasLoadedPr
              ? "GitHub PR 링크 입력"
              : stage === "evidence"
                ? `PR #${trialData.pr.number} 증거 기록`
                : stage === "prosecutor"
                  ? `${selectedComment.actor}의 반박`
                  : `${attorneyName}의 반박`}
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-rp-muted md:text-base">
            PR diff와 리뷰 코멘트를 법정 공방으로 바꿔, 리뷰어의 이의 제기와 작성자의 반박을 한 흐름에서 확인합니다.
          </p>
        </section>

        <PrUrlInput
          value={prUrl}
          loading={loadingPr}
          onChange={setPrUrl}
          onLoadEvidence={handleLoadEvidence}
        />
        {loadError ? (
          <div className="mt-4 rounded-lg border border-[#ef262c]/50 bg-[#1a0a0b] px-4 py-3 text-sm font-semibold text-rp-text">
            PR 정보를 불러오지 못했습니다. {loadError.message}
          </div>
        ) : null}

        {hasLoadedPr ? (
          <GithubAuthBar
            session={githubSession}
            loading={authLoading}
            onLogin={startGithubLogin}
            onLogout={handleLogoutGithub}
          />
        ) : null}

        {hasLoadedPr ? (
          <section className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Changed files"
              value={`${trialData.pr.changedFiles} files`}
              note={`+${trialData.pr.additions} / -${trialData.pr.deletions}`}
              glow="purple"
            />
            <MetricCard title="Open comments" value={`${trialData.pr.reviewComments}개`} note="라인 코멘트 기준" glow="yellow" />
            <MetricCard
              title="PR comments"
              value={`${trialData.pr.conversationComments ?? trialData.issueComments?.length ?? 0}개`}
              note="PR 전체 대화"
              glow="green"
            />
            <MetricCard
              title="Selected thread"
              value={`#${selectedComment.id}`}
              note={`${evidencePath}${selectedComment.line ? `:${selectedComment.line}` : ""}`}
              glow="cyan"
            />
          </section>
        ) : null}

        {hasLoadedPr && stage === "evidence" ? (
          <>
            <ChangedFiles files={trialData.files} selectedPath={evidencePath} />
            <section className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,820px)_436px]">
              <EvidenceCode
                lines={evidenceLines}
                path={evidencePath}
                selectedLine={selectedLine}
                onSelectLine={setSelectedLine}
                commentCount={trialData.comments.length}
              />
              <CommentList
                comments={trialData.comments}
                selectedComment={selectedComment}
                onSelect={handleSelectComment}
                onOpenTrial={() => setStage("prosecutor")}
              />
            </section>
            <IssueCommentList comments={trialData.issueComments ?? []} />
            <LineCommentComposer
              trialData={trialData}
              selectedLine={selectedLine}
              evidencePath={evidencePath}
              githubSession={githubSession}
            />
          </>
        ) : null}

        {hasLoadedPr && stage === "prosecutor" ? (
          <section className="mt-10">
            <ProsecutorStep
              selectedComment={selectedComment}
              reply={reply}
              onReplyChange={setReply}
              onBack={() => setStage("evidence")}
              onAdvance={() => setStage("attorney")}
            />
          </section>
        ) : null}

        {hasLoadedPr && stage === "attorney" ? (
          <section className="mt-10">
            <AttorneyStep
              trialData={trialData}
              selectedComment={selectedComment}
              reply={reply}
              githubSession={githubSession}
              attorneyName={attorneyName}
              onBack={() => setStage("prosecutor")}
              onBackToEvidence={() => setStage("evidence")}
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}
