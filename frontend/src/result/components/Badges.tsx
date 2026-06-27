import type { Badge } from "../../engine";

const BADGE_STYLE: Record<Badge["kind"], string> = {
  assumed: "border-line text-muted",
  upsell: "border-gold/50 text-gold",
  warning: "border-clay/50 text-clay",
  info: "border-line text-muted",
};
const BADGE_LABEL: Record<Badge["kind"], string> = {
  assumed: "가정",
  upsell: "더 받기",
  warning: "주의",
  info: "참고",
};

// 가정·업셀·경고·참고 등의 작은 pill 배지 묶음
export function Badges({ items }: { items: Badge[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((b, i) => (
        <span
          key={i}
          className={`rounded-full border px-2 py-0.5 text-[11px] leading-tight ${BADGE_STYLE[b.kind]}`}
        >
          <span className="font-600">{BADGE_LABEL[b.kind]}</span> {b.text}
        </span>
      ))}
    </div>
  );
}
