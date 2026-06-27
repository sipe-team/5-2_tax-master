import { useEffect, useMemo, useState } from "react";
import type { IncomeType, RuleSet, UserProfile } from "./rules/schema";
import { diffScenarios, type ProductShift } from "./engine";
import {
  companySizeLabel,
  inferIncomeType,
  ProxyError,
  searchJobs,
  type JobChip,
} from "./data/jobs";
import { salaryGuideFor, SALARY_GUIDE_NOTE } from "./data/salaryGuide";

const won = (n: number) => `${Math.round(n / 10_000).toLocaleString()}만`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function DeltaArrow({ from, to }: { from: number; to: number }) {
  if (Math.abs(to - from) < 1e-9) return <span className="text-muted">→</span>;
  const up = to > from;
  return <span className={up ? "text-gold" : "text-clay"}>{up ? "↑" : "↓"}</span>;
}

function ChangedRow({ s }: { s: ProductShift }) {
  const f = s.fromEfficiency;
  const t = s.toEfficiency;
  return (
    <li className="flex items-baseline justify-between gap-3 py-1 text-[13px]">
      <span className="text-ink">{s.name}</span>
      {f != null && t != null ? (
        <span className="font-display tnum text-muted">
          효율 {pct(f)} <DeltaArrow from={f} to={t} /> <span className="text-ink">{pct(t)}</span>
        </span>
      ) : (
        <span className="text-muted">등급 변경</span>
      )}
    </li>
  );
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

export default function ScenarioPanel({
  profile,
  rules,
}: {
  profile: UserProfile;
  rules: RuleSet;
}) {
  const [scenarioMan, setScenarioMan] = useState(() => Math.round(profile.income / 10_000) + 1000);
  const [scenarioIncomeType, setScenarioIncomeType] = useState<IncomeType>(profile.incomeType);
  const [incomeTypeInferred, setIncomeTypeInferred] = useState(false);

  // 공고 검색(부가 레이어 — 실패해도 수동 입력은 동작).
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<JobChip[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
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
    () => diffScenarios(profile, scenarioMan * 10_000, rules, scenarioIncomeType),
    [profile, scenarioMan, scenarioIncomeType, rules],
  );

  async function runSearch() {
    const kw = keyword.trim();
    if (!kw) return;
    setSearching(true);
    setSearchError(null);
    try {
      const page = await searchJobs({ keyword: kw, pageSize: 8, sort: "RELEVANCE_DESC" });
      setResults(page.items);
      if (page.items.length === 0) setSearchError("검색 결과가 없어요.");
    } catch (e) {
      setResults(null);
      setSearchError(e instanceof ProxyError ? e.message : "검색 중 오류가 발생했어요.");
    } finally {
      setSearching(false);
    }
  }

  function pickJob(job: JobChip) {
    setPicked(job);
    const it = inferIncomeType(job.employmentTypes);
    if (it) {
      setScenarioIncomeType(it);
      setIncomeTypeInferred(true);
    }
    const guide = salaryGuideFor(job.seniority);
    if (guide) {
      setScenarioMan(guide.mid);
      setSalaryHint(
        `추정 레인지 ${guide.min.toLocaleString()}~${guide.max.toLocaleString()}만 (${job.seniority}) — 직접 조정하세요.`,
      );
    } else {
      setSalaryHint("이 공고엔 숙련도 정보가 없어 가이드 레인지를 제안할 수 없어요.");
    }
  }

  const shiftById = useMemo(
    () => new Map((delta?.shifts ?? []).map((s) => [s.productId, s])),
    [delta],
  );
  const changed = (delta?.shifts ?? []).filter((s) => s.status === "changed");

  return (
    <section className="mb-7 rounded-2xl bg-surface p-5 ring-1 ring-line">
      <h2 className="flex items-center gap-2 text-[13px] font-600 tracking-wide text-gold">
        이직 시나리오 — 연봉이 바뀌면 전략은?
      </h2>

      <div className="mt-5">
        {/* 공고 (추천 + 검색) */}
        <div className="mb-5 border-b border-line pb-5">
          {/* 추천 공고 — 초기 노출 + 로켓펀치 출처 */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] tracking-wide text-muted">추천 공고 · 로켓펀치 인기</span>
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

          {/* 직접 검색 */}
          <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[11px] tracking-wide text-muted">또는 직접 검색</span>
              <input
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] text-gray800 outline-none transition-colors focus:border-gold placeholder:text-locked"
                value={keyword}
                placeholder="회사명·직무 키워드"
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
            </label>
            <button
              type="button"
              onClick={runSearch}
              disabled={searching}
              className="rounded-lg border border-gold/50 px-3 py-2 text-[13px] text-gold outline-none hover:bg-gold/10 disabled:opacity-50"
            >
              {searching ? "검색중…" : "검색"}
            </button>
          </div>

          {searchError && <p className="mt-2 text-[12px] text-clay">{searchError}</p>}

          {results && results.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {results.map((j) => (
                <JobResultChip key={j.jobId} job={j} onPick={pickJob} />
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

          <p className="mt-2 text-[11px] leading-relaxed text-locked">※ {SALARY_GUIDE_NOTE}</p>
        </div>

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

        {/* 소득 유형(고용형태 기반) */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted">소득 유형</span>
          <select
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[14px] text-gray800 outline-none transition-colors focus:border-gold"
            value={scenarioIncomeType}
            onChange={(e) => {
              setScenarioIncomeType(e.target.value as IncomeType);
              setIncomeTypeInferred(false);
            }}
          >
            <option value="earned">직장인(총급여)</option>
            <option value="comprehensive">사업·기타(종합소득)</option>
          </select>
          {incomeTypeInferred && (
            <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
              <span className="font-600">가정</span> 공고 고용형태로 추정
            </span>
          )}
          {delta.incomeTypeChanged && (
            <span className="text-[11px] text-gold">
              현재와 소득유형이 달라요 → 공제율·상한 재적용됨
            </span>
          )}
        </div>

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
            <div className="text-[11px] text-muted">첫 해 절세(워터폴)</div>
            <div className="mt-1 font-sans font-semibold tracking-[-0.3px] tnum text-lg">
              {won(delta.baseFirstYearBenefit)}{" "}
              <DeltaArrow from={delta.baseFirstYearBenefit} to={delta.scenarioFirstYearBenefit} />{" "}
              <span className="text-gold">{won(delta.scenarioFirstYearBenefit)}</span>
              <span className="text-xs text-muted">원</span>
            </div>
          </div>
        </div>

        {/* 한계세율 설명 */}
        <p className="mt-2 text-[11px] leading-relaxed text-locked">
          ※ <span className="text-muted">한계세율</span>은 소득이 1원 더 늘 때 그 추가분에 붙는
          세율(지방소득세 포함)이에요. 연봉이 오르면 세율 구간이 올라가{" "}
          <span className="text-muted">연금·ISA 소득공제로 돌려받는 금액(효율)은 커지지만</span>,
          청년상품의 소득상한을 넘으면 <span className="text-muted">자격 자체를 잃을 수</span>{" "}
          있어요.
        </p>

        {/* 자격 상실 — 가장 강한 후크 */}
        {delta.lost.length > 0 && (
          <div className="mt-4 rounded-xl border-l-2 border-clay bg-clay/5 p-3">
            <div className="text-[12px] font-600 text-clay">⚠ 이직하면 자격을 잃어요</div>
            <ul className="mt-1.5">
              {delta.lost.map((id) => (
                <li key={id} className="text-[13px] text-ink">
                  {shiftById.get(id)?.name ?? id}
                  <span className="ml-1 text-[12px] text-muted">
                    — 지금 가입 안 하면 이직 후 가입 불가
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 새 자격 */}
        {delta.gained.length > 0 && (
          <div className="mt-3 rounded-xl border-l-2 border-gold bg-gold/5 p-3">
            <div className="text-[12px] font-600 text-gold">+ 새로 가능해지는 그릇</div>
            <ul className="mt-1.5">
              {delta.gained.map((id) => (
                <li key={id} className="text-[13px] text-ink">
                  {shiftById.get(id)?.name ?? id}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 효율/등급 변화 */}
        {changed.length > 0 && (
          <div className="mt-3 border-t border-line pt-3">
            <div className="mb-1 text-[12px] text-muted">효율·등급 변화</div>
            <ul>
              {changed.map((s) => (
                <ChangedRow key={s.productId} s={s} />
              ))}
            </ul>
          </div>
        )}

        {delta.lost.length === 0 && delta.gained.length === 0 && changed.length === 0 && (
          <p className="mt-4 text-[13px] text-muted">
            이 연봉 변화로는 자격·효율이 크게 달라지지 않아요.
          </p>
        )}
      </div>
    </section>
  );
}
