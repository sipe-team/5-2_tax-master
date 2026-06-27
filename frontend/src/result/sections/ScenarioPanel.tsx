import { useEffect, useMemo, useState } from "react";
import type { IncomeType, UserProfile } from "../../rules/schema";
import { ruleSet } from "../../rules/products";
import { diffScenarios } from "../../engine";
import { companySizeLabel, ProxyError, searchJobs, type JobChip } from "../../data/jobs";
import { salaryGuideFor } from "../../data/salaryGuide";
import { pct, won } from "../../lib/format";

function DeltaArrow({ from, to }: { from: number; to: number }) {
  if (Math.abs(to - from) < 1e-9) return <span className="text-muted">→</span>;
  const up = to > from;
  return <span className={up ? "text-gold" : "text-clay"}>{up ? "↑" : "↓"}</span>;
}

function JobResultChip({ job, onPick }: { job: JobChip; onPick: (j: JobChip) => void }) {
  return (
    <div className="relative rounded-xl border border-line transition-colors hover:border-gold focus-within:border-gold">
      <button
        type="button"
        onClick={() => onPick(job)}
        className="block w-full px-3 py-2 pr-7 text-left text-[12px] outline-none"
      >
        <div className="font-600 text-ink">{job.companyName}</div>
        <div className="text-muted">{job.title}</div>
        <div className="mt-1 text-[11px] text-locked">
          {companySizeLabel(job.companySize)}
          {job.seniority ? ` · ${job.seniority}` : ""}
        </div>
      </button>
      {job.webUrl && (
        <a
          href={job.webUrl}
          target="_blank"
          rel="noreferrer noopener"
          title="로켓펀치에서 공고 보기"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-1.5 top-1.5 text-[12px] text-locked outline-none hover:text-gold"
        >
          ↗
        </a>
      )}
    </div>
  );
}

