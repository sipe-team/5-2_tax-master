import type { GapProjection } from "../../engine";
import { won } from "../../lib/format";

/**
 * N년 후 격차 차트 (와우모먼트): 같은 돈을 절세계좌 vs 일반계좌에 넣었을 때
 * 누적 자산이 시간이 갈수록 벌어지는 모습을 면적으로 보여준다.
 * 의존성 없는 SVG. 두 선 사이 격차를 음영으로 채워 "차이"를 강조.
 */

const W = 560;
const H = 220;
const PAD = { top: 18, right: 16, bottom: 26, left: 52 };

export function GapChartView({ proj }: { proj: GapProjection }) {
  const { points, horizonYears } = proj;
  const maxVal = Math.max(...points.map((p) => p.sheltered), 1);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (year: number) => PAD.left + (year / Math.max(1, horizonYears)) * plotW;
  const y = (val: number) => PAD.top + (1 - val / (maxVal * 1.1)) * plotH;

  const line = (key: "taxed" | "sheltered") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  // 두 선 사이 격차 음영(절세 위, 일반 아래).
  const gapArea =
    points.map((p) => `${x(p.year).toFixed(1)},${y(p.sheltered).toFixed(1)}`).join(" ") +
    " " +
    [...points].reverse().map((p) => `${x(p.year).toFixed(1)},${y(p.taxed).toFixed(1)}`).join(" ");

  const yTicks = [0, 0.5, 1].map((t) => Math.round(maxVal * 1.1 * t));
  const xTicks = Array.from(new Set([0, Math.round(horizonYears / 2), horizonYears]));

  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${horizonYears}년 후 절세계좌와 일반계좌 자산 격차`}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} className="stroke-line/60" strokeWidth={1} />
          <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" className="fill-muted" fontSize={10}>
            {won(v)}
          </text>
        </g>
      ))}
      {xTicks.map((yr) => (
        <text key={yr} x={x(yr)} y={H - 8} textAnchor="middle" className="fill-muted" fontSize={10}>
          {yr === 0 ? "지금" : `${yr}년 후`}
        </text>
      ))}

      {/* 격차 음영 */}
      <polygon points={gapArea} className="fill-gold/15" />

      {/* 일반계좌 (아래, 점선 회색) */}
      <path d={line("taxed")} fill="none" className="stroke-muted" strokeWidth={2} strokeDasharray="4 3" />
      {/* 절세계좌 (위, 골드 실선) */}
      <path d={line("sheltered")} fill="none" className="stroke-gold" strokeWidth={2.5} strokeLinejoin="round" />

      {/* 끝점 라벨 */}
      <circle cx={x(last.year)} cy={y(last.sheltered)} r={3.5} className="fill-gold" />
      <circle cx={x(last.year)} cy={y(last.taxed)} r={3} className="fill-muted" />
      <text x={x(last.year) - 4} y={y(last.sheltered) - 6} textAnchor="end" className="fill-gold" fontSize={10} fontWeight={700}>
        절세 {won(last.sheltered)}
      </text>
      <text x={x(last.year) - 4} y={y(last.taxed) + 28} textAnchor="end" className="fill-muted" fontSize={10}>
        일반 {won(last.taxed)}
      </text>
    </svg>
  );
}
