import Surface from "../common/Surface.jsx";
import AvatarMarqueeItem from "./AvatarMarqueeItem.jsx";

export default function AvatarMarquee({
  title,
  subtitle,
  items,
  direction = "left",
  glow = "green",
  onItemClick,
}) {
  const loopItems = items.length > 0 ? [...items, ...items] : [];

  return (
    <Surface glow={glow} className="overflow-hidden p-5">
      <div className="mb-8">
        <h2 className="text-lg font-extrabold text-rp-text">{title}</h2>
        <p className="mt-1 text-xs text-rp-muted">{subtitle}</p>
      </div>
      <div className="marquee -mx-2">
        <div className="marquee-track" data-direction={direction}>
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
