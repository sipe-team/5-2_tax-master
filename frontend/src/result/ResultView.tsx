import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ActionCard, Recommendation } from "../engine";
import type { UserProfile } from "../rules/schema";
import { ruleSet } from "../rules/products";
import ScenarioPanel from "../ScenarioPanel";
import { BackHeader } from "../components/BackHeader";
import { Badges } from "./components/Badges";
import { Reveal } from "./components/Reveal";
import { HeroSummary } from "./sections/HeroSummary";
import { PdfSaveButton } from "./sections/PdfSaveButton";
import { StrategyActionsSection } from "./sections/StrategyActionsSection";
import { WaterfallSection } from "./sections/WaterfallSection";

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
        <HeroSummary maxBenefitMan={maxBenefitMan} />
        <PdfSaveButton onSave={handleSavePdf} />

        <Reveal>
          <header className="mb-8">
            <h1 className="text-[16px] font-semibold leading-7 text-gray800">
              투자 절세 효율이 높은 <span className="text-gold">순서</span>예요.
            </h1>
          </header>
        </Reveal>

        <StrategyActionsSection actions={strategyActions} />

        <WaterfallSection
          waterfall={rec.waterfall}
          actionByProduct={actionByProduct}
          leftoverMonthly={rec.leftoverMonthly}
          expanded={expanded}
          onExpand={() => setExpanded(true)}
        />

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
