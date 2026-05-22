import Surface from "../common/Surface.jsx";
import AvatarMarqueeItem from "./AvatarMarqueeItem.jsx";

const ITEM_WIDTH_PX = 236;
const PIXELS_PER_SECOND = 118;
const MIN_UNIQUE_ITEMS_FOR_MARQUEE = 18;

export default function AvatarMarquee({
  title,
  subtitle,
  items = [],
  direction = "left",
  glow = "green",
  onItemClick,
}) {
  const uniqueItems = Array.from(new Map(items.map((item) => [item.githubId, item])).values());
  const shouldAnimate = uniqueItems.length >= MIN_UNIQUE_ITEMS_FOR_MARQUEE;
  const duration = Math.max(1, Math.round((uniqueItems.length * ITEM_WIDTH_PX) / PIXELS_PER_SECOND));

  return (
    <Surface glow={glow} className="overflow-hidden p-5">
      <div className="mb-8">
        <h2 className="text-lg font-extrabold text-rp-text">{title}</h2>
        <p className="mt-1 text-xs text-rp-muted">{subtitle}</p>
      </div>
      {shouldAnimate ? (
        <div className="marquee -mx-2">
          <div
            className="marquee-track"
            data-direction={direction}
            style={{ "--marquee-duration": `${duration}s` }}
          >
            {uniqueItems.map((item) => (
              <AvatarMarqueeItem
                key={`${item.role}-${item.githubId}`}
                item={item}
                onClick={onItemClick}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="-mx-2 flex flex-wrap gap-y-3">
          {uniqueItems.length > 0 ? (
            uniqueItems.map((item) => (
              <AvatarMarqueeItem
                key={`${item.role}-${item.githubId}`}
                item={item}
                onClick={onItemClick}
              />
            ))
          ) : (
            <p className="mx-2 text-sm text-rp-muted">표시할 최근 활동이 없습니다.</p>
          )}
        </div>
      )}
    </Surface>
  );
}
