import { useState } from "react";
import type { FunnelData } from "../../rules/profile";
import { CheckRow } from "../components/CheckRow";
import { Collapse } from "../components/Collapse";
import { NumberField } from "../components/NumberField";
import { StepShell } from "../components/StepShell";

type Ctx = Partial<FunnelData>;

// 2단계: 보유 절세계좌 (연금저축·IRP·ISA)
export function StepAccounts({
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
  const [hasPension, setHasPension] = useState(value.hasPension ?? false);
  const [pensionContributionMan, setPension] = useState(value.pensionContributionMan ?? 0);
  const [hasIrp, setHasIrp] = useState(value.hasIrp ?? false);
  const [irpContributionMan, setIrp] = useState(value.irpContributionMan ?? 0);
  const [hasIsa, setHasIsa] = useState(value.hasIsa ?? false);

  return (
    <StepShell
      step={2}
      totalSteps={totalSteps}
      title="이미 가진 절세계좌가 있나요?"
      subtitle="잔여 한도와 전환 전략을 더 정확히 계산해요."
      primaryLabel="다음"
      onSkip={onSkip}
      onPrimary={() =>
        onNext({ hasPension, pensionContributionMan, hasIrp, irpContributionMan, hasIsa })
      }
    >
      <div>
        <CheckRow
          label="연금저축 보유"
          checked={hasPension}
          onChange={(v) => {
            setHasPension(v);
            if (v && pensionContributionMan === 0) setPension(600); // 세액공제 한도 기본 prefill
          }}
        />
        <Collapse open={hasPension}>
          <div className="ml-6 mt-2">
            <NumberField
              label="올해 납입액 (한도 600)"
              value={pensionContributionMan}
              onChange={setPension}
              suffix="만원"
            />
          </div>
        </Collapse>
      </div>
      <div>
        <CheckRow
          label="IRP 보유"
          checked={hasIrp}
          onChange={(v) => {
            setHasIrp(v);
            if (v && irpContributionMan === 0) setIrp(300); // 연금 합산 900 한도 내 기본 prefill
          }}
        />
        <Collapse open={hasIrp}>
          <div className="ml-6 mt-2">
            <NumberField
              label="올해 납입액 (합산 900)"
              value={irpContributionMan}
              onChange={setIrp}
              suffix="만원"
            />
          </div>
        </Collapse>
      </div>
      <CheckRow label="ISA 보유" checked={hasIsa} onChange={setHasIsa} />
    </StepShell>
  );
}
