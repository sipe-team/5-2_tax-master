import type { IncomeType, UserProfile } from "./rules/schema";
import { todayISO } from "./lib/format";

/**
 * 데모 페르소나 프리셋 (와우모먼트).
 *
 * 링크를 연 사람이 입력을 고민할 필요 없이 버튼 한 번으로 "내 결과"를 보게 한다.
 * 세 프리셋은 각각 긴급 트랙·워터폴·금액이 뚜렷이 달라(엔진 실측 검증) 발표 시연에서
 * 상품 7종이 사람마다 다르게 채워지는 차별점을 30초 안에 증명한다.
 *
 * 각 값은 App의 입력 state를 그대로 덮어쓰는 평면 구조(엔진 결정론 입력과 1:1).
 */

export interface Persona {
  id: string;
  emoji: string;
  label: string;
  /** 칩 아래 한 줄 요약. */
  tagline: string;
  age: number;
  incomeType: IncomeType;
  /** 만원 단위 (App 입력과 동일 단위). */
  incomeMan: number;
  monthlyMan: number;
  horizonYears: number;
  /** 해외주식 보유(RIA 트리거). 있으면 추가입력 토글도 자동으로 열림. */
  overseas?: { valueMan: number; costMan: number };
}

export const PERSONAS: Persona[] = [
  {
    id: "rookie",
    emoji: "🌱",
    label: "사회초년생",
    tagline: "27세 · 첫 직장 · 목돈 마련",
    age: 27,
    incomeType: "earned",
    incomeMan: 3200,
    monthlyMan: 40,
    horizonYears: 3,
  },
  {
    id: "worker",
    emoji: "💼",
    label: "30대 직장인",
    tagline: "38세 · 노후 준비 시작",
    age: 38,
    incomeType: "earned",
    incomeMan: 6000,
    monthlyMan: 100,
    horizonYears: 25,
  },
  {
    id: "investor",
    emoji: "📈",
    label: "해외주식 보유",
    tagline: "45세 · 미국주식 보유 · 절벽 임박",
    age: 45,
    incomeType: "earned",
    incomeMan: 9000,
    monthlyMan: 150,
    horizonYears: 25,
    overseas: { valueMan: 5000, costMan: 500 },
  },
];

const MAN = 10_000;

/**
 * 페르소나 프리셋 → 엔진 UserProfile (만원→원).
 *
 * 퍼널 입력을 건너뛰고 ResultPage로 바로 보낼 값. 퍼널의 toProfile()과 동일한
 * 단위 변환·RIA 매핑을 따른다(결정론 유지: asOf만 오늘 날짜).
 */
export function personaToProfile(p: Persona): UserProfile {
  const overseas = p.overseas
    ? { marketValue: p.overseas.valueMan * MAN, costBasis: p.overseas.costMan * MAN }
    : undefined;
  return {
    age: p.age,
    incomeType: p.incomeType,
    income: p.incomeType === "none" ? 0 : p.incomeMan * MAN,
    monthlyInvestable: p.monthlyMan * MAN,
    horizonYears: p.horizonYears,
    asOf: todayISO(),
    overseasHoldings: overseas,
    overseasUnrealizedProfit: overseas
      ? Math.max(0, overseas.marketValue - overseas.costBasis)
      : undefined,
  };
}
