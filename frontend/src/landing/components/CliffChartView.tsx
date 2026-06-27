import type { CliffChart } from "../../engine";

/**
 * 연봉 절벽 차트 (와우모먼트): "연봉이 이 선을 넘으면 절세액이 떨어진다."
 * 룰에서 산출한 계단 곡선 + 경계 마커를 의존성 없는 SVG로 그린다.
 * 사용자의 현재 연소득을 세로 점선으로 겹쳐 "당신은 여기" 위치를 표시.
 */

const won = (n: number) => `${Math.round(n / 10_000).toLocaleString()}만`;

const W = 560;
const H = 240;
const PAD = { top: 24, right: 16, bottom: 28, left: 44 };

export function CliffChartView({
  chart,
  currentIncome,
}: {
  chart: CliffChart;
  currentIncome?: number;
}) {
  const { points, markers, minIncome, maxIncome } = chart;
  const maxRefund = Math.max(...points.map((p) => p.refund), 1);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (income: number) =>
    PAD.left + ((income - minIncome) / (maxIncome - minIncome)) * plotW;
  const y = (refund: number) => PAD.top + (1 - refund / (maxRefund * 1.15)) * plotH;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.income).toFixed(1)},${y(p.refund).toFixed(1)}`).join(" ");

  // 절벽(낙하) 지점 = delta<0 마커 위치. 강조용 원/배지.
  const dropMarker = markers.find((m) => m.delta < 0);

  const inRange = currentIncome !== undefined && currentIncome >= minIncome && currentIncome <= maxIncome;

  // X축 눈금 (1천만 단위).
  const ticks: number[] = [];
  for (let v = Math.ceil(minIncome / 10_000_000) * 10_000_000; v <= maxIncome; v += 10_000_000) ticks.push(v);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="연봉별 절세 환급액 절벽 그래프"
    >
      {/* Y 가이드 */}
      {[0, 0.5, 1].map((t) => {
        const yy = PAD.top + (1 - t) * plotH;
        const val = Math.round(maxRefund * 1.15 * t);
        return (
          <g key={t}>
            <line x1={PAD.left} y1={yy} x2={W - PAD.right} y2={yy} className="stroke-line/60" strokeWidth={1} />
            <text x={PAD.left - 6} y={yy + 3} textAnchor="end" className="fill-muted" fontSize={10}>
              {won(val)}
            </text>
          </g>
        );
      })}

      {/* X 눈금 */}
      {ticks.map((v) => (
        <text key={v} x={x(v)} y={H - 8} textAnchor="middle" className="fill-muted" fontSize={10}>
          {(v / 10_000_000).toFixed(0)}천만
        </text>
      ))}

      {/* 경계 세로 점선 + 라벨 */}
      {markers.map((m) => (
        <g key={m.income}>
          <line
            x1={x(m.income)}
            y1={PAD.top}
            x2={x(m.income)}
            y2={H - PAD.bottom}
            className={m.delta < 0 ? "stroke-clay/70" : "stroke-gold/50"}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text x={x(m.income)} y={PAD.top - 8} textAnchor="middle" className={m.delta < 0 ? "fill-clay" : "fill-gold"} fontSize={10} fontWeight={600}>
            {won(m.income)}
          </text>
        </g>
      ))}

      {/* 현재 연소득 위치 */}
      {inRange && (
        <g>
          <line x1={x(currentIncome!)} y1={PAD.top} x2={x(currentIncome!)} y2={H - PAD.bottom} className="stroke-ink/40" strokeWidth={1.5} />
          <text x={x(currentIncome!)} y={H - PAD.bottom + 18} textAnchor="middle" className="fill-ink" fontSize={9} fontWeight={600}>
            나 {won(currentIncome!)}
          </text>
        </g>
      )}

      {/* 환급 계단 곡선 */}
      <path d={path} fill="none" className="stroke-gold" strokeWidth={2.5} strokeLinejoin="round" />

      {/* 절벽 강조: 낙하 직전/직후 점 + delta 배지 */}
      {dropMarker && (
        <>
          <circle cx={x(dropMarker.income)} cy={y(Math.round(chart.assumedContribution * 0 + (points.find((p) => p.income === dropMarker.income)?.refund ?? 0)))} r={4} className="fill-gold" />
          <g transform={`translate(${x(dropMarker.income) + 8}, ${y((points.find((p) => p.income === dropMarker.income)?.refund ?? 0)) + 14})`}>
            <rect x={0} y={-11} width={62} height={16} rx={8} className="fill-clay/15 stroke-clay/40" strokeWidth={1} />
            <text x={31} y={1} textAnchor="middle" className="fill-clay" fontSize={10} fontWeight={700}>
              {won(dropMarker.delta)}원
            </text>
          </g>
        </>
      )}
    </svg>
  );
}
