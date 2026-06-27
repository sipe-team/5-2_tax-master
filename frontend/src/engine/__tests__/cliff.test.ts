import { describe, expect, it } from "vitest";

import { ruleSet } from "../../rules/products";
import { buildCliffChart } from "../cliff";

describe("연봉 절벽 차트 (와우모먼트)", () => {
  it("총급여 5,500만 공제율 절벽: 600만 납입 시 환급 99만 → 79.2만 (−19.8만)", () => {
    const chart = buildCliffChart(ruleSet, "earned", 6_000_000)!;
    expect(chart).not.toBeNull();
    const cliff = chart.markers.find((m) => m.income === 55_000_000);
    expect(cliff).toBeDefined();
    // 16.5% → 13.2% on 600만
    expect(cliff!.delta).toBe(-198_000);
    expect(cliff!.detail).toContain("16.5% → 13.2%");
  });

  it("ISA 서민형 절벽: 총급여 5,000만 경계 마커가 존재한다", () => {
    const chart = buildCliffChart(ruleSet, "earned", 6_000_000)!;
    const isaCliff = chart.markers.find((m) => m.income === 50_000_000);
    expect(isaCliff).toBeDefined();
    expect(isaCliff!.detail).toContain("ISA 비과세");
  });

  it("계단 곡선: 5,500만 경계에서 환급이 수직 낙하(같은 income에 두 값)", () => {
    const chart = buildCliffChart(ruleSet, "earned", 6_000_000)!;
    const atEdge = chart.points.filter((p) => p.income === 55_000_000);
    expect(atEdge.length).toBe(2);
    const [before, after] = atEdge;
    expect(before.refund).toBe(990_000); // 600만 × 16.5%
    expect(after.refund).toBe(792_000); // 600만 × 13.2%
  });

  it("경계 이하 환급은 16.5%, 초과는 13.2%로 단조 비증가", () => {
    const chart = buildCliffChart(ruleSet, "earned", 6_000_000)!;
    for (let i = 1; i < chart.points.length; i++) {
      expect(chart.points[i].refund).toBeLessThanOrEqual(chart.points[i - 1].refund);
    }
  });

  it("종합소득 유형은 경계가 4,500만으로 다르다", () => {
    const chart = buildCliffChart(ruleSet, "comprehensive", 6_000_000)!;
    expect(chart.markers.some((m) => m.income === 45_000_000)).toBe(true);
  });

  it("결정론: 같은 입력 → 같은 차트", () => {
    const a = buildCliffChart(ruleSet, "earned", 6_000_000);
    const b = buildCliffChart(ruleSet, "earned", 6_000_000);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
