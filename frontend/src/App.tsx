import { useEffect, useMemo, useRef, useState } from "react";
import { ruleSet } from "./rules/products";
import type { IncomeType, UserProfile } from "./rules/schema";
import { recommend, buildCalendar, downloadCalendar, buildCliffChart, projectGap } from "./engine";
import type { Allocation, Badge, UrgentAction } from "./engine";
import { PERSONAS, type Persona } from "./personas";
import { CliffChartView } from "./CliffChartView";
import { GapChartView } from "./GapChartView";

const todayISO = () => new Date().toISOString().slice(0, 10);
const won = (n: number) => `${Math.round(n / 10_000).toLocaleString()}만`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * 목표값으로 부드럽게 차오르는 카운트업. 결과가 바뀔 때마다 0→N이 아니라
 * 이전값→새값으로 이어져 페르소나 전환 시 숫자가 "굴러가는" 와우모먼트.
 * prefers-reduced-motion이면 애니메이션 없이 target을 그대로 반환(접근성).
 */
function useCountUp(target: number, durationMs = 900): number {
  const reduce = prefersReducedMotion();
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (reduce) return;
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setShown(Math.round(from + (target - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs, reduce]);

  return reduce ? target : shown;
}

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

  function applyPersona(p: Persona) {
    setAge(p.age);
    setIncomeType(p.incomeType);
    setIncomeMan(p.incomeMan);
    setMonthlyMan(p.monthlyMan);
    setHorizonYears(p.horizonYears);
    if (p.overseas) {
      setHasOverseas(true);
      setOverseasValueMan(p.overseas.valueMan);
      setOverseasCostMan(p.overseas.costMan);
      setShowMore(true);
    } else {
      setHasOverseas(false);
    }
  }

  // 활성 페르소나는 저장하지 않고 현재 입력에서 파생 — 수동 편집 시 자동으로 하이라이트 해제(desync 불가).
  const activePersona = useMemo(() => {
    const match = PERSONAS.find(
      (p) =>
        p.age === age &&
        p.incomeType === incomeType &&
        p.incomeMan === incomeMan &&
        p.monthlyMan === monthlyMan &&
        p.horizonYears === horizonYears &&
        !!p.overseas === hasOverseas,
    );
    return match?.id ?? null;
  }, [age, incomeType, incomeMan, monthlyMan, horizonYears, hasOverseas]);

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

  // 헤드라인: 워터폴 첫 해 절세 합계 + 긴급 트랙 일회성 절감(RIA 등).
  const annualBenefit = useMemo(() => {
    const waterfall = rec.waterfall.reduce((s, a) => s + a.firstYearBenefit, 0);
    const urgent = rec.urgent.reduce((s, u) => s + (u.estimatedBenefit ?? 0), 0);
    return waterfall + urgent;
  }, [rec]);
  const shownBenefit = useCountUp(annualBenefit);

  // 연봉 절벽: 룰에서 산출(소득유형별). 사용자 연소득을 겹쳐 표시.
  const cliff = useMemo(() => buildCliffChart(ruleSet, incomeType), [incomeType]);

  // N년 후 격차: 절세계좌 vs 일반계좌 누적 시뮬레이션.
  const projection = useMemo(
    () => projectGap(rec, profile.monthlyInvestable, profile.horizonYears, ruleSet),
    [rec, profile.monthlyInvestable, profile.horizonYears],
  );
  const shownGap = useCountUp(projection.finalGap);

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

      {/* 와우모먼트: 버튼 한 번으로 "내 결과" 즉시 체험 */}
      <section className="mb-7">
        <p className="mb-2.5 text-[12px] tracking-wide text-muted">
          나와 비슷한 사람으로 시작해 보세요 — 버튼 하나면 끝.
        </p>
        <div className="flex flex-wrap gap-2">
          {PERSONAS.map((p) => {
            const on = activePersona === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPersona(p)}
                aria-pressed={on}
                className={`flex flex-col items-start rounded-xl border px-3.5 py-2 text-left outline-none transition-colors focus-visible:border-gold ${
                  on ? "border-gold bg-gold/10" : "border-line hover:border-gold/50"
                }`}
              >
                <span className="text-[14px] font-600">
                  {p.emoji} {p.label}
                </span>
                <span className="text-[11px] text-muted">{p.tagline}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 헤드라인: 차오르는 연간 절세액 */}
      <section className="mb-7 overflow-hidden rounded-2xl bg-gradient-to-br from-gold/10 to-transparent p-6 ring-1 ring-gold/30">
        <div className="text-[12px] tracking-wide text-muted">예상 절세 효과 (첫 해)</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-display text-[44px] font-700 leading-none text-gold tnum">
            {Math.round(shownBenefit / 10_000).toLocaleString()}
          </span>
          <span className="text-lg text-muted">만원</span>
          {annualBenefit > 0 && (
            <span className="ml-auto text-[12px] text-muted">월 {won(profile.monthlyInvestable)}원 적립 기준</span>
          )}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-locked">
          워터폴 첫 해 세제혜택{rec.urgent.some((u) => u.estimatedBenefit) ? " + 마감 임박 일회성 절감" : ""} 합산.
          아래에서 어떤 그릇에 얼마씩, 무엇이 급한지 확인하세요.
        </p>
      </section>

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
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-[13px] font-600 tracking-wide text-clay">
              지금 흘려보낼 곳 · 마감 임박
            </h2>
            <button
              type="button"
              onClick={() => downloadCalendar(buildCalendar(rec.urgent, rec.asOf))}
              className="shrink-0 rounded-full border border-clay/40 px-3 py-1 text-[12px] text-clay outline-none transition-colors hover:bg-clay/10 focus-visible:bg-clay/10"
              title="마감일을 캘린더(.ics)로 내보내 D-7 알림을 받으세요"
            >
              📅 캘린더에 추가
            </button>
          </div>
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

      {/* 연봉 절벽 (와우모먼트): 룰에 박힌 숨은 절벽 */}
      {cliff && cliff.markers.length > 0 && (
        <section className="mb-7 rounded-2xl bg-surface p-5 ring-1 ring-line">
          <h2 className="text-[18px] font-700 leading-tight">
            연봉이 이 선을 넘으면, <span className="text-clay">절세액이 떨어집니다</span>
          </h2>
          <p className="mt-1 text-[12px] text-muted">
            아무도 안 알려주는 ‘숨은 절벽’ — 연봉 한 끗 차이로 혜택이 끊깁니다
            <span className="text-locked"> ({won(cliff.assumedContribution)}원 납입 기준)</span>
          </p>

          <div className="mt-4">
            <CliffChartView chart={cliff} currentIncome={profile.income} />
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {cliff.markers.map((m) => (
              <div
                key={`${m.income}-${m.label}`}
                className={`rounded-xl border-l-2 bg-surface/60 py-2 pl-3 pr-3 ${m.delta < 0 ? "border-clay" : "border-gold"}`}
              >
                <div className="text-[13px] font-600">📍 {m.label}</div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-muted">{m.detail}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-locked">
            ※ 그래프는 {ruleSet.asOfLabel} 법령 경계를 그대로 표시합니다. 정보 제공 목적이며 자문이 아닙니다.
          </p>
        </section>
      )}

      {/* N년 후 격차 (와우모먼트): 절세계좌 vs 일반계좌 */}
      {projection.finalGap > 0 && (
        <section className="mb-7 rounded-2xl bg-surface p-5 ring-1 ring-line">
          <h2 className="text-[18px] font-700 leading-tight">
            {projection.horizonYears}년 후, <span className="text-gold">{won(shownGap)}원</span> 차이가 납니다
          </h2>
          <p className="mt-1 text-[12px] text-muted">
            같은 돈을 일반계좌에 둘 때 vs 절세 그릇에 담을 때 — 시간이 갈수록 벌어집니다
            <span className="text-locked"> (연 {pct(projection.returnRate)} 수익 가정, 양쪽 동일)</span>
          </p>

          <div className="mt-4">
            <GapChartView proj={projection} />
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-locked">
            ※ 차이는 오직 ‘세금’에서만 발생하도록 계산했습니다(수익률 우위 가정 없음). 운용 단계 누적의 근사치이며
            연금 수령 시 과세·중도해지 페널티는 미반영입니다. 정보 제공 목적이며 자문이 아닙니다.
          </p>
        </section>
      )}

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
