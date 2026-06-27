/**
 * 숙련도(seniority) 기준 연봉 가이드 레인지 (만원).
 *
 * ⚠️ 로켓펀치 Open API는 연봉 필드를 제공하지 않는다(DESIGN_ROCKETPUNCH §1).
 * 따라서 공고 선택 시 연봉을 자동 채우지 못하며, 아래 표는 **2025년 IT/개발 직군
 * 연차별 평균연봉 공개 통계에 근거한 추정 레인지**다(로켓펀치는 IT/스타트업 비중이 큼).
 * 직군·회사규모·지역에 따라 편차가 크므로 어디까지나 시작값 힌트이며,
 * 목표 연봉은 사용자가 직접 확정하는 것이 원칙.
 *
 * 출처(2025):
 * - 그룹바이 "2025 개발자 연차별 평균연봉": https://groupby.careers
 * - 사람인 점핏 "2025 개발자 연봉 리포트": https://jumpit.saramin.co.kr/report/2025/salary
 * - 잡플래닛 "26년 현실 평균연봉 모음": https://www.jobplanet.co.kr
 */

import type { Seniority } from "./jobs";

export interface SalaryRangeMan {
  min: number;
  max: number;
  mid: number;
}

/**
 * 매핑(만원). 신입 평균 ~3,200 / 일반 3,000~4,500, 주니어(1~3년) 3,800~5,500,
 * 미들(4~10년) 5,500~8,500, 시니어(10년+) 7년차 1억 가능 → 8,000~13,000,
 * 임원급은 통계 희박 → 보수적 상향 추정.
 */
export const SALARY_GUIDE_MAN: Record<Seniority, SalaryRangeMan> = {
  BEGINNER: { min: 3000, max: 4500, mid: 3500 },
  JUNIOR: { min: 3800, max: 5500, mid: 4500 },
  MIDLEVEL: { min: 5500, max: 8500, mid: 6800 },
  SENIOR: { min: 8000, max: 13000, mid: 9500 },
  EXECUTIVE: { min: 12000, max: 25000, mid: 16000 },
};

export const SALARY_GUIDE_NOTE =
  "로켓펀치 API는 연봉을 제공하지 않아요. 아래 값은 2025년 IT/개발 연차별 평균연봉 통계를 토대로 한 추정 범위로, 직군·회사규모에 따라 편차가 커요. 목표 연봉은 직접 확정하세요.";

/** 숙련도 → 가이드 레인지(없으면 undefined). */
export function salaryGuideFor(seniority?: Seniority): SalaryRangeMan | undefined {
  return seniority ? SALARY_GUIDE_MAN[seniority] : undefined;
}
