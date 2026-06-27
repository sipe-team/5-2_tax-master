import { useMemo, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import type { ActionCard, Allocation, Badge, Recommendation } from "../engine";
import { googleCalendarUrl, buildCliffChart, projectGap } from "../engine";
import { won, pct } from "../lib/format";
import type { UserProfile } from "../rules/schema";
import { ruleSet } from "../rules/products";
import ScenarioPanel from "../ScenarioPanel";
import EventsPanel from "../EventsPanel";
import { BackHeader } from "../components/BackHeader";
import { CliffChartView } from "../CliffChartView";
import { GapChartView } from "../GapChartView";

// 스크롤로 뷰포트에 진입할 때 한 번 부드럽게 등장
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

// 워터폴 1, 2, 3 ... 순차 등장 (스크롤 무관, 마운트 시 cascade)
const waterfallContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};
const vesselItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

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

function ActionItem({ a }: { a: ActionCard }) {
  const isImmediate = a.urgency === "immediate";
  return (
    <div className={`border-l-2 pl-4 ${isImmediate ? "border-clay" : "border-line"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <strong className="text-[15px]">{a.name}</strong>
        {a.dDay != null ? (
          <span
            className={`font-display tnum text-sm font-700 ${a.dDay <= 14 ? "text-clay" : "text-muted"}`}
          >
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
          예상 절감{" "}
          <span className="font-display tnum font-600 text-gold">{won(a.estimatedBenefit)}원</span>
        </p>
      )}
      {a.warning && <p className="mt-1 text-[12px] text-clay">{a.warning}</p>}
      {a.deadline && <p className="mt-1 text-[11px] text-locked tnum">마감 {a.deadline}</p>}
      {googleCalendarUrl(a) && (
        <a
          href={googleCalendarUrl(a)!}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-gold/50 px-2.5 py-1 text-[12px] text-gold outline-none transition-colors hover:bg-gold/10 focus-visible:bg-gold/10"
        >
          캘린더에 추가
        </a>
      )}
      <Badges items={a.badges} />
    </div>
  );
}

function Vessel({ a, rank, action }: { a: Allocation; rank: number; action?: ActionCard }) {
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
            <strong className="text-[15px]">{a.name}</strong>
            {action?.dDay != null && (
              <span className="rounded-full border border-clay/50 px-2 py-0.5 text-[11px] font-600 leading-tight text-clay tnum">
                신청 마감 D-{action.dDay}
              </span>
            )}
          </div>
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
            효율 <span className="font-display text-gold">{pct(a.efficiency)}</span> · 첫 해 절세{" "}
            {won(a.firstYearBenefit)}원
          </span>
          <span>한도 {won(a.annualCap)}/년</span>
        </div>
        <p className="mt-1.5 text-[13px] text-muted">{a.rationale}</p>
        {action && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[12px]">
            <div className="min-w-0 flex-1">
              <p className="leading-relaxed text-gray800">{action.reason}</p>
              {action.warning && <p className="mt-1 text-clay">⚠ {action.warning}</p>}
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

const TOP_N = 5;

export function ResultView({ rec, profile }: { rec: Recommendation; profile: UserProfile }) {
  const [expanded, setExpanded] = useState(false);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);

  // 연봉 절벽 (와우모먼트): 룰에서 산출, 소득유형별.
  const cliff = useMemo(() => buildCliffChart(ruleSet, profile.incomeType), [profile.incomeType]);

  // N년 후 격차 (와우모먼트): 절세계좌 vs 일반계좌 누적 시뮬레이션.
  const gapProj = useMemo(
    () => projectGap(rec, profile.monthlyInvestable, profile.horizonYears, ruleSet),
    [rec, profile.monthlyInvestable, profile.horizonYears],
  );
  const shown = expanded ? rec.waterfall : rec.waterfall.slice(0, TOP_N);
  const hidden = rec.waterfall.length - shown.length;

  // 상품에 묶인 긴급 액션(urgent-<productId>)은 워터폴 그릇 행으로 합쳐 인라인 표시.
  // 그릇이 없는 순수 전략(증여·매도 등)과 RIA(워터폴 제외)는 전략 섹션에 남긴다.
  const waterfallIds = new Set(rec.waterfall.map((w) => w.productId));
  const actionByProduct = new Map<string, ActionCard>();
  const strategyActions = rec.actions.filter((a) => {
    const pid = a.id.startsWith("urgent-") ? a.id.slice("urgent-".length) : null;
    if (pid && waterfallIds.has(pid)) {
      actionByProduct.set(pid, a);
      return false;
    }
    return true;
  });

  // 워터폴 요약: 총 예산 중 절세 그릇에 담는 금액 → 첫 해 절세 합계 (흐름 가시화).
  const allocatedMonthly = rec.waterfall.reduce((s, a) => s + a.monthlyAmount, 0);
  const budgetMonthly = allocatedMonthly + rec.leftoverMonthly;
  const totalFirstYear = rec.waterfall.reduce((s, a) => s + a.firstYearBenefit, 0);

  // 최대 환급액 = 워터폴 첫 해 절세 + 액션 전략별 추정 절감액 (null 제외)
  const maxBenefitWon =
    rec.waterfall.reduce((s, a) => s + a.firstYearBenefit, 0) +
    rec.actions.reduce((s, a) => s + (a.estimatedBenefit ?? 0), 0);
  const maxBenefitMan = Math.round(maxBenefitWon / 10_000);

  return (
    <>
      <BackHeader />
      <div className="mx-auto max-w-[640px] px-5 pb-10 pt-6">
      <Reveal>
        <p className="mb-6 text-[22px] font-bold leading-tight tracking-tight text-gray900">
          매년 최대
          <br />
          <span className="tnum text-gold">{maxBenefitMan.toLocaleString()}만원</span> 절약할 수
          있어요
        </p>
      </Reveal>

      <Reveal>
        <header className="mb-8">
          <h1 className="text-[16px] font-semibold leading-7 text-gray800">
            투자 절세 효율이 높은 <span className="text-gold">순서</span>예요.
          </h1>
        </header>
      </Reveal>

      {strategyActions.length > 0 && (
        <Reveal>
          <section className="mb-7 rounded-2xl bg-surface p-5 ring-1 ring-clay/30">
            <h2 className="mb-4 text-[13px] font-600 tracking-wide text-clay">지금 할 일 · 전략</h2>
            <div className="flex flex-col gap-4">
              {strategyActions.map((a) => (
                <ActionItem key={a.id} a={a} />
              ))}
            </div>
          </section>
        </Reveal>
      )}

      <Reveal>
      <section className="mb-7">
        <h2 className="mb-3 text-[13px] font-600 tracking-wide text-muted">매달 적립 우선순위</h2>
        {rec.waterfall.length === 0 ? (
          <p className="text-[14px] text-muted">조건에 맞는 절세 그릇이 없어요.</p>
        ) : (
          <>
            <div className="mb-5 rounded-xl bg-surface/60 p-4 ring-1 ring-line">
              <p className="text-[13px] leading-relaxed text-gray800">
                매달 모을 수 있는{" "}
                <span className="font-display tnum font-600">{won(budgetMonthly)}원</span> 중{" "}
                <span className="font-display tnum font-600">{won(allocatedMonthly)}원</span>을 아래
                순서대로 절세 그릇에 나눠 담아요.
              </p>
              {totalFirstYear > 0 && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-gray800">
                  이대로 채우면 첫 해에 약{" "}
                  <span className="font-display tnum font-600 text-gold">
                    {won(totalFirstYear)}원
                  </span>
                  을 아낄 수 있어요.
                </p>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                각 그릇의 <span className="text-gold">첫 해 절세</span> 금액을 더한 값이에요. 1번부터
                채우는 게 가장 효율이 높아요.
              </p>
            </div>
            <motion.ol
              className="relative"
              variants={waterfallContainer}
              initial="hidden"
              animate="show"
            >
              <div
                className="absolute bottom-3 left-4 top-3 w-px -translate-x-1/2 bg-line"
                aria-hidden
              />
              {shown.map((a, i) => (
                <Vessel
                  key={a.productId}
                  a={a}
                  rank={i + 1}
                  action={actionByProduct.get(a.productId)}
                />
              ))}
            </motion.ol>
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
            남는 <span className="font-display tnum">{won(rec.leftoverMonthly)}원</span>/월은
            일반계좌로 모으세요.
          </p>
        )}
      </section>
      </Reveal>

      {/* 이직 시나리오 (연봉 변화 시뮬레이터) */}
      <Reveal>
        <ScenarioPanel profile={profile} rules={ruleSet} />
      </Reveal>

      {/* 연봉 절벽 (와우모먼트): 룰에 박힌 숨은 절벽 */}
      {cliff && cliff.markers.length > 0 && (
        <Reveal>
          <section className="mb-7 rounded-2xl bg-surface p-5 ring-1 ring-line">
            <h2 className="text-[18px] font-700 leading-tight">
              연봉이 이 선을 넘으면, <span className="text-clay">절세액이 떨어집니다</span>
            </h2>
            <p className="mt-1 text-[12px] text-muted">
              아무도 안 알려주는 '숨은 절벽' — 연봉 한 끗 차이로 혜택이 끊깁니다
              <span className="text-locked"> ({won(cliff.assumedContribution)}원 납입 기준)</span>
            </p>
            <div className="mt-4">
              <CliffChartView chart={cliff} currentIncome={profile.income} />
            </div>
            <div className="mt-4 flex flex-col gap-2.5">
              {cliff.markers.map((m) => (
                <div
                  key={`${m.income}-${m.label}`}
                  className={`rounded-xl border-l-2 bg-surface/60 py-2 pl-3 pr-3 ${m.delta < 0 ? "border-clay" : "border-gold"}`}
                >
                  <div className="text-[13px] font-600">📍 {m.label}</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-muted">{m.detail}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-locked">
              ※ 그래프는 {ruleSet.asOfLabel} 법령 경계를 그대로 표시합니다. 정보 제공 목적이며 자문이 아닙니다.
            </p>
          </section>
        </Reveal>
      )}

      {/* N년 후 격차 (와우모먼트): 절세계좌 vs 일반계좌 */}
      {gapProj.finalGap > 0 && (
        <Reveal>
          <section className="mb-7 rounded-2xl bg-surface p-5 ring-1 ring-line">
            <h2 className="text-[18px] font-700 leading-tight">
              {gapProj.horizonYears}년 후,{" "}
              <span className="text-gold">{won(gapProj.finalGap)}원</span> 차이가 납니다
            </h2>
            <p className="mt-1 text-[12px] text-muted">
              같은 돈을 일반계좌에 둘 때 vs 절세 그릇에 담을 때 — 시간이 갈수록 벌어집니다
              <span className="text-locked"> (연 {pct(gapProj.returnRate)} 수익 가정, 양쪽 동일)</span>
            </p>
            <div className="mt-4">
              <GapChartView proj={gapProj} />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-locked">
              ※ 차이는 오직 '세금'에서만 발생하도록 계산했습니다(수익률 우위 가정 없음). 운용 단계 누적의 근사치이며
              연금 수령 시 과세·중도해지 페널티는 미반영입니다. 정보 제공 목적이며 자문이 아닙니다.
            </p>
          </section>
        </Reveal>
      )}

      {/* 재테크/비즈니스 이벤트 (마감 임박순) */}
      <Reveal>
        <EventsPanel asOf={profile.asOf} />
      </Reveal>

      {rec.assumptions.length > 0 && (
        <Reveal>
          <section className="mb-7">
            <button
              type="button"
              onClick={() => setAssumptionsOpen((v) => !v)}
              aria-expanded={assumptionsOpen}
              className="flex cursor-pointer items-center gap-1 text-[12px] tracking-wide text-muted outline-none transition-colors hover:text-gold focus-visible:text-gold"
            >
              가정 · 제외 <span className="text-locked tnum">{rec.assumptions.length}</span>
              <svg
                className={`h-3.5 w-3.5 transition-transform ${assumptionsOpen ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden
              >
                <path
                  d="M6 8l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <AnimatePresence initial={false}>
              {assumptionsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden px-1"
                >
                  <Badges items={rec.assumptions} />
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </Reveal>
      )}

      <Reveal>
        <footer className="border-t border-line pt-5 text-[12px] leading-relaxed text-muted">
          {rec.disclaimers.map((d, i) => (
            <p key={i}>※ {d}</p>
          ))}
        </footer>
      </Reveal>
      </div>
    </>
  );
}
