import { displayMeta, displayName, personInitial } from "../../utils/person.js";
import { relativeTime } from "../../utils/time.js";

export default function AvatarMarqueeItem({ item, onClick }) {
  const person = {
    ...item,
    displayName: item.nickname ?? item.githubId,
    displayMeta: [item.cohort ? `${item.cohort}기` : null, item.trackLabel, `@${item.githubId}`]
      .filter(Boolean)
      .join(" · "),
  };

  return (
    <button
      type="button"
      className="mx-2 flex h-[60px] w-[220px] shrink-0 cursor-pointer items-center gap-3 rounded-full border border-[rgba(42,42,42,0.28)] bg-rp-panel2 px-2 text-left shadow-[0_0_24px_rgba(110,231,249,0.16)] transition duration-200 hover:scale-[1.03] hover:shadow-[0_0_36px_rgba(110,231,249,0.30)]"
      onClick={() => onClick?.(item)}
    >
      {item.avatarUrl ? (
        <img
          alt=""
          src={item.avatarUrl}
          className="h-[42px] w-[42px] rounded-full bg-rp-cyan object-cover"
          loading="lazy"
        />
      ) : (
        <span className="grid h-[42px] w-[42px] place-items-center rounded-full bg-rp-cyan text-sm font-extrabold text-rp-bg">
          {personInitial(person)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-rp-text">
          {displayName(person)}
        </span>
        <span className="block truncate text-[10px] text-rp-subtle">{displayMeta(person)}</span>
      </span>
      <span className="w-12 shrink-0 text-right text-[10px] text-rp-muted">
        {relativeTime(item.occurredAt)}
      </span>
    </button>
  );
}
