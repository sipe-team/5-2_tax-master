import { useState } from "react";
import type { FunnelData } from "../../rules/profile";
import { CheckRow } from "../components/CheckRow";
import { Collapse } from "../components/Collapse";
import { NumberField } from "../components/NumberField";
import { StepShell } from "../components/StepShell";

type Ctx = Partial<FunnelData>;

// 4단계: 금융소득 + 가족 상황 (마지막 step → 결과 페이지 이동)
export function StepIncome({
  value,
  totalSteps,
  onSubmit,
  onSkip,
}: {
  value: Ctx;
  totalSteps: number;
  onSubmit: (p: Ctx) => void;
  onSkip: () => void;
}) {
  const [financialIncomeMan, setFin] = useState(value.financialIncomeMan ?? 0);
  const [dividendIncomeMan, setDiv] = useState(value.dividendIncomeMan ?? 0);
  const [holdsHighDividend, setHigh] = useState(value.holdsHighDividend ?? false);
  const [hasSpouse, setSpouse] = useState(value.hasSpouse ?? false);
  const [hasChildren, setChildren] = useState(value.hasChildren ?? false);
  const [hasMinorChildren, setMinor] = useState(value.hasMinorChildren ?? false);

  const patch: Ctx = {
    financialIncomeMan,
    dividendIncomeMan,
    holdsHighDividend,
    hasSpouse,
    hasChildren,
    hasMinorChildren,
  };

  return (
    <StepShell
      step={4}
      totalSteps={totalSteps}
      title="소득과 가족 상황"
      subtitle="금융소득 과세·증여·고배당 전략에 반영해요."
      primaryLabel="결과 보기"
      onSkip={onSkip}
      onPrimary={() => onSubmit(patch)}
    >
      <NumberField
        label="연 금융소득 (이자+배당)"
        value={financialIncomeMan}
        onChange={setFin}
        suffix="만원"
        placeholder="0"
      />
      <NumberField
        label="연 배당소득"
        value={dividendIncomeMan}
        onChange={setDiv}
        suffix="만원"
        placeholder="0"
      />
      <CheckRow label="고배당주 보유" checked={holdsHighDividend} onChange={setHigh} />
      <CheckRow label="배우자 있음" checked={hasSpouse} onChange={setSpouse} />
      <CheckRow label="자녀 있음" checked={hasChildren} onChange={setChildren} />
      <Collapse open={hasChildren}>
        <div className="ml-6">
          <CheckRow label="미성년 자녀 포함" checked={hasMinorChildren} onChange={setMinor} />
        </div>
      </Collapse>
    </StepShell>
  );
}
