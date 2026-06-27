import { won } from "../lib/format";
import type { CliffChart } from "../engine";
import { CliffChartView } from "../CliffChartView";

// 연봉 절벽 (와우모먼트): 룰에 박힌 숨은 절벽
export function CliffSection({
  cliff,
  currentIncome,
}: {
  cliff: CliffChart;
  currentIncome: number;
}) {
  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <h2 className="text-[16px] font-semibold leading-7 tracking-[-0.3px] text-gray800">
        연봉이 이 선을 넘으면, <span className="text-clay">절세액이 떨어집니다</span>
      </h2>
      <p className="mt-1 text-[14px] font-medium leading-5 tracking-[-0.3px] text-muted">
        아무도 안 알려주는 '숨은 절벽' — 연봉 한 끗 차이로 혜택이 끊깁니다
        <span className="text-locked"> ({won(cliff.assumedContribution)}원 납입 기준)</span>
      </p>
      <div className="mt-4">
        <CliffChartView chart={cliff} currentIncome={currentIncome} />
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {cliff.markers.map((m) => (
          <div key={`${m.income}-${m.label}`} className="border-l-2 border-gold/50 pl-3">
            <div className="text-[13px] font-600">{m.label}</div>
            <div className="mt-0.5 text-[12px] leading-relaxed text-muted">{m.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
