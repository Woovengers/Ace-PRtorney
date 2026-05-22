import { cn } from "../../utils/classNames.js";

const glowClasses = {
  purple: "shadow-glow-purple hover:shadow-[0_0_48px_rgba(168,85,247,0.30)]",
  green: "shadow-glow-green hover:shadow-[0_0_48px_rgba(183,255,90,0.30)]",
  cyan: "shadow-glow-cyan hover:shadow-[0_0_48px_rgba(110,231,249,0.30)]",
  yellow: "shadow-glow-yellow hover:shadow-[0_0_48px_rgba(253,224,71,0.30)]",
};

export default function Surface({
  as: Component = "section",
  className,
  glow = "purple",
  interactive = false,
  children,
  ...props
}) {
  return (
    <Component
      className={cn(
        "cursor-pointer rounded-lg border border-[rgba(42,42,42,0.28)] bg-rp-panel transition duration-200",
        glowClasses[glow],
        interactive && "hover:-translate-y-0.5",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
