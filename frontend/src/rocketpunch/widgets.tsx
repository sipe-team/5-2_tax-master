/**
 * 로켓펀치 연동 위젯 (Read 전용). 메인 절세 엔진과 분리된 결과화면 부가 패널.
 * - B: FINANCE 이벤트 패널 (긴급 트랙과 같은 D-day 시각언어)
 * - D: 워터폴 상품 → 관련 채용/회사 매칭
 * - C: 사업자(종합소득) 전용 외주/계약 일감
 * API 실패 시 위젯은 조용히 숨겨져 메인 엔진에 영향 0.
 */
import { fetchAllEvents, fetchJobs } from "./client";
import { dDay, jobKeywordForCategory, selectFinanceEvents } from "./select";
import type { ProductCategory } from "../rules/schema";
import type { RpEvent, RpJob } from "./types";
import { useAsync } from "./useAsync";

const sectionCls = "mb-7 rounded-2xl bg-surface p-5 ring-1 ring-line";
const headCls = "mb-4 flex items-center gap-2 text-[13px] font-600 tracking-wide text-muted";
const RP_NOTE = (
  <p className="mt-4 text-[11px] text-locked">데이터 제공: 로켓펀치 Open API</p>
);

function Loading() {
  return <p className="text-[13px] text-muted">불러오는 중…</p>;
}

/** ── B. FINANCE 이벤트 패널 ───────────────────────────── */
export function EventsPanel({ asOf }: { asOf: string }) {
  const { loading, data, error } = useAsync(() => fetchAllEvents(), []);
  if (error) return null; // 부가기능 → 실패 시 숨김
  const events = data ? selectFinanceEvents(data.items, asOf) : [];
  if (!loading && events.length === 0) return null;

  return (
    <section className={sectionCls}>
      <h2 className={headCls}>절세하며 커리어도 · 재테크/비즈니스 이벤트</h2>
      {loading ? (
        <Loading />
      ) : (
        <ul className="flex flex-col gap-4">
          {events.map((e) => (
            <EventRow key={e.eventId} e={e} asOf={asOf} />
          ))}
        </ul>
      )}
      {RP_NOTE}
    </section>
  );
}

function EventRow({ e, asOf }: { e: RpEvent; asOf: string }) {
  const d = dDay(asOf, e.endAt);
  return (
    <li className="border-l-2 border-line pl-4">
      <a href={e.webUrl} target="_blank" rel="noopener noreferrer" className="group">
        <div className="flex items-baseline justify-between gap-3">
          <strong className="text-[15px] group-hover:text-gold">{e.eventName}</strong>
          {d != null && d >= 0 && (
            <span className={`font-display tnum text-sm font-700 ${d <= 14 ? "text-clay" : "text-muted"}`}>
              D-{d}
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] text-muted">
          {[e.eventOpenType === "ONLINE" ? "온라인" : "오프라인", e.location?.region, ...e.eventSubjects]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {e.endAt && <p className="mt-1 text-[11px] text-locked tnum">마감 {e.endAt.slice(0, 10)}</p>}
      </a>
    </li>
  );
}

/** ── D. 워터폴 상품 → 관련 채용 매칭 ──────────────────── */
export function RelatedJobsPanel({ category }: { category: ProductCategory }) {
  const keyword = jobKeywordForCategory(category);
  const { loading, data, error } = useAsync(() => fetchJobs({ keyword, pageSize: 4 }), [keyword]);
  if (error) return null;
  const jobs = data?.items ?? [];
  if (!loading && jobs.length === 0) return null;

  return (
    <section className={sectionCls}>
      <h2 className={headCls}>이 분야에서 일하는 회사 · “{keyword}” 채용</h2>
      {loading ? <Loading /> : <JobList jobs={jobs} />}
      {RP_NOTE}
    </section>
  );
}

/** ── C. 사업자 전용 외주/계약 일감 ────────────────────── */
export function FreelanceJobsPanel() {
  // 외주/계약 위주: COMMISSIONED(위촉) + 키워드.
  const { loading, data, error } = useAsync(
    () => fetchJobs({ keyword: "외주", employmentTypes: "COMMISSIONED", pageSize: 4 }),
    [],
  );
  if (error) return null;
  const jobs = data?.items ?? [];
  if (!loading && jobs.length === 0) return null;

  return (
    <section className={sectionCls}>
      <h2 className={headCls}>다음 소득원 둘러보기 · 외주/계약 일감</h2>
      {loading ? <Loading /> : <JobList jobs={jobs} />}
      {RP_NOTE}
    </section>
  );
}

function JobList({ jobs }: { jobs: RpJob[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {jobs.map((j) => (
        <li key={j.jobId}>
          <a
            href={j.webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3"
          >
            {j.company.logoUrl ? (
              <img
                src={j.company.logoUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-line"
                loading="lazy"
              />
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-lg bg-line/50" />
            )}
            <div className="min-w-0">
              <strong className="block truncate text-[14px] group-hover:text-gold">{j.title}</strong>
              <span className="text-[12px] text-muted">
                {[j.company.name, j.workType === "REMOTE" ? "원격" : null].filter(Boolean).join(" · ")}
              </span>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
