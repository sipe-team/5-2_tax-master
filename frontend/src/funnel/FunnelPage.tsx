import { useState } from "react";
import { useNavigate } from "react-router";
import { useFunnel } from "@use-funnel/react-router";
import { CheckRow } from "./components/CheckRow";
import { Collapse } from "./components/Collapse";
import { NumberField } from "./components/NumberField";
import { StepShell } from "./components/StepShell";
import { StepBasic } from "./steps/StepBasic";
import { FunnelDataSchema, type FunnelData, toProfile } from "../rules/profile";

type Ctx = Partial<FunnelData>;

const STEPS = ["basic", "accounts", "invest", "income"] as const;

// ── 2단계: 보유 절세계좌 ────────────────────────────────
function StepAccounts({
  value,
  onNext,
  onSkip,
}: {
  value: Ctx;
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
      totalSteps={STEPS.length}
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

// ── 3단계: 투자 현황 ────────────────────────────────────
function StepInvest({
  value,
  onNext,
  onSkip,
}: {
  value: Ctx;
  onNext: (p: Ctx) => void;
  onSkip: () => void;
}) {
  const [hasOverseas, setHasOverseas] = useState(value.hasOverseas ?? false);
  const [overseasValueMan, setOverseasValue] = useState(value.overseasValueMan ?? 0);
  const [overseasCostMan, setOverseasCost] = useState(value.overseasCostMan ?? 0);

  return (
    <StepShell
      step={3}
      totalSteps={STEPS.length}
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

// ── 4단계: 소득·가족 ────────────────────────────────────
function StepIncome({
  value,
  onSubmit,
  onSkip,
}: {
  value: Ctx;
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
      totalSteps={STEPS.length}
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

export default function FunnelPage() {
  const navigate = useNavigate();
  const funnel = useFunnel<{ basic: Ctx; accounts: Ctx; invest: Ctx; income: Ctx }>({
    id: "tax-funnel",
    initial: { step: "basic", context: {} },
  });

  function finish(ctx: Ctx) {
    const parsed = FunnelDataSchema.safeParse(ctx);
    if (!parsed.success) return; // 필수값 누락 시 무시 (1단계에서 막힘)
    navigate("/result", { state: toProfile(parsed.data) });
  }

  return (
    <funnel.Render
      basic={({ context, history }) => (
        <StepBasic
          value={context}
          totalSteps={STEPS.length}
          onNext={(p) => history.push("accounts", { ...context, ...p })}
        />
      )}
      accounts={({ context, history }) => (
        <StepAccounts
          value={context}
          onNext={(p) => history.push("invest", { ...context, ...p })}
          onSkip={() => history.push("invest", { ...context })}
        />
      )}
      invest={({ context, history }) => (
        <StepInvest
          value={context}
          onNext={(p) => history.push("income", { ...context, ...p })}
          onSkip={() => history.push("income", { ...context })}
        />
      )}
      income={({ context }) => (
        <StepIncome
          value={context}
          onSubmit={(p) => finish({ ...context, ...p })}
          onSkip={() => finish(context)}
        />
      )}
    />
  );
}
