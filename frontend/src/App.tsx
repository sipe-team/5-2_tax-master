import { useMemo, useState } from "react";
import { ruleSet } from "./rules/products";
import type { IncomeType, ProductCategory, UserProfile } from "./rules/schema";
import { recommend } from "./engine";
import type { Allocation, Badge, UrgentAction } from "./engine";
import { EventsPanel, FreelanceJobsPanel, RelatedJobsPanel } from "./rocketpunch/widgets";

/** productId → 상품 카테고리 (워터폴→채용 매칭용). */
const CATEGORY_BY_ID: Record<string, ProductCategory> = Object.fromEntries(
  ruleSet.products.map((p) => [p.id, p.category]),
);

const todayISO = () => new Date().toISOString().slice(0, 10);
const won = (n: number) => `${Math.round(n / 10_000).toLocaleString()}만`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

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

const inputCls =
  "w-full bg-transparent border-b border-line pb-1 font-display text-lg tnum text-ink outline-none transition-colors focus:border-gold placeholder:text-locked";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-[11px] tracking-wide text-muted">{label}</span>
      <span className="flex items-baseline gap-1.5">{children}</span>
    </label>
  );
}

type NumberInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: number;
  onChange: (n: number) => void;
};

function NumberInput({ value, onChange, ...rest }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value ? String(value) : "");
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={shown}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
        setDraft(cleaned);
        onChange(cleaned === "" ? 0 : Number(cleaned));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function UrgentCard({ u }: { u: UrgentAction }) {
  return (
    <div className="border-l-2 border-clay pl-4">
      <div className="flex items-baseline justify-between gap-3">
        <strong className="text-[15px]">{u.name}</strong>
        <span
          className={`font-display tnum text-sm font-700 ${u.dDay <= 14 ? "text-clay" : "text-muted"}`}
        >
          D-{u.dDay}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-muted">{u.description}</p>
      {u.estimatedBenefit != null && (
        <p className="mt-1 text-[13px]">
          예상 절감{" "}
          <span className="font-display tnum font-600 text-gold">{won(u.estimatedBenefit)}원</span>
        </p>
      )}
      <p className="mt-1 text-[11px] text-locked tnum">마감 {u.deadline}</p>
      <Badges items={u.badges} />
    </div>
  );
}

function Vessel({ a, rank }: { a: Allocation; rank: number }) {
  const ratio =
    a.annualCap > 0 && isFinite(a.annualCap) ? Math.min(1, a.annualAmount / a.annualCap) : 1;
  return (
    <li className="relative grid grid-cols-[2rem_1fr] gap-4 pb-7 last:pb-0">
      <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface font-display text-sm font-600 text-gold tnum ring-1 ring-gold/40">
        {rank}
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <strong className="text-[15px]">{a.name}</strong>
          <div className="text-right">
            <span className="font-display tnum text-lg font-600">{won(a.monthlyAmount)}</span>
            <span className="text-xs text-muted">원/월</span>
          </div>
        </div>

        {/* 한도까지 차오르는 액체 */}
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
        <Badges items={a.badges} />
      </div>
    </li>
  );
}

