import { useState } from "react";
import type { FunnelData } from "../../rules/profile";
import { CheckRow } from "../components/CheckRow";
import { Collapse } from "../components/Collapse";
import { NumberField } from "../components/NumberField";
import { StepShell } from "../components/StepShell";

type Ctx = Partial<FunnelData>;

// 3단계: 투자 현황 (해외주식 보유 여부 + 평가액·취득가)
export function StepInvest({
  value,
  totalSteps,
  onNext,
  onSkip,
}: {
  value: Ctx;
  totalSteps: number;
  onNext: (p: Ctx) => void;
  onSkip: () => void;
}) {
  const [hasOverseas, setHasOverseas] = useState(value.hasOverseas ?? false);
  const [overseasValueMan, setOverseasValue] = useState(value.overseasValueMan ?? 0);
  const [overseasCostMan, setOverseasCost] = useState(value.overseasCostMan ?? 0);

  return (
    <StepShell
      step={3}
      totalSteps={totalSteps}
      title="해외주식을 보유하고 있나요?"
      subtitle="보유 중이면 RIA 감면·분산매도·증여 전략을 검토해요."
      primaryLabel="다음"
      onSkip={onSkip}
      onPrimary={() => onNext({ hasOverseas, overseasValueMan, overseasCostMan })}
    >
      <CheckRow label="해외주식 보유 중" checked={hasOverseas} onChange={setHasOverseas} />
      <Collapse open={hasOverseas}>
        <div className="ml-6 flex flex-col gap-4">
          <NumberField
            label="평가액"
            value={overseasValueMan}
            onChange={setOverseasValue}
            suffix="만원"
          />
          <NumberField
            label="취득가"
            value={overseasCostMan}
            onChange={setOverseasCost}
            suffix="만원"
          />
        </div>
      </Collapse>
    </StepShell>
  );
}
