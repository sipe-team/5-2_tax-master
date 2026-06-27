import { useState } from "react";
import { useNavigate } from "react-router";
import { useFunnel } from "@use-funnel/react-router";
import checkedIcon from "../assets/checked.svg";
import defaultCheckIcon from "../assets/default-check.svg";
import { BackHeader } from "../components/BackHeader";
import {
  FunnelDataSchema,
  INCOME_TYPE_LABEL,
  type FunnelData,
  type IncomeTypeUI,
  toProfile,
} from "../rules/profile";

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-xl bg-paper p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-lg py-2 text-[14px] font-600 transition-colors ${
              active ? "bg-surface text-ink shadow-sm" : "text-muted"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

type Ctx = Partial<FunnelData>;

const STEPS = ["basic", "accounts", "invest", "income"] as const;

// ── 공용 입력 (Toss 박스 스타일) ─────────────────────────
// 사양: w-full · padding 20px · gap 14px · border-radius 8px · bg #FFF
// 에러: border 1px #FF5761 (error 토큰)

function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  error,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number) => void;
  suffix: string;
  placeholder?: string;
  error?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value ? String(value) : "");
  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="text-[14px] font-semibold text-gray800">{label}</span>
      <span
        className={`flex w-full items-center gap-3.5 rounded-lg border bg-surface p-5 transition-colors ${
          error ? "border-error" : "border-line focus-within:border-gold"
        }`}
      >
        <input
          type="text"
          inputMode="numeric"
          className="min-w-0 flex-1 bg-transparent font-sans text-base font-medium leading-none tracking-[-0.3px] tnum text-gray900 outline-none placeholder:text-locked"
          value={shown}
          placeholder={placeholder}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const c = e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
            setDraft(c);
            onChange(c === "" ? 0 : Number(c));
          }}
          onBlur={() => setDraft(null)}
        />
        <span className="whitespace-nowrap text-xs text-muted">{suffix}</span>
      </span>
    </label>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
  error,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: boolean;
}) {
  return (
    <label
      className={`flex w-full cursor-pointer items-center gap-3.5 rounded-lg p-5 text-[18px] font-semibold leading-5 tracking-[-0.54px] text-gray800 transition-colors ${
        checked
          ? "bg-primary-light backdrop-blur-[50px]"
          : error
            ? "border border-error bg-surface"
            : "border border-line bg-surface"
      }`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <img
        src={checked ? checkedIcon : defaultCheckIcon}
        alt=""
        aria-hidden
        width={24}
        height={24}
        className="shrink-0"
      />
      {label}
    </label>
  );
}

function StepShell({
  step,
  title,
  subtitle,
  children,
  onPrimary,
  primaryLabel,
  primaryDisabled,
  onSkip,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onPrimary: () => void;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onSkip?: () => void;
}) {
  return (
    <>
      <BackHeader />
      <div className="mx-auto flex min-h-[calc(100svh-54px)] max-w-[640px] flex-col px-5 pb-28 pt-6">
        <div className="mb-6 flex items-center gap-2 text-[11px] tracking-[0.18em] text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
        {step} / {STEPS.length}
      </div>
      <h1 className="text-[16px] font-semibold leading-7 text-gray800">{title}</h1>
      {subtitle && <p className="mt-2 text-[14px] font-medium leading-5 text-muted">{subtitle}</p>}
      <div className="mt-8 flex flex-col gap-6">{children}</div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[640px] items-center gap-3 px-5 py-4">
          {onSkip && (
            <button className="px-3 py-3 text-[14px] text-muted" onClick={onSkip}>
              건너뛰기
            </button>
          )}
          <button
            className="flex-1 rounded-xl bg-gold py-3.5 text-[16px] font-600 text-white transition disabled:opacity-40"
            onClick={onPrimary}
            disabled={primaryDisabled}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
      </div>
    </>
  );
}

// ── 1단계: 기본정보 ─────────────────────────────────────
function StepBasic({ value, onNext }: { value: Ctx; onNext: (p: Ctx) => void }) {
  const [age, setAge] = useState(value.age ?? 30);
  const [incomeTypeUI, setIncomeTypeUI] = useState<IncomeTypeUI>(value.incomeTypeUI ?? "employee");
  const [incomeMan, setIncomeMan] = useState(value.incomeMan ?? 5000);
  const [monthlyMan, setMonthlyMan] = useState(value.monthlyMan ?? 50);
  const [horizonYears, setHorizonYears] = useState(value.horizonYears ?? 3);
  const noIncome = incomeTypeUI === "none";
  const valid = age > 0 && monthlyMan > 0 && horizonYears > 0 && (noIncome || incomeMan > 0);

  return (
    <StepShell
      step={1}
      title="기본 정보를 알려주세요"
      subtitle="딱 필요한 것만 — 나머지는 다음에 더 정확하게."
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
      {!noIncome && (
        <NumberField
          label={incomeTypeUI === "employee" ? "연소득 (총급여)" : "연소득 (종합소득)"}
          value={incomeMan}
          onChange={setIncomeMan}
          suffix="만원"
        />
      )}
      <NumberField
        label="월 투자가능액"
        value={monthlyMan}
        onChange={setMonthlyMan}
        suffix="만원"
      />
      <NumberField
        label="이 돈, 언제 쓸 건가요"
        value={horizonYears}
        onChange={setHorizonYears}
        suffix="년 뒤"
      />
    </StepShell>
  );
}

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
        {hasPension && (
          <div className="ml-6 mt-2">
            <NumberField
              label="올해 납입액 (한도 600)"
              value={pensionContributionMan}
              onChange={setPension}
              suffix="만원"
            />
          </div>
        )}
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
        {hasIrp && (
          <div className="ml-6 mt-2">
            <NumberField
              label="올해 납입액 (합산 900)"
              value={irpContributionMan}
              onChange={setIrp}
              suffix="만원"
            />
          </div>
        )}
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
      title="해외주식을 보유하고 있나요?"
      subtitle="보유 중이면 RIA 감면·분산매도·증여 전략을 검토해드려요."
      primaryLabel="다음"
      onSkip={onSkip}
      onPrimary={() => onNext({ hasOverseas, overseasValueMan, overseasCostMan })}
    >
      <CheckRow label="해외주식 보유 중" checked={hasOverseas} onChange={setHasOverseas} />
      {hasOverseas && (
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
      )}
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
      title="소득과 가족 상황은요?"
      subtitle="금융소득 과세·증여·고배당 전략에 쓰여요."
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
      {hasChildren && (
        <div className="ml-6">
          <CheckRow label="미성년 자녀 포함" checked={hasMinorChildren} onChange={setMinor} />
        </div>
      )}
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
        <StepBasic value={context} onNext={(p) => history.push("accounts", { ...context, ...p })} />
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
