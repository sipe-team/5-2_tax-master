import { motion, type Variants } from "framer-motion";
import type { ActionCard, Allocation } from "../../engine";
import { googleCalendarUrl } from "../../engine";
import { pct, won } from "../../lib/format";
import { Badges } from "./Badges";

// 워터폴 한 칸의 stagger 모션 — 부모(motion.ol)의 staggerChildren에 맞춰 순차 등장
export const vesselItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

// "매달 적립 우선순위" 한 줄 — 번호 + 그릇 이름 + 월 적립금 + 진행률 바 + 효율/한도 + rationale + 액션 인라인
export function Vessel({
  a,
  rank,
  action,
}: {
  a: Allocation;
  rank: number;
  action?: ActionCard;
}) {
  const ratio =
    a.annualCap > 0 && isFinite(a.annualCap) ? Math.min(1, a.annualAmount / a.annualCap) : 1;
  const calUrl = action ? googleCalendarUrl(action) : null;
  return (
    <motion.li
      variants={vesselItem}
      className="relative grid grid-cols-[2rem_1fr] gap-4 pb-7 last:pb-0"
    >
      <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface font-display text-sm font-600 text-gold tnum ring-1 ring-gold/40">
        {rank}
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <strong className="text-[16px] font-semibold leading-7 tracking-[-0.3px] text-gray800">
              {a.name}
            </strong>
            {action?.dDay != null && (
              <span className="rounded-full border border-clay/50 px-2 py-0.5 text-[11px] font-600 leading-tight text-clay tnum">
                신청 마감 D-{action.dDay}
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="tnum text-[16px] font-semibold leading-7 tracking-[-0.3px] text-gray800">
              {won(a.monthlyAmount)}
            </span>
            <span className="text-[12px] font-medium tracking-[-0.3px] text-muted"> 원/월</span>
          </div>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-line/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold2 to-gold transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-muted tnum">
          <span>
            효율 <span className="font-display text-gold">{pct(a.efficiency)}</span> · 첫 해 절세{" "}
            {won(a.firstYearBenefit)}원
          </span>
          <span>한도 {won(a.annualCap)}/년</span>
        </div>
        <p className="mt-2 text-[16px] font-medium leading-7 tracking-[-0.3px] text-muted">
          {a.rationale}
        </p>
        {action && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium leading-5 tracking-[-0.3px] text-gray800">
                {action.reason}
              </p>
              {action.warning && (
                <p className="mt-1 text-[14px] font-medium tracking-[-0.3px] text-clay">
                  ⚠ {action.warning}
                </p>
              )}
            </div>
            {calUrl && (
              <a
                href={calUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gold/50 px-2.5 py-1 text-[12px] text-gold outline-none transition-colors hover:bg-gold/10 focus-visible:bg-gold/10"
              >
                캘린더에 추가
              </a>
            )}
          </div>
        )}
        <Badges items={a.badges} />
      </div>
    </motion.li>
  );
}