export default function App() {
  const [age, setAge] = useState(30);
  const [incomeType, setIncomeType] = useState<IncomeType>("earned");
  const [incomeMan, setIncomeMan] = useState(5000);
  const [monthlyMan, setMonthlyMan] = useState(50);
  const [horizonYears, setHorizonYears] = useState(3);

  const [showMore, setShowMore] = useState(false);
  const [householdMedianPct, setHouseholdMedianPct] = useState<number | "">("");
  const [financeTop, setFinanceTop] = useState<"unknown" | "yes" | "no">("unknown");
  const [hasOverseas, setHasOverseas] = useState(false);
  const [overseasValueMan, setOverseasValueMan] = useState(5000);
  const [overseasCostMan, setOverseasCostMan] = useState(500);

  const profile: UserProfile = useMemo(
    () => ({
      age,
      incomeType,
      income: incomeMan * 10_000,
      monthlyInvestable: monthlyMan * 10_000,
      horizonYears,
      asOf: todayISO(),
      householdMedianPct: householdMedianPct === "" ? undefined : householdMedianPct,
      isFinanceTopTaxpayer: financeTop === "unknown" ? undefined : financeTop === "yes",
      overseasHoldings: hasOverseas
        ? { marketValue: overseasValueMan * 10_000, costBasis: overseasCostMan * 10_000 }
        : undefined,
    }),
    [
      age,
      incomeType,
      incomeMan,
      monthlyMan,
      horizonYears,
      householdMedianPct,
      financeTop,
      hasOverseas,
      overseasValueMan,
      overseasCostMan,
    ],
  );

  const rec = useMemo(() => recommend(profile, ruleSet), [profile]);

  const selectCls =
    "bg-transparent border-b border-line pb-1 font-sans text-[15px] text-ink outline-none focus:border-gold";

  return (
    <div className="mx-auto max-w-[640px] px-5 py-10">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-[11px] tracking-[0.18em] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          재테크 우선순위
        </div>
        <h1 className="text-[28px] font-700 leading-tight tracking-tight">
          당신의 돈, <span className="text-gold">유리한 순서</span>로 흐르게.
        </h1>
        <p className="mt-2 text-[14px] text-muted">
          흩어진 절세 그릇을 한도까지 차례로 채우고, 지금 마감되는 기회를 먼저 잡으세요.
        </p>
      </header>

      {/* 흐름의 시작 = 입력 */}
      <section className="mb-7 rounded-2xl bg-surface p-5 ring-1 ring-line">
        <div className="flex flex-wrap gap-x-5 gap-y-4">
          <Field label="나이">
            <NumberInput className={inputCls} value={age} onChange={setAge} />
            <span className="text-xs text-muted">세</span>
          </Field>
          <Field label="연소득">
            <select
              className={selectCls}
              value={incomeType}
              onChange={(e) => setIncomeType(e.target.value as IncomeType)}
            >
              <option value="earned">직장인</option>
              <option value="comprehensive">사업·기타</option>
            </select>
            <NumberInput
              className={`${inputCls} max-w-[6rem]`}
              value={incomeMan}
              onChange={setIncomeMan}
            />
            <span className="text-xs text-muted">만원</span>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-4">
          <Field label="월 투자가능액">
            <NumberInput className={inputCls} value={monthlyMan} onChange={setMonthlyMan} />
            <span className="text-xs text-muted">만원</span>
          </Field>
          <Field label="언제 쓸 돈인가요">
            <NumberInput className={inputCls} value={horizonYears} onChange={setHorizonYears} />
            <span className="text-xs text-muted">년 뒤</span>
          </Field>
        </div>

        <button
          className="mt-4 text-[13px] text-gold outline-none hover:underline focus-visible:underline"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "− 추가 입력 접기" : "+ 더 정확하게 (선택)"}
        </button>

        {showMore && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="flex flex-wrap gap-x-5 gap-y-4">
              <Field label="가구중위소득">
                <NumberInput
                  className={inputCls}
                  placeholder="모름"
                  value={householdMedianPct === "" ? 0 : householdMedianPct}
                  onChange={(n) => setHouseholdMedianPct(n === 0 ? "" : n)}
                />
                <span className="text-xs text-muted">%</span>
              </Field>
              <Field label="금융소득종합과세 대상">
                <select
                  className={selectCls}
                  value={financeTop}
                  onChange={(e) => setFinanceTop(e.target.value as typeof financeTop)}
                >
                  <option value="unknown">모름</option>
                  <option value="no">아니오</option>
                  <option value="yes">예</option>
                </select>
              </Field>
            </div>
            <label className="mt-4 flex items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                className="accent-gold"
                checked={hasOverseas}
                onChange={(e) => setHasOverseas(e.target.checked)}
              />
              보유 해외주식 있음 <span className="text-muted">(RIA 감면 검토)</span>
            </label>
            {hasOverseas && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-4">
                <Field label="평가액">
                  <NumberInput
                    className={inputCls}
                    value={overseasValueMan}
                    onChange={setOverseasValueMan}
                  />
                  <span className="text-xs text-muted">만원</span>
                </Field>
                <Field label="취득가">
                  <NumberInput
                    className={inputCls}
                    value={overseasCostMan}
                    onChange={setOverseasCostMan}
                  />
                  <span className="text-xs text-muted">만원</span>
                </Field>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 지금 당장 (긴급 트랙) */}
      {rec.urgent.length > 0 && (
        <section className="mb-7 rounded-2xl bg-surface p-5 ring-1 ring-clay/30">
          <h2 className="mb-4 flex items-center gap-2 text-[13px] font-600 tracking-wide text-clay">
            지금 흘려보낼 곳 · 마감 임박
          </h2>
          <div className="flex flex-col gap-4">
            {rec.urgent.map((u) => (
              <UrgentCard key={u.productId} u={u} />
            ))}
          </div>
        </section>
      )}

      {/* 워터폴 (흐름) */}
      <section className="mb-7">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-[13px] font-600 tracking-wide text-muted">매달 적립 흐름</h2>
          <span className="font-display tnum text-sm text-muted">
            월 {won(profile.monthlyInvestable)}원
          </span>
        </div>

        {rec.waterfall.length === 0 ? (
          <p className="text-[14px] text-muted">
            조건에 맞는 절세 그릇이 없어요. 입력을 조정해 보세요.
          </p>
        ) : (
          <ol className="relative">
            <div
              className="absolute bottom-3 left-4 top-3 w-px -translate-x-1/2 bg-line"
              aria-hidden
            />
            {rec.waterfall.map((a, i) => (
              <Vessel key={a.productId} a={a} rank={i + 1} />
            ))}
          </ol>
        )}

        {rec.leftoverMonthly > 0 && (
          <div className="mt-1 grid grid-cols-[2rem_1fr] gap-4">
            <div className="flex justify-center text-locked">↓</div>
            <p className="text-[13px] text-muted">
              남는 <span className="font-display tnum">{won(rec.leftoverMonthly)}원</span>/월은
              일반계좌로 — 더 채울 절세 그릇이 없어요.
            </p>
          </div>
        )}
      </section>

      {/* ── 로켓펀치 연동 (Read 전용 부가 패널) ── */}

      {/* D: 최상위 추천 그릇과 관련된 회사/채용 */}
      {rec.waterfall.length > 0 && CATEGORY_BY_ID[rec.waterfall[0].productId] && (
        <RelatedJobsPanel category={CATEGORY_BY_ID[rec.waterfall[0].productId]} />
      )}

      {/* C: 사업·기타 소득자에게만 외주/계약 일감 */}
      {incomeType === "comprehensive" && <FreelanceJobsPanel />}

      {/* B: 재테크/비즈니스 이벤트 (마감 임박순) */}
      <EventsPanel asOf={profile.asOf} />

      {/* 가정·제외 */}
      {rec.assumptions.length > 0 && (
        <section className="mb-7 rounded-2xl bg-surface/60 p-5 ring-1 ring-line">
          <h3 className="mb-2 text-[12px] tracking-wide text-muted">가정 · 제외</h3>
          <Badges items={rec.assumptions} />
        </section>
      )}

      <footer className="border-t border-line pt-5 text-[12px] leading-relaxed text-muted">
        {rec.disclaimers.map((d, i) => (
          <p key={i}>※ {d}</p>
        ))}
        <p className="mt-2 text-locked">규칙 기준: {ruleSet.asOfLabel}</p>
      </footer>
    </div>
  );
}