export default function ScenarioPanel({ profile }: { profile: UserProfile }) {
  const [scenarioMan, setScenarioMan] = useState(() => Math.round(profile.income / 10_000) + 1000);
  // 시나리오 소득 유형은 직장인(총급여)으로 고정.
  const scenarioIncomeType: IncomeType = "earned";
  const [picked, setPicked] = useState<JobChip | null>(null);
  const [salaryHint, setSalaryHint] = useState<string | null>(null);

  // 추천 공고(로켓펀치 인기) — 초기 노출. 프록시 실패 시 조용히 비활성.
  const [recommended, setRecommended] = useState<JobChip[] | null>(null);
  const [recError, setRecError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    searchJobs({ pageSize: 6, sort: "POPULARITY_DESC" })
      .then((page) => alive && setRecommended(page.items))
      .catch((e) => {
        if (!alive) return;
        setRecommended([]);
        setRecError(e instanceof ProxyError ? e.message : "추천 공고를 불러오지 못했어요.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const delta = useMemo(
    () => diffScenarios(profile, scenarioMan * 10_000, ruleSet, scenarioIncomeType),
    [profile, scenarioMan, scenarioIncomeType],
  );

  function pickJob(job: JobChip) {
    setPicked(job);
    const guide = salaryGuideFor(job.seniority);
    if (guide) {
      setScenarioMan(guide.mid);
      setSalaryHint(
        `추정 범위 ${guide.min.toLocaleString()}~${guide.max.toLocaleString()}만 (${job.seniority}). 직접 조정하세요.`,
      );
    } else {
      setSalaryHint("이 공고는 숙련도 정보가 없어 추정 범위를 제안할 수 없어요.");
    }
  }

  const shiftById = useMemo(
    () => new Map((delta?.shifts ?? []).map((s) => [s.productId, s])),
    [delta],
  );

  // 10년 누적 절세 증감 (현재 연봉 vs 가정 연봉).
  // projection.ts 정의와 동일: 첫 해 절세액이 매년 반복된다고 가정(누계 = 연절세 × 연수, 명목값).
  const TEN_YEARS = 10;
  const tenYearFrom = delta.baseFirstYearBenefit * TEN_YEARS;
  const tenYearTo = delta.scenarioFirstYearBenefit * TEN_YEARS;
  const tenYearDiff = delta.netFirstYearBenefitChange * TEN_YEARS;

  return (
    <section className="mb-7 rounded-2xl bg-surface p-5 ring-1 ring-line">
      <h2 className="flex items-center gap-2 text-[13px] font-600 tracking-wide text-gold">
        연봉이 바뀌면, 절세 전략도 바뀌어요
      </h2>

      <div className="mt-5">
        {/* 목표 연봉 입력 */}
        <label className="flex flex-col gap-1">
          <span className="text-[11px] tracking-wide text-muted">가정 연소득 (이직 후)</span>
          <span className="flex items-baseline gap-1.5">
            <input
              type="text"
              inputMode="numeric"
              className="w-28 rounded-lg border border-line bg-surface px-3 py-1.5 text-base font-medium tracking-[-0.3px] tnum text-gray800 outline-none transition-colors focus:border-gold"
              value={scenarioMan ? String(scenarioMan) : ""}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
                setScenarioMan(cleaned === "" ? 0 : Number(cleaned));
                setSalaryHint(null);
              }}
            />
            <span className="text-xs text-muted">만원</span>
            <span className="ml-2 text-[12px] text-muted tnum">
              현재 {Math.round(profile.income / 10_000).toLocaleString()}만 → 가정{" "}
              {scenarioMan.toLocaleString()}만
            </span>
          </span>
        </label>
        {salaryHint && <p className="mt-1.5 text-[11px] text-gold">{salaryHint}</p>}

        {/* 2열 핵심 비교 */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="text-[11px] text-muted">한계세율</div>
            <div className="mt-1 font-sans font-semibold tracking-[-0.3px] tnum text-lg">
              {pct(delta.marginalRateChange.from)}{" "}
              <DeltaArrow from={delta.marginalRateChange.from} to={delta.marginalRateChange.to} />{" "}
              <span className="text-gold">{pct(delta.marginalRateChange.to)}</span>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="text-[11px] text-muted">첫 해 절세(우선순위)</div>
            <div className="mt-1 font-sans font-semibold tracking-[-0.3px] tnum text-lg">
              {won(delta.baseFirstYearBenefit)}{" "}
              <DeltaArrow from={delta.baseFirstYearBenefit} to={delta.scenarioFirstYearBenefit} />{" "}
              <span className="text-gold">{won(delta.scenarioFirstYearBenefit)}</span>
              <span className="text-xs text-muted">원</span>
            </div>
          </div>
        </div>

        {/* 10년 누적 절세 증감 — 연봉 변화가 장기에 누적되는 효과 */}
        <div className="mt-3 rounded-xl border border-line bg-surface p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-muted">10년 누적 절세 (이대로 매년 반복 시)</span>
            {Math.abs(tenYearDiff) >= 10_000 && (
              <span
                className={`font-display tnum text-[12px] font-600 ${
                  tenYearDiff > 0 ? "text-gold" : "text-clay"
                }`}
              >
                {tenYearDiff > 0 ? "+" : "−"}
                {won(Math.abs(tenYearDiff))}원
              </span>
            )}
          </div>
          <div className="mt-1 font-sans font-semibold tracking-[-0.3px] tnum text-lg">
            {won(tenYearFrom)} <DeltaArrow from={tenYearFrom} to={tenYearTo} />{" "}
            <span className="text-gold">{won(tenYearTo)}</span>
            <span className="text-xs text-muted">원</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-locked">
            첫 해 절세액이 10년간 동일하게 반복된다고 가정한 누계예요. 투자 수익률·물가는 빼고
            계산했어요.
          </p>
        </div>

        {/* 공고 (추천 + 검색) */}
        <div className="mt-5 border-t border-line pt-5">
          {/* 추천 공고 — 초기 노출 + 로켓펀치 출처 */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] tracking-wide text-muted">
              목표 연봉을 달성하기 위해 아래 공고를 살펴보세요
            </span>
            <a
              href="https://www.rocketpunch.com/jobs"
              target="_blank"
              rel="noreferrer noopener"
              className="text-[11px] text-gold outline-none hover:underline"
            >
              로켓펀치에서 더 보기 ↗
            </a>
          </div>
          {recError && <p className="mb-2 text-[11px] text-locked">{recError}</p>}
          {recommended === null && !recError && (
            <p className="mb-2 text-[11px] text-locked">추천 공고 불러오는 중…</p>
          )}
          {recommended && recommended.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {recommended.map((j) => (
                <JobResultChip key={`rec-${j.jobId}`} job={j} onPick={pickJob} />
              ))}
            </div>
          )}

          {picked && (
            <div className="mt-3 rounded-xl border border-line bg-surface px-3 py-2 text-[12px]">
              선택: <strong className="text-ink">{picked.companyName}</strong> · {picked.title}
              <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                {companySizeLabel(picked.companySize)}
              </span>
              {picked.webUrl && (
                <a
                  href={picked.webUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="ml-2 text-[11px] text-gold outline-none hover:underline"
                >
                  로켓펀치 ↗
                </a>
              )}
            </div>
          )}
        </div>

        {/* 자격 상실 — 가장 강한 후크 */}
        {delta.lost.length > 0 && (
          <div className="mt-4 rounded-xl border-l-2 border-clay bg-clay/5 p-3">
            <div className="text-[12px] font-600 text-clay">이직하면 자격을 잃어요</div>
            <ul className="mt-1.5">
              {delta.lost.map((id) => (
                <li key={id} className="text-[13px] text-ink">
                  {shiftById.get(id)?.name ?? id}
                  <span className="ml-1 text-[12px] text-muted">
                    지금 가입하지 않으면 이직 후엔 가입할 수 없어요
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 새 자격 */}
        {delta.gained.length > 0 && (
          <div className="mt-3 rounded-xl border-l-2 border-gold bg-gold/5 p-3">
            <div className="text-[12px] font-600 text-gold">새로 가능해지는 계좌</div>
            <ul className="mt-1.5">
              {delta.gained.map((id) => (
                <li key={id} className="text-[13px] text-ink">
                  {shiftById.get(id)?.name ?? id}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
