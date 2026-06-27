import type { UserProfile } from "../rules/schema";
import { type ActionCard, type ActionUrgency, URGENCY_WEIGHT } from "./types";

/**
 * 상황별 절세 전략 → 액션 카드 (PRD: 그릇=워터폴, 전략=액션).
 * 정답지 TAX_SAVING.md v2 §4-2~4-5, §8~§10. 그릇처럼 "매달 채우는" 게 아니라
 * 보유·소득 상황에 따라 "조건부로 실행"하는 행동이라 워터폴과 분리한다.
 *
 * 주의: 여기 수치(250만 공제·22% 양도세·증여한도·분리과세율)는 전략 휴리스틱용 상수로
 * v2 본문을 참조해 인라인한다. 그릇 계산의 Sourced 데이터와는 별개.
 */

const MAN = 10_000;
const FOREIGN_EXEMPT = 2_500_000; // §4-1 연 250만 양도세 기본공제
const CAP_GAINS_RATE = 0.22; // §4-1 양도세율(지방세 포함)
const GIFT_LIMIT = { spouse: 600_000_000, adultChild: 50_000_000, minorChild: 20_000_000 }; // §4-4 10년 한도
const FINANCE_TOP_THRESHOLD = 20_000_000; // §10 금소세 2,000만
const FINANCE_APPROACH = 15_000_000; // 접근 경고 기준
const STRUCTURAL_BASE_MANWON = 50; // 절세효과 추정 불가한 구조적 전략의 기본 점수

function scoreOf(urgency: ActionUrgency, benefit: number | null): number {
  const manwon = benefit != null ? benefit / MAN : STRUCTURAL_BASE_MANWON;
  return Math.round(manwon * URGENCY_WEIGHT[urgency] * 10) / 10;
}

function card(
  c: Omit<ActionCard, "score" | "badges"> & { badges?: ActionCard["badges"] },
): ActionCard {
  return { ...c, score: scoreOf(c.urgency, c.estimatedBenefit), badges: c.badges ?? [] };
}

const holdsForeign = (u: UserProfile) =>
  !!u.investTypes?.includes("foreign_stock") ||
  (u.overseasUnrealizedProfit ?? 0) > 0 ||
  !!u.overseasHoldings;

