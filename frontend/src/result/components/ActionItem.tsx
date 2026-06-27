import type { ActionCard } from "../../engine";
import { googleCalendarUrl } from "../../engine";
import { won } from "../../lib/format";
import { Badges } from "./Badges";

// "지금 할 일·전략" 한 장 — 박스 카드(funnel 인풋과 같은 톤) + D-day 배지 + 예상 절감 + 캘린더 링크
export function ActionItem({ a }: { a: ActionCard }) {
  const isImmediate = a.urgency === "immediate";
  const calUrl = googleCalendarUrl(a);
  return (
    <div
      className={`rounded-lg border bg-surface p-5 ${
        isImmediate ? "border-clay/40" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <strong className="text-[16px] font-semibold leading-7 tracking-[-0.3px] text-gray800">
          {a.name}
        </strong>
        {a.dDay != null ? (
          <span
            className={`shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold tnum tracking-[-0.3px] ${
              a.dDay <= 14 ? "bg-clay/10 text-clay" : "bg-gray100 text-muted"
            }`}
          >
            D-{a.dDay}
          </span>
        ) : (
          <span className="shrink-0 text-[16px] font-medium leading-7 tracking-[-0.3px] text-muted">
            {a.category}
          </span>
        )}
      </div>
      <p className="mt-3 text-[16px] font-medium leading-7 tracking-[-0.3px] text-muted">
        {a.reason}
      </p>
      <p className="mt-1 text-[16px] font-medium leading-7 tracking-[-0.3px] text-gray800">
        {a.action}
      </p>
      {a.estimatedBenefit != null && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-primary-light px-3 py-2.5">
          <span className="text-[16px] font-semibold leading-7 tracking-[-0.3px] text-gray800">
            예상 절감
          </span>
          <span className="tnum text-[16px] font-semibold leading-7 tracking-[-0.3px] text-gold">
            {won(a.estimatedBenefit)}원
          </span>
        </div>
      )}
      {a.warning && (
        <p className="mt-2 rounded-md bg-clay/5 px-3 py-2 text-[16px] font-medium leading-7 tracking-[-0.3px] text-clay">
          ⚠ {a.warning}
        </p>
      )}
      {a.deadline && (
        <p className="mt-2 text-[12px] font-medium tracking-[-0.3px] tnum text-locked">
          마감 {a.deadline}
        </p>
      )}
      {calUrl && (
        <a
          href={calUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-light px-3 py-2.5 text-[13px] font-semibold text-gold outline-none transition-colors hover:brightness-95 focus-visible:brightness-95"
        >
          캘린더에 추가
        </a>
      )}
      <Badges items={a.badges} />
    </div>
  );
}
