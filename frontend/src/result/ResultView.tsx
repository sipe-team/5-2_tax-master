import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import type { ActionCard, Recommendation } from "../engine";
import { won } from "../lib/format";
import type { UserProfile } from "../rules/schema";
import { ruleSet } from "../rules/products";
import ScenarioPanel from "../ScenarioPanel";
import { BackHeader } from "../components/BackHeader";
import { ActionItem } from "./components/ActionItem";
import { Badges } from "./components/Badges";
import { Reveal } from "./components/Reveal";
import { Vessel } from "./components/Vessel";

// 워터폴 1, 2, 3 ... 순차 등장 (스크롤 무관, 마운트 시 cascade)
const waterfallContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};
const TOP_N = 5;

export function ResultView({ rec, profile }: { rec: Recommendation; profile: UserProfile }) {
  const [expanded, setExpanded] = useState(false);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);

  // PDF로 저장: 인쇄 전에 접힌 영역(워터폴 더보기·가정/제외)을 모두 펼쳐
  // 한 장에 전체 내용이 담기게 한 뒤 브라우저 인쇄(대상: PDF로 저장)를 띄운다.
  const handleSavePdf = () => {
    setExpanded(true);
    setAssumptionsOpen(true);
    // 가정·제외 펼침 애니메이션(0.25s)이 끝난 뒤 인쇄해야 내용이 잘리지 않는다.
    window.setTimeout(() => window.print(), 350);
  };

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
      <div className="no-print">
        <BackHeader />
      </div>
      <div className="pdf-page mx-auto max-w-[640px] px-5 pb-10 pt-6">
        <Reveal>
          {maxBenefitMan < 5 ? (
            <p className="mb-3 text-[22px] font-bold leading-tight tracking-tight text-gray900">
              절세를 잘하고 <span className="text-gold">계시네요!</span>
            </p>
          ) : (
            <p className="mb-3 text-[22px] font-bold leading-tight tracking-tight text-gray900">
              매년 최대
              <br />
              <span className="tnum text-gold">{maxBenefitMan.toLocaleString()}만원</span> 절약할
              수 있어요
            </p>
          )}
        </Reveal>

        <div className="no-print mb-6">
          <button
            type="button"
            onClick={handleSavePdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gold/50 px-3 py-1.5 text-[13px] font-600 text-gold outline-none transition-colors hover:bg-gold/10 focus-visible:bg-gold/10"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M10 3v9m0 0 3-3m-3 3-3-3M4 14v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            PDF로 저장
          </button>
        </div>

        <Reveal>
          <header className="mb-8">
            <h1 className="text-[16px] font-semibold leading-7 text-gray800">
              투자 절세 효율이 높은 <span className="text-gold">순서</span>예요.
            </h1>
          </header>
        </Reveal>

        {strategyActions.length > 0 && (
          <Reveal>
            <section className="mb-7">
              <h2 className="mb-3 text-[16px] font-semibold leading-7 tracking-[-0.3px] text-gray800">
                지금 할 일 · 전략
              </h2>
              <div className="flex flex-col gap-3">
                {strategyActions.map((a) => (
                  <ActionItem key={a.id} a={a} />
                ))}
              </div>
            </section>
          </Reveal>
        )}

        <Reveal>
          <section className="mb-7">
            <h2 className="mb-3 text-[16px] font-semibold leading-7 tracking-[-0.3px] text-gray800">
              매달 적립 우선순위
            </h2>
            {rec.waterfall.length === 0 ? (
              <p className="text-[16px] font-medium leading-7 tracking-[-0.3px] text-muted">
                조건에 맞는 절세 계좌가 없어요.
              </p>
            ) : (
              <>
                <div className="mb-5 rounded-xl bg-surface/60 p-4 ring-1 ring-line">
                  <p className="text-[16px] font-medium leading-7 tracking-[-0.3px] text-gray800">
                    매달 모을 수 있는{" "}
                    <span className="tnum font-semibold">{won(budgetMonthly)}원</span> 중{" "}
                    <span className="tnum font-semibold">{won(allocatedMonthly)}원</span>을 아래
                    순서대로 절세 계좌에 나눠 담아요.
                  </p>
                  {totalFirstYear > 0 && (
                    <p className="mt-1.5 text-[16px] font-medium leading-7 tracking-[-0.3px] text-gray800">
                      이대로 채우면 첫 해에 약{" "}
                      <span className="tnum font-semibold text-gold">
                        {won(totalFirstYear)}원
                      </span>
                      을 아낄 수 있어요.
                    </p>
                  )}
                  <p className="mt-2 text-[12px] font-medium leading-relaxed tracking-[-0.3px] text-muted">
                    각 계좌의 <span className="text-gold">첫 해 절세</span> 금액을 더한 값이에요.
                    1번부터 채우는 게 가장 효율이 높아요.
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
                    className="no-print mt-2 text-[16px] font-medium leading-7 tracking-[-0.3px] text-gold outline-none hover:underline focus-visible:underline"
                    onClick={() => setExpanded(true)}
                  >
                    + {hidden}개 더보기
                  </button>
                )}
              </>
            )}
            {rec.leftoverMonthly > 0 && (
              <p className="mt-4 text-[16px] font-medium leading-7 tracking-[-0.3px] text-muted">
                남는 <span className="tnum font-semibold">{won(rec.leftoverMonthly)}원</span>/월은
                일반계좌로 모으세요.
              </p>
            )}
          </section>
        </Reveal>

        {/* 이직 시나리오 (연봉 변화 시뮬레이터) — 인터랙티브라 PDF에서는 제외 */}
        <Reveal className="no-print">
          <ScenarioPanel profile={profile} rules={ruleSet} />
        </Reveal>

        {rec.assumptions.length > 0 && (
          <Reveal>
            <section className="mb-7">
              <button
                type="button"
                onClick={() => setAssumptionsOpen((v) => !v)}
                aria-expanded={assumptionsOpen}
                className="flex cursor-pointer items-center gap-1 text-[16px] font-semibold leading-7 tracking-[-0.3px] text-gray800 outline-none transition-colors hover:text-gold focus-visible:text-gold"
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
