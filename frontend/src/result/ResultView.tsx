import { useState } from "react";
import type { Recommendation } from "../engine";
import { splitWaterfallAndStrategyActions, totalMaxBenefitWon } from "../engine";
import type { UserProfile } from "../rules/schema";
import ScenarioPanel from "./sections/ScenarioPanel";
import { BackHeader } from "../components/BackHeader";
import { Reveal } from "./components/Reveal";
import { AssumptionsSection } from "./sections/AssumptionsSection";
import { DisclaimerFooter } from "./sections/DisclaimerFooter";
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

  const { strategyActions, actionByProduct } = splitWaterfallAndStrategyActions(rec);
  const maxBenefitMan = Math.round(totalMaxBenefitWon(rec) / 10_000);

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
            <h1 className="heading-md">
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
          <ScenarioPanel profile={profile} />
        </Reveal>

        <AssumptionsSection
          items={rec.assumptions}
          open={assumptionsOpen}
          onToggle={() => setAssumptionsOpen((v) => !v)}
        />

        <DisclaimerFooter items={rec.disclaimers} />
      </div>
    </>
  );
}
