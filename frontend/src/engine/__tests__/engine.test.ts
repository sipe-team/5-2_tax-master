import { describe, expect, it } from "vitest";
import { ruleSet } from "../../rules/products";
import type { UserProfile } from "../../rules/schema";
import { recommend } from "../index";
import { resolveProduct } from "../eligibility";
import { tranchesFor } from "../benefit";
import { lockupExceedsHorizon } from "../waterfall";

const base: UserProfile = {
  age: 30,
  incomeType: "earned",
  income: 50_000_000,
  monthlyInvestable: 500_000,
  horizonYears: 3,
  asOf: "2026-06-21",
};

const find = (rec: ReturnType<typeof recommend>, id: string) =>
  rec.waterfall.find((a) => a.productId === id);

describe("세액공제 골든 케이스", () => {
  it("연금저축 600만 → 16.5% 환급 99만 (기간 충분)", () => {
    // 락업 회피 위해 장기(노후) 가정: horizon 30
    const rec = recommend({ ...base, monthlyInvestable: 500_000, horizonYears: 30 }, ruleSet);
    const pension = find(rec, "pension-fund");
    expect(pension).toBeDefined();
    expect(pension!.annualAmount).toBe(6_000_000);
    expect(pension!.efficiency).toBeCloseTo(0.165, 5);
    expect(pension!.firstYearBenefit).toBe(990_000);
  });

  it("공유풀: 연금 600 + IRP 300 = 합산 세액공제 900 한도", () => {
    const rec = recommend({ ...base, monthlyInvestable: 3_000_000, horizonYears: 30 }, ruleSet);
    expect(find(rec, "pension-fund")!.annualAmount).toBe(6_000_000);
    expect(find(rec, "irp")!.annualAmount).toBe(3_000_000); // 풀 합산 900 - 연금 600
  });
});

describe("락업 하드 제약 (Q14)", () => {
  it("기간 3년 + 30세 → 연금/IRP는 55세 묶임이라 워터폴 제외", () => {
    const rec = recommend(base, ruleSet);
    expect(find(rec, "pension-fund")).toBeUndefined();
    expect(find(rec, "irp")).toBeUndefined();
    const reasons = rec.assumptions.map((b) => b.text).join("\n");
    expect(reasons).toContain("연금저축펀드 제외");
  });
});

const action = (rec: ReturnType<typeof recommend>, id: string) => rec.actions.find((a) => a.id === id);

describe("긴급 액션 (Q9)", () => {
  it("청년미래적금 신청 마감 D-day", () => {
    const rec = recommend({ ...base, age: 28, income: 30_000_000 }, ruleSet);
    const youth = action(rec, "urgent-youth-future-savings");
    expect(youth).toBeDefined();
    expect(youth!.deadline).toBe("2026-07-03");
    expect(youth!.dDay).toBe(12); // 2026-06-21 → 07-03
    expect(youth!.urgency).toBe("immediate");
  });

  it("RIA 감면율 절벽 + 보유 해외주식 기준 추정 절감액", () => {
    const rec = recommend(
      { ...base, overseasHoldings: { marketValue: 50_000_000, costBasis: 5_000_000 } },
      ruleSet,
    );
    const ria = action(rec, "urgent-ria");
    expect(ria).toBeDefined();
    expect(ria!.deadline).toBe("2026-07-31"); // 현재 80% 구간
    // (4500만 - 250만) × 22% × 80% = 748만
    expect(ria!.estimatedBenefit).toBe(7_480_000);
  });
});

