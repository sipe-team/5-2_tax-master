import { describe, expect, it } from "vitest";
import { ruleSet } from "../../rules/products";
import type { UserProfile } from "../../rules/schema";
import { diffScenarios } from "../scenario";

// horizon 3 → 연금/IRP는 락업으로 워터폴 제외. 소득 게이트 교차만 보기 위한 baseline.
const base: UserProfile = {
  age: 30,
  incomeType: "earned",
  income: 44_000_000,
  monthlyInvestable: 500_000,
  horizonYears: 3,
  asOf: "2026-06-21",
};

const shift = (d: ReturnType<typeof diffScenarios>, id: string) =>
  d.shifts.find((s) => s.productId === id)!;

describe("이직 시나리오 diff (DESIGN_ROCKETPUNCH §4.2)", () => {
  it("4,400만 → 6,000만: 한계세율 16.5% → 26.4%", () => {
    const d = diffScenarios(base, 60_000_000, ruleSet);
    expect(d.marginalRateChange.from).toBeCloseTo(0.165, 5);
    expect(d.marginalRateChange.to).toBeCloseTo(0.264, 5);
  });

  it("청년형 강화ISA 소득공제 효율↑ (한계세율 상승 반영: 0.0165 → 0.0264)", () => {
    const d = diffScenarios(base, 60_000_000, ruleSet);
    const s = shift(d, "youth-enhanced-isa");
    expect(s.status).toBe("changed");
    expect(s.fromEfficiency).toBeCloseTo(0.0165, 6);
    expect(s.toEfficiency).toBeCloseTo(0.0264, 6);
    expect(s.toEfficiency!).toBeGreaterThan(s.fromEfficiency!);
  });

  it("7,500만 초과 점프(7,000→8,000만): 청년상품 자격 상실 후크", () => {
    const d = diffScenarios({ ...base, income: 70_000_000 }, 80_000_000, ruleSet);
    expect(d.lost).toContain("youth-future-savings");
    expect(d.lost).toContain("youth-enhanced-isa");
    expect(d.gained).toEqual([]);
  });

  it("연봉 하락(8,000→4,400만): 청년상품 자격 획득(가구중위 미입력 → 일반형)", () => {
    const d = diffScenarios({ ...base, income: 80_000_000 }, 44_000_000, ruleSet);
    expect(d.gained).toContain("youth-future-savings");
    expect(d.gained).toContain("youth-enhanced-isa");
    // 가구중위소득 미입력이면 우대형(≤150%)은 가정하지 않음(Q16) → 일반형 적용 + 우대형은 업셀.
    expect(shift(d, "youth-future-savings").toVariantId).toBe("youth-savings-general");
  });

  it("5,500만 → 7,000만: 청년적금 일반형→비과세만 등급 강등(효율 하락)", () => {
    // 일반형 소득상한 6,000만 교차 → 등급 떨어지지만 자격(7,500만)은 유지.
    const d = diffScenarios({ ...base, income: 55_000_000 }, 70_000_000, ruleSet);
    const s = shift(d, "youth-future-savings");
    expect(s.status).toBe("changed");
    expect(s.fromVariantId).toBe("youth-savings-general");
    expect(s.toVariantId).toBeUndefined();
    expect(s.toEfficiency!).toBeLessThan(s.fromEfficiency!);
  });

  it("동일 연봉이면 변화 없음(gained/lost 비고, 모든 shift=same)", () => {
    const d = diffScenarios(base, base.income, ruleSet);
    expect(d.gained).toEqual([]);
    expect(d.lost).toEqual([]);
    expect(d.shifts.every((s) => s.status === "same")).toBe(true);
    expect(d.netFirstYearBenefitChange).toBe(0);
  });
});
