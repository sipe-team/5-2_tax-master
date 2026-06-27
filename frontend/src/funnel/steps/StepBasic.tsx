import { useState } from "react";
import {
  INCOME_TYPE_LABEL,
  type FunnelData,
  type IncomeTypeUI,
} from "../../rules/profile";
import { Collapse } from "../components/Collapse";
import { NumberField } from "../components/NumberField";
import { SegmentedControl } from "../components/SegmentedControl";
import { StepShell } from "../components/StepShell";

type Ctx = Partial<FunnelData>;

// 1단계: 나이·소득 유형·연소득·월 투자가능액·기간
export function StepBasic({
  value,
  totalSteps,
  onNext,
}: {
  value: Ctx;
  totalSteps: number;
  onNext: (p: Ctx) => void;
}) {
  const [age, setAge] = useState(value.age ?? 30);
  const [incomeTypeUI, setIncomeTypeUI] = useState<IncomeTypeUI>(value.incomeTypeUI ?? "employee");
  const [incomeMan, setIncomeMan] = useState(value.incomeMan ?? 7000);
  const [monthlyMan, setMonthlyMan] = useState(value.monthlyMan ?? 50);
  const [horizonYears, setHorizonYears] = useState(value.horizonYears ?? 3);
  const noIncome = incomeTypeUI === "none";
  const valid = age > 0 && monthlyMan > 0 && horizonYears > 0 && (noIncome || incomeMan > 0);

  return (
    <StepShell
      step={1}
      totalSteps={totalSteps}
      title="기본 정보"
      subtitle="몇 가지만 입력하면 돼요."
      primaryLabel="다음"
      primaryDisabled={!valid}
      onPrimary={() => onNext({ age, incomeTypeUI, incomeMan, monthlyMan, horizonYears })}
    >
      <NumberField label="나이" value={age} onChange={setAge} suffix="세" />
      <div className="flex flex-col gap-2">
        <span className="text-[14px] font-semibold text-gray800">소득 유형</span>
        <SegmentedControl
          value={incomeTypeUI}
          onChange={setIncomeTypeUI}
          options={(Object.keys(INCOME_TYPE_LABEL) as IncomeTypeUI[]).map((t) => ({
            value: t,
            label: INCOME_TYPE_LABEL[t],
          }))}
        />
      </div>
      <Collapse open={!noIncome}>
        <NumberField
          label={incomeTypeUI === "employee" ? "연소득 (총급여)" : "연소득 (종합소득)"}
          value={incomeMan}
          onChange={setIncomeMan}
          suffix="만원"
        />
      </Collapse>
      <NumberField
        label="월 투자가능액"
        value={monthlyMan}
        onChange={setMonthlyMan}
        suffix="만원"
      />
      <NumberField
        label="언제 쓸 돈인가요?"
        value={horizonYears}
        onChange={setHorizonYears}
        suffix="년 뒤"
      />
    </StepShell>
  );
}
