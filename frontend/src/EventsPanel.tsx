import { useEffect, useState } from "react";
import { type EventChip, fetchEvents, selectFinanceEvents } from "./data/events";

/** 기준일로부터 남은 일수(음수=지남). */
function dDay(fromISO: string, toISO?: string): number | undefined {
  if (!toISO) return undefined;
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}

function EventRow({ e, asOf }: { e: EventChip; asOf: string }) {
  const d = dDay(asOf, e.endAt);
  const meta = [e.eventOpenType === "ONLINE" ? "온라인" : "오프라인", e.region, ...e.eventSubjects]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="border-l-2 border-line pl-4">
      <a href={e.webUrl} target="_blank" rel="noopener noreferrer" className="group">
        <div className="flex items-baseline justify-between gap-3">
          <strong className="text-[15px] group-hover:text-gold">{e.eventName}</strong>
          {d != null && d >= 0 && (
            <span
              className={`font-display tnum text-sm font-700 ${d <= 14 ? "text-clay" : "text-muted"}`}
            >
              D-{d}
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] text-muted">{meta}</p>
        {e.endAt && <p className="mt-1 text-[11px] text-locked tnum">마감 {e.endAt.slice(0, 10)}</p>}
      </a>
    </li>
  );
}

/**
 * 재테크/비즈니스 이벤트 패널 (Read 전용 부가 패널).
 * 긴급 트랙과 같은 D-day 시각언어로 "절세하며 커리어도" 후크를 제공.
 * 데이터 없거나 실패 시 조용히 숨겨 메인 기능에 영향 0.
 */
export default function EventsPanel({ asOf }: { asOf: string }) {
  const [events, setEvents] = useState<EventChip[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchEvents()
      .then((page) => alive && setEvents(selectFinanceEvents(page.items, asOf)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [asOf]);

  if (failed) return null;
  if (events && events.length === 0) return null;

  return (
    <section className="mb-7 rounded-2xl bg-surface p-5 ring-1 ring-line">
      <h2 className="flex items-center gap-2 text-[13px] font-600 tracking-wide text-gold">
        절세하며 커리어도 · 재테크/비즈니스 이벤트
      </h2>
      {events === null ? (
        <p className="mt-4 text-[13px] text-muted">불러오는 중…</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {events.map((e) => (
            <EventRow key={e.eventId} e={e} asOf={asOf} />
          ))}
        </ul>
      )}
      <p className="mt-4 text-[11px] text-locked">데이터 제공: 로켓펀치 Open API</p>
    </section>
  );
}