describe("전략 액션 (PRD 병합)", () => {
  it("해외주식 미실현 수익 > 250만 → 분산 매도 전략", () => {
    const rec = recommend({ ...base, overseasUnrealizedProfit: 15_000_000 }, ruleSet);
    const split = action(rec, "strategy-split-sell");
    expect(split).toBeDefined();
    // (1500만 - 250만) × 22% = 275만
    expect(split!.estimatedBenefit).toBe(2_750_000);
  });

  it("미실현 수익 크고 배우자 있음 → 가족 증여 전략 + 보유기간 경고", () => {
    const rec = recommend(
      { ...base, overseasUnrealizedProfit: 50_000_000, hasSpouse: true },
      ruleSet,
    );
    const gift = action(rec, "strategy-family-gift");
    expect(gift).toBeDefined();
    expect(gift!.warning).toContain("10년");
  });

  it("금융소득 2,000만 초과 → 금소세 관리 경고 + ISA 가입불가(게이트 탈락)", () => {
    const rec = recommend({ ...base, financialIncome: 25_000_000 }, ruleSet);
    expect(action(rec, "strategy-finance-top")).toBeDefined();
    expect(find(rec, "isa")).toBeUndefined(); // 금소세 대상 도출 → ISA 자격 탈락
  });

  it("금소세 여부는 financialIncome로 도출 — 비대상이면 ISA 자격 통과", () => {
    const isaProduct = ruleSet.products.find((p) => p.id === "isa")!;
    // 미입력(비대상 가정) → 통과
    expect(resolveProduct(isaProduct, { ...base }).resolved).not.toBeNull();
    // 2,000만 초과 도출은 recommend가 하므로 여기선 명시 플래그로 확인
    expect(resolveProduct(isaProduct, { ...base, isFinanceTopTaxpayer: true }).resolved).toBeNull();
  });
});

describe("상호작용 억제 (Q10)", () => {
  it("RIA 활성(보유 해외주식) → 신규 해외주식 직투 워터폴 제외", () => {
    const rec = recommend(
      { ...base, overseasHoldings: { marketValue: 50_000_000, costBasis: 5_000_000 } },
      ruleSet,
    );
    expect(find(rec, "overseas-stock")).toBeUndefined();
    expect(rec.assumptions.map((b) => b.text).join("\n")).toContain("해외주식 직접투자 제외");
  });
});

describe("등급/업셀 (Q16)", () => {
  it("저소득 + 가구중위 미입력 → 일반형(6%) 적용 + 우대형 업셀 배지", () => {
    const rec = recommend({ ...base, age: 28, income: 30_000_000 }, ruleSet);
    const youth = find(rec, "youth-future-savings");
    expect(youth?.name).toContain("일반형");
    expect(youth?.badges.some((b) => b.kind === "upsell")).toBe(true);
  });
});

describe("잔여 한도 (PRD 병합)", () => {
  it("연금저축 600만 이미 납입 → 잔여 0이라 워터폴에서 빠지고, IRP에 합산 잔여 300만", () => {
    const rec = recommend(
      { ...base, horizonYears: 30, monthlyInvestable: 3_000_000, hasPension: true, pensionContribution: 6_000_000 },
      ruleSet,
    );
    expect(find(rec, "pension-fund")).toBeUndefined(); // 600 - 600 = 0
    expect(find(rec, "irp")!.annualAmount).toBe(3_000_000); // 합산 900 - 600 = 300만
  });
});

describe("그리디 최적성 — 완전탐색 검증 (Q8)", () => {
  // 락업으로 연금/IRP 제외 → 풀 없는 독립 트랜치 → 순수 순서 문제
  const user: UserProfile = { ...base, age: 30, horizonYears: 3, monthlyInvestable: 500_000 };

  function eligibleTranches() {
    return ruleSet.products
      .map((p) => resolveProduct(p, user).resolved)
      .filter((r): r is NonNullable<typeof r> => !!r)
      .filter(
        (r) => !r.product.oneTimeOnExistingAssets && !lockupExceedsHorizon(r.product.lockup, user),
      )
      .flatMap((r) => tranchesFor(r, user, ruleSet));
  }

  function fillByOrder(order: ReturnType<typeof eligibleTranches>, budget: number): number {
    let b = budget;
    let benefit = 0;
    for (const t of order) {
      const alloc = Math.min(t.annualCap, b);
      benefit += alloc * t.efficiency;
      b -= alloc;
    }
    return benefit;
  }

  function permutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    const out: T[][] = [];
    arr.forEach((x, i) => {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const p of permutations(rest)) out.push([x, ...p]);
    });
    return out;
  }

  it("효율 내림차순 그리디가 모든 채우기 순서 중 전역 최적", () => {
    const tranches = eligibleTranches();
    expect(tranches.length).toBeGreaterThanOrEqual(3);
    const budget = user.monthlyInvestable * 12;

    const greedy = [...tranches].sort((a, b) => b.efficiency - a.efficiency);
    const greedyBenefit = fillByOrder(greedy, budget);

    let best = 0;
    for (const order of permutations(tranches)) {
      best = Math.max(best, fillByOrder(order, budget));
    }
    expect(greedyBenefit).toBeCloseTo(best, 6);
  });
});
