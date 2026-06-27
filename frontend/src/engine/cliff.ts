import type { IncomeType, RuleSet, Sourced, TaxCreditBenefit } from "../rules/schema";
import { confirmed } from "./confirmed";

/**
 * 연봉 절벽 (와우모먼트): "연봉이 이 선을 넘으면 절세액이 떨어진다."
 *
 * 임의 시뮬레이션이 아니라 룰 데이터에 박힌 **실제 법령 경계**를 그대로 그린다(정직성, DESIGN Q12).
 * - 연금/IRP 세액공제율 경계: rateByIncome의 upTo (예: 총급여 5,500만 → 16.5%/13.2%).
 * - ISA 비과세 한도 경계: 서민형 variant의 incomeCap (예: 총급여 5,000만 → 400만/200만).
 *
 * 결정론: Date/랜덤 미사용. 룰만 입력이면 같은 곡선(테스트 가능).
 */

interface CliffPoint {
  income: number; // 연소득(원)
  refund: number; // 해당 연봉에서 고정 납입액 기준 첫 해 환급(원)
}

interface CliffMarker {
  income: number; // 경계 연봉(원)
  /** 경계 직전→직후 환급 변화(원, 음수=하락). */
  delta: number;
  label: string; // 짧은 제목
  detail: string; // 설명 (공제율/비과세 변화)
}

export interface CliffChart {
  incomeType: IncomeType;
  /** 그래프 X축 가정 납입액(원). 연금 공제 한도 기준. */
  assumedContribution: number;
  points: CliffPoint[]; // 계단 곡선(경계마다 두 점)
  markers: CliffMarker[];
  minIncome: number;
  maxIncome: number;
}

const won = (n: number) => `${Math.round(n / 10_000).toLocaleString()}만`;

/** 연금/IRP 공제율표에서 incomeType별 경계(upTo, rate)를 오름차순으로. */
function pensionBrackets(b: TaxCreditBenefit, incomeType: IncomeType) {
  return b.rateByIncome
    .filter((r) => r.incomeType === incomeType)
    .map((r) => ({ upTo: r.upTo, rate: confirmed(r.rate) }))
    .filter((r): r is { upTo: number; rate: number } => r.rate !== undefined)
    .sort((a, b2) => a.upTo - b2.upTo);
}

function rateAt(income: number, brackets: Array<{ upTo: number; rate: number }>): number {
  for (const b of brackets) if (income <= b.upTo) return b.rate;
  return brackets[brackets.length - 1]?.rate ?? 0;
}

/**
 * 연봉 절벽 차트를 룰에서 산출.
 * @param contribution 그래프 가정 납입액(기본 600만 = 연금 공제 한도).
 */
export function buildCliffChart(
  rules: RuleSet,
  incomeType: IncomeType = "earned",
  contribution = 6_000_000,
): CliffChart | null {
  const pension = rules.products.find((p) => p.id === "pension-fund");
  if (!pension || pension.benefit.kind !== "taxCredit") return null;
  const brackets = pensionBrackets(pension.benefit, incomeType);
  if (brackets.length < 2) return null;

  // 공제 한도 내로 납입 cap.
  const creditCap = confirmed(pension.benefit.creditCap) ?? contribution;
  const contrib = Math.min(contribution, creditCap);

  // X 범위: 첫 경계의 0.6배 ~ 마지막 유한 경계의 1.5배(여유).
  const finiteEdges = brackets.map((b) => b.upTo).filter((u) => isFinite(u));
  const lastEdge = finiteEdges[finiteEdges.length - 1] ?? 60_000_000;
  const minIncome = Math.max(20_000_000, Math.round((finiteEdges[0] ?? lastEdge) * 0.6));
  const maxIncome = Math.round(lastEdge * 1.5);

  // 공제율 경계 마커.
  const markers: CliffMarker[] = [];
  for (const edge of finiteEdges) {
    const before = rateAt(edge, brackets);
    const after = rateAt(edge + 1, brackets);
    if (before === after) continue;
    const delta = Math.round(contrib * (after - before));
    markers.push({
      income: edge,
      delta,
      label: `총급여 ${won(edge)} 초과`,
      detail: `연금·IRP 세액공제율 ${(before * 100).toFixed(1)}% → ${(after * 100).toFixed(1)}% · ${won(contrib)} 납입 시 환급 ${won(contrib * before)} → ${won(contrib * after)} (${delta < 0 ? "" : "+"}${won(delta)})`,
    });
  }

  // ISA 서민형 비과세 경계도 정보 마커로(환급 곡선엔 미반영 — 비과세는 운용수익 기준이라 축이 다름).
  const isa = rules.products.find((p) => p.id === "isa");
  const lowVar = isa?.variants?.find((v) => v.id === "isa-low-income");
  const isaCap = lowVar?.eligibility.incomeCap?.[incomeType];
  const isaEdge = isaCap ? confirmed(isaCap) : undefined;
  if (isaEdge !== undefined) {
    const base = isa!.benefit.kind === "sepTax" ? confirmed(isa!.benefit.exemptLimit) : undefined;
    const lowExempt =
      lowVar?.benefit && "exemptLimit" in lowVar.benefit
        ? (lowVar.benefit.exemptLimit as Sourced<number>)
        : undefined;
    const low = lowExempt ? confirmed(lowExempt) : undefined;
    markers.push({
      income: isaEdge,
      delta: 0,
      label: `총급여 ${won(isaEdge)} 초과`,
      detail:
        base !== undefined && low !== undefined
          ? `ISA 비과세 한도 ${won(low)} → ${won(base)}으로 축소 (서민형 → 일반형)`
          : `ISA 서민형 자격 상실 (비과세 한도 축소)`,
    });
  }
  markers.sort((a, b) => a.income - b.income);

  // 계단 곡선: 각 공제율 경계에서 수직 낙하(경계 직전/직후 두 점).
  const points: CliffPoint[] = [{ income: minIncome, refund: Math.round(contrib * rateAt(minIncome, brackets)) }];
  for (const b of brackets) {
    if (!isFinite(b.upTo) || b.upTo < minIncome || b.upTo > maxIncome) continue;
    points.push({ income: b.upTo, refund: Math.round(contrib * rateAt(b.upTo, brackets)) });
    points.push({ income: b.upTo, refund: Math.round(contrib * rateAt(b.upTo + 1, brackets)) });
  }
  points.push({ income: maxIncome, refund: Math.round(contrib * rateAt(maxIncome, brackets)) });

  return { incomeType, assumedContribution: contrib, points, markers, minIncome, maxIncome };
}
