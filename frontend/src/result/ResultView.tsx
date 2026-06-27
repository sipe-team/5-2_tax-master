import { useState } from "react";
import type { ActionCard, Allocation, Badge, Recommendation } from "../engine";
import { won, pct } from "../lib/format";

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

function Badges({ items }: { items: Badge[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((b, i) => (
        <span key={i} className={`rounded-full border px-2 py-0.5 text-[11px] leading-tight ${BADGE_STYLE[b.kind]}`}>
          <span className="font-600">{BADGE_LABEL[b.kind]}</span> {b.text}
        </span>
      ))}
    </div>
  );
}

function ActionItem({ a }: { a: ActionCard }) {
  const isImmediate = a.urgency === "immediate";
  return (
    <div className={`border-l-2 pl-4 ${isImmediate ? "border-clay" : "border-line"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <strong className="text-[15px]">{a.name}</strong>
        {a.dDay != null ? (
          <span className={`font-display tnum text-sm font-700 ${a.dDay <= 14 ? "text-clay" : "text-muted"}`}>
            D-{a.dDay}
          </span>
        ) : (
          <span className="text-[11px] text-muted">{a.category}</span>
        )}
      </div>
      <p className="mt-1 text-[13px] text-muted">{a.reason}</p>
      <p className="mt-1 text-[13px]">
        <span className="text-muted">→ </span>
        {a.action}
      </p>
      {a.estimatedBenefit != null && (
        <p className="mt-1 text-[13px]">
          예상 절감 <span className="font-display tnum font-600 text-gold">{won(a.estimatedBenefit)}원</span>
        </p>
      )}
      {a.warning && <p className="mt-1 text-[12px] text-clay">⚠ {a.warning}</p>}
      {a.deadline && <p className="mt-1 text-[11px] text-locked tnum">마감 {a.deadline}</p>}
      <Badges items={a.badges} />
    </div>
  );
}

function Vessel({ a, rank }: { a: Allocation; rank: number }) {
  const ratio = a.annualCap > 0 && isFinite(a.annualCap) ? Math.min(1, a.annualAmount / a.annualCap) : 1;
  return (
    <li className="relative grid grid-cols-[2rem_1fr] gap-4 pb-7 last:pb-0">
      <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface font-display text-sm font-600 text-gold tnum ring-1 ring-gold/40">
        {rank}
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <strong className="text-[15px]">{a.name}</strong>
          <div className="text-right">
            <span className="font-display tnum text-lg font-600">{won(a.monthlyAmount)}</span>
            <span className="text-xs text-muted">원/월</span>
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
            효율 <span className="font-display text-gold">{pct(a.efficiency)}</span> · 첫 해 절세 {won(a.firstYearBenefit)}원
          </span>
          <span>한도 {won(a.annualCap)}/년</span>
        </div>
        <p className="mt-1.5 text-[13px] text-muted">{a.rationale}</p>
        <Badges items={a.badges} />
      </div>
    </li>
  );
}

const TOP_N = 5;

export function ResultView({ rec }: { rec: Recommendation }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rec.waterfall : rec.waterfall.slice(0, TOP_N);
  const hidden = rec.waterfall.length - shown.length;

  return (
    <div className="mx-auto max-w-[640px] px-5 py-10">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-[11px] tracking-[0.18em] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          나의 절세 추천
        </div>
        <h1 className="text-[26px] font-700 leading-tight tracking-tight">
          투자 절세 효율이 높은 <span className="text-gold">순서</span>예요.
        </h1>
      </header>

      {rec.actions.length > 0 && (
        <section className="mb-7 rounded-2xl bg-surface p-5 ring-1 ring-clay/30">
          <h2 className="mb-4 text-[13px] font-600 tracking-wide text-clay">지금 할 일 · 전략</h2>
          <div className="flex flex-col gap-4">
            {rec.actions.map((a) => (
              <ActionItem key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}

      <section className="mb-7">
        <h2 className="mb-5 text-[13px] font-600 tracking-wide text-muted">매달 적립 우선순위</h2>
        {rec.waterfall.length === 0 ? (
          <p className="text-[14px] text-muted">조건에 맞는 절세 그릇이 없어요.</p>
        ) : (
          <>
            <ol className="relative">
              <div className="absolute bottom-3 left-4 top-3 w-px -translate-x-1/2 bg-line" aria-hidden />
              {shown.map((a, i) => (
                <Vessel key={a.productId} a={a} rank={i + 1} />
              ))}
            </ol>
            {hidden > 0 && (
              <button
                className="mt-2 text-[13px] text-gold outline-none hover:underline focus-visible:underline"
                onClick={() => setExpanded(true)}
              >
                + {hidden}개 더보기
              </button>
            )}
          </>
        )}
        {rec.leftoverMonthly > 0 && (
          <p className="mt-4 text-[13px] text-muted">
            남는 <span className="font-display tnum">{won(rec.leftoverMonthly)}원</span>/월은 일반계좌로.
          </p>
        )}
      </section>

      {rec.assumptions.length > 0 && (
        <section className="mb-7 rounded-2xl bg-surface/60 p-5 ring-1 ring-line">
          <h3 className="mb-2 text-[12px] tracking-wide text-muted">가정 · 제외</h3>
          <Badges items={rec.assumptions} />
        </section>
      )}

      <footer className="border-t border-line pt-5 text-[12px] leading-relaxed text-muted">
        {rec.disclaimers.map((d, i) => (
          <p key={i}>※ {d}</p>
        ))}
      </footer>
    </div>
  );
}