/** 전략 액션 산출. RIA·청년적금 마감(immediate)은 urgent.ts가 담당. */
export function buildStrategyActions(user: UserProfile): ActionCard[] {
  const out: ActionCard[] = [];
  const profit = user.overseasUnrealizedProfit ?? 0;

  // §4-3 연도별 분산 매도 — 미실현 수익 > 연 250만
  if (profit > FOREIGN_EXEMPT) {
    const years = Math.ceil(profit / FOREIGN_EXEMPT);
    const lumpTax = Math.round((profit - FOREIGN_EXEMPT) * CAP_GAINS_RATE);
    out.push(
      card({
        id: "strategy-split-sell",
        name: "해외주식 연도별 분산 매도",
        category: "해외주식 전략",
        urgency: "partial",
        estimatedBenefit: lumpTax, // 일괄 매도 대비 회피 세액(완전 분산 시 0원)
        reason: `미실현 수익 ${Math.round(profit / MAN).toLocaleString()}만 — 매년 250만씩 ${years}년 분할 매도하면 기본공제로 양도세 0원에 가깝게.`,
        action: `연 250만 한도 내 ${years}년 분할 매도`,
        warning: "분할 기간 길수록 환율·주가 리스크. 결제일 기준이라 12/29 이전 거래 완료 필요.",
      }),
    );
  }

  // §4-2 손익통산 — 해외주식 보유 시
  if (holdsForeign(user)) {
    out.push(
      card({
        id: "strategy-loss-offset",
        name: "해외주식 손익통산",
        category: "해외주식 전략",
        urgency: "structural",
        estimatedBenefit: null, // 손실 규모 미상 → 추정 불가
        reason: "같은 해에 수익·손실 종목을 함께 매도하면 순이익에만 과세돼 세금이 줄어요.",
        action: "연내 손실 종목을 수익 종목과 함께 매도 (즉시 재매수 가능)",
        warning: "결제일 기준 — 12/29 이전 거래 완료 필요. 일반 국내 상장주식과는 통산 불가.",
      }),
    );
  }

  // §4-4 가족 증여 후 매도 — 미실현 수익 크고 가족 있을 때
  if (profit > 15_000_000 && (user.hasSpouse || user.hasChildren)) {
    const limit = user.hasSpouse
      ? GIFT_LIMIT.spouse
      : user.hasMinorChildren
        ? GIFT_LIMIT.minorChild
        : GIFT_LIMIT.adultChild;
    const benefit = Math.round(Math.min(profit, limit) * CAP_GAINS_RATE);
    out.push(
      card({
        id: "strategy-family-gift",
        name: "가족 증여 후 매도",
        category: "해외주식 전략",
        urgency: "structural",
        estimatedBenefit: benefit,
        reason:
          "미실현 수익이 큰 주식을 가족에게 증여하면 취득가가 재설정돼 양도세 부담이 크게 줄어요.",
        action: `${user.hasSpouse ? "배우자" : "자녀"}에게 증여 후 매도 (10년 합산 비과세 한도 내)`,
        warning:
          "증여 후 단기 매도 시 이월과세로 효과 소멸 — 안전상 10년 보유 권장. 매도대금 반환 시 부당행위계산 부인.",
      }),
    );
  }

  // §9 고배당주 한시 분리과세 (2026~2028)
  if (user.holdsHighDividend && (user.dividendIncome ?? 0) > 0) {
    out.push(
      card({
        id: "strategy-high-dividend",
        name: "고배당주 한시 분리과세",
        category: "배당",
        urgency: "partial",
        estimatedBenefit: null, // 요건·통과안 수치 재확인 필요(v2 §9 flag)
        reason:
          "2026~2028 한시로 요건 충족 고배당주 배당은 종합과세 대신 14~30% 분리과세가 가능해요.",
        action: "분리과세 신청 (개별 종목만 — ETF·리츠 제외)",
        warning: "2028년 말 일몰. 요건·세율은 국세청 공식 자료 재확인 필요.",
        deadline: "2028-12-31",
      }),
    );
  }

  // §10 금융소득 종합과세 관리
  const fin = user.financialIncome ?? 0;
  if (fin > FINANCE_TOP_THRESHOLD) {
    out.push(
      card({
        id: "strategy-finance-top",
        name: "금융소득 종합과세 관리",
        category: "금융소득",
        urgency: "warning",
        estimatedBenefit: null,
        reason: `연 금융소득 ${Math.round(fin / MAN).toLocaleString()}만 — 2,000만 초과로 종합과세(최고 49.5%) 대상이에요.`,
        action: "고배당 분리과세 활용·가족 명의 분산·세무사 상담",
        warning: "ISA·청년미래적금은 가입 불가(직전 3년 룩백).",
      }),
    );
  } else if (fin >= FINANCE_APPROACH) {
    out.push(
      card({
        id: "strategy-finance-approach",
        name: "금융소득 2,000만 접근 주의",
        category: "금융소득",
        urgency: "warning",
        estimatedBenefit: null,
        reason: `연 금융소득 ${Math.round(fin / MAN).toLocaleString()}만 — 2,000만에 근접. 초과 시 종합과세 대상.`,
        action: "ISA 비중 확대·분리과세 상품으로 조정",
        warning: null,
      }),
    );
  }

  // §2 연계 — ISA 만기 자금 연금 전환 (보유자)
  if (user.hasIsa) {
    out.push(
      card({
        id: "strategy-isa-to-pension",
        name: "ISA 만기 → 연금 전환",
        category: "연금 연계",
        urgency: "structural",
        estimatedBenefit: 300_000, // 전환액 10%(최대 300만) × 공제 → 최대 약 30만 추가 환급
        reason:
          "ISA 만기 자금을 60일 내 연금저축/IRP로 옮기면 전환액 10%(최대 300만) 추가 세액공제.",
        action: "만기 시 60일 이내 연금계좌로 이체",
        warning: null,
      }),
    );
  }

  return out;
}
