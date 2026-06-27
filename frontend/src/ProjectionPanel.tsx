import { useMemo, useState } from "react";
import type { RuleSet, UserProfile } from "./rules/schema";
import { monthsToReach, projectWealth, type Recommendation } from "./engine";

const won = (n: number) => `${Math.round(n / 10_000).toLocaleString()}만`;

function monthsLabel(months: number): string {
  if (!isFinite(months)) return "—";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}개월`;
  if (m === 0) return `${y}년`;
  return `${y}년 ${m}개월`;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`mt-1 font-sans font-semibold tracking-[-0.3px] tnum text-lg ${accent ? "text-gold" : "text-ink"}`}>
        {value}
        <span className="text-xs text-muted">원</span>
      </div>
    </div>
  );
}

export default function ProjectionPanel({
  profile,
  rec,
  rules,
}: {
  profile: UserProfile;
  rec: Recommendation;
  rules: RuleSet;
}) {
  const [returnStr, setReturnStr] = useState("6");
  const returnPct = Number(returnStr) || 0;
  const proj = useMemo(
    () => projectWealth(rec, profile, rules, returnPct / 100),
    [rec, profile, rules, returnPct],
  );
  const [targetMan, setTargetMan] = useState<number>(10000);
  const rateLabel = returnStr === "" ? "0" : returnStr;

  const reach = useMemo(
    () => monthsToReach(targetMan * 10_000, profile.monthlyInvestable, proj.annualReturnRate),
    [targetMan, profile.monthlyInvestable, proj.annualReturnRate],
  );

  if (profile.monthlyInvestable <= 0) return null;

  return (
    <section className="mb-7 rounded-2xl bg-surface p-5 ring-1 ring-line">
      <h2 className="text-[13px] font-600 tracking-wide text-muted">이대로 모으면 — 자산 시뮬레이션</h2>

      <p className="mt-3 text-[14px]">
        <span className="text-muted">{proj.horizonYears}년 뒤 예상 자산</span>{" "}
        <span className="font-display tnum text-2xl font-700 text-gold">
          {won(proj.projectedBalance)}
        </span>
        <span className="text-sm text-muted">원</span>
      </p>

      {/* 가정 수익률 직접 입력 */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-muted">가정 수익률</span>
        <input
          type="text"
          inputMode="decimal"
          className="w-16 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-base font-medium tracking-[-0.3px] tnum text-gray800 outline-none transition-colors focus:border-gold"
          value={returnStr}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
            setReturnStr(cleaned);
          }}
        />
        <span className="text-muted">% / 년</span>
        <span className="text-[11px] text-locked">(기본 6%)</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="원금 누계" value={won(proj.totalContributed)} />
        <Stat label={`투자 수익 (가정 ${rateLabel}%)`} value={won(proj.growth)} />
        <Stat label="절세 누계" value={won(proj.cumulativeTaxBenefit)} accent />
      </div>

      {proj.annualTaxBenefit > 0 && (
        <div className="mt-3 rounded-xl border-l-2 border-gold bg-gold/5 p-3 text-[13px]">
          절세 환급(연 <span className="font-display tnum text-gold">{won(proj.annualTaxBenefit)}원</span>)을
          다시 모으면 매달 <span className="font-display tnum text-gold">+{won(proj.monthlyTaxBenefit)}원</span>{" "}
          저축 여력이 생겨요. 절세분까지 재투자하면 {proj.horizonYears}년 뒤{" "}
          <span className="font-display tnum text-gold">{won(proj.balanceWithReinvestedTaxBenefit)}원</span>.
        </div>
      )}

      {/* 마일스톤 */}
      {proj.schedule.length > 1 && (
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
          {proj.schedule.map((p) => (
            <li key={p.year} className="text-[12px] text-muted tnum">
              <span className="text-ink">{p.year}년</span> → {won(p.balance)}원
            </li>
          ))}
        </ul>
      )}

      {/* 목표 금액 역산 */}
      <div className="mt-4 border-t border-line pt-4">
        <label className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
          <span className="text-muted">목표</span>
          <input
            type="text"
            inputMode="numeric"
            className="w-24 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-base font-medium tracking-[-0.3px] tnum text-gray800 outline-none transition-colors focus:border-gold"
            value={targetMan ? String(targetMan) : ""}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
              setTargetMan(cleaned === "" ? 0 : Number(cleaned));
            }}
          />
          <span className="text-muted">만원까지</span>
          <span className="font-display text-gold">{monthsLabel(reach)}</span>
          <span className="text-muted">
            (월 {won(profile.monthlyInvestable)}원 · {rateLabel}% 가정)
          </span>
        </label>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-locked">
        ※ 연 {rateLabel}% 수익률·매달 적립 가정의 명목 추정치예요. 세전·수수료·물가는
        반영하지 않았고, 절세액은 매년 동일하게 반복된다고 단순 가정했습니다. 실제 수익률은 시장에 따라 다릅니다.
      </p>
    </section>
  );
}
