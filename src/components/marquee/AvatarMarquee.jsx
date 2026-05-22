import Surface from "../common/Surface.jsx";
import AvatarMarqueeItem from "./AvatarMarqueeItem.jsx";

const ITEM_WIDTH_PX = 236;
const PIXELS_PER_SECOND = 118;
const MIN_LOOP_WIDTH_PX = 2200;

export default function AvatarMarquee({
  title,
  subtitle,
  items,
  direction = "left",
  glow = "green",
  onItemClick,
}) {
  const uniqueItems = Array.from(new Map(items.map((item) => [item.githubId, item])).values());
  const marqueeItems = [];
  if (uniqueItems.length > 0) {
    while (marqueeItems.length * ITEM_WIDTH_PX < MIN_LOOP_WIDTH_PX) {
      marqueeItems.push(...uniqueItems);
    }
  }
  const loopItems = marqueeItems.length > 0 ? [...marqueeItems, ...marqueeItems] : [];
  const duration = Math.max(1, Math.round((marqueeItems.length * ITEM_WIDTH_PX) / PIXELS_PER_SECOND));

  return (
    <Surface glow={glow} className="overflow-hidden p-5">
      <div className="mb-8">
        <h2 className="text-lg font-extrabold text-rp-text">{title}</h2>
        <p className="mt-1 text-xs text-rp-muted">{subtitle}</p>
      </div>
      <div className="marquee -mx-2">
        <div
          className="marquee-track"
          data-direction={direction}
          style={{ "--marquee-duration": `${duration}s` }}
        >
          {loopItems.map((item, index) => (
            <AvatarMarqueeItem
              key={`${item.role}-${item.githubId}-${item.occurredAt}-${index}`}
              item={item}
              onClick={onItemClick}
            />
          ))}
        </div>
      </div>
    </Surface>
  );
}
