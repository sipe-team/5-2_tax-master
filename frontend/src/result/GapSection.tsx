import { won, pct } from "../lib/format";
import type { GapProjection } from "../engine";
import { GapChartView } from "../GapChartView";

// N년 후 격차 (와우모먼트): 절세계좌 vs 일반계좌
export function GapSection({ proj }: { proj: GapProjection }) {
  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <h2 className="text-[16px] font-semibold leading-7 tracking-[-0.3px] text-gray800">
        {proj.horizonYears}년 후, <span className="text-gold">{won(proj.finalGap)}원</span> 차이가
        납니다
      </h2>
      <p className="mt-1 text-[14px] font-medium leading-5 tracking-[-0.3px] text-muted">
        같은 돈을 일반계좌에 둘 때 vs 절세 계좌에 담을 때 — 시간이 갈수록 벌어집니다
        <span className="text-locked"> (연 {pct(proj.returnRate)} 수익 가정, 양쪽 동일)</span>
      </p>
      <div className="mt-4">
        <GapChartView proj={proj} />
      </div>
    </section>
  );
}
