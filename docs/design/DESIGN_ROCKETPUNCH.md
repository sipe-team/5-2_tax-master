# 로켓펀치 API 연동 설계 (v1) — 이직 시뮬레이터 · 회사규모 자격판정

> 본 문서는 두 아이디어(① 이직/연봉 시뮬레이터 ② 청년·중소기업 자격 자동판정)의
> **구현 가능성 평가 + 설계 결정**을 담는다. 수치 정답지는 [`TAX_SAVING.md`](../domain/TAX_SAVING.md),
> 기존 설계 기준선은 [`DESIGN.md`](./DESIGN.md)이다.
> API 사실은 **실제 호출로 검증함**(2026-06-27, 사용자 App Key 기준).

---

## 0. 한 줄 결론

- **① 이직 시뮬레이터: 구현 가능 (핵심 가치는 API 없이도 성립).** 단, "공고에서 연봉을 불러온다"는
  전제는 **불가** — 로켓펀치 Open API에는 연봉 필드가 없다. 목표 연봉은 사용자가 입력하고,
  공고는 *맥락/회사규모*만 제공하는 형태로 재설계한다. 시뮬레이터 엔진 자체는 **이미 있는 순수
  엔진을 두 번 돌려 diff**하는 것이라 비용이 매우 낮다.
- **② 회사규모 자격판정: 부분 구현 가능 (가치 제한적).** 회사 규모(TINY~HUGE)·산업군은 실제로
  제공된다. 그러나 (a) 이 규모 분류는 **법상 중소기업 정의(조특법/중소기업기본법)가 아니라
  로켓펀치 자체 분류**라 *법적 판정이 아닌 힌트*이고, (b) **현재 MVP 7개 상품 중 중소기업 재직을
  게이트로 쓰는 상품이 없다**(중소기업은 청년미래적금 *우대형 tier* 뉘앙스로 1회 등장할 뿐).
  → "추정 배지 1개 대체 + 우대형 tier 보정" 수준. 큰 신규 자격 해금은 없음. 정직하게 포지셔닝 필요.

두 기능 공통의 **결정적 제약**: 두 기능 모두 **백엔드(얇은 프록시)가 반드시 필요**하다.
이는 기존 설계의 핵심 결정(Q7: *백엔드 없음, 개인정보 서버 미전송*)과 충돌하므로 §3에서 해소한다.

---

## 1. 검증된 API 사실 (실제 호출 결과)

**Base URL**: `https://openapi.rocketpunch.com/v1` — ⚠️ 문서의 OpenAPI 스펙은 `/api/v1`로
적혀 있으나 **실제 동작 경로는 `/v1`**이다(`/api/v1` 호출 시 게이트웨이가 `api/api/v1`로
이중 prefix → 404). 스펙을 그대로 믿지 말 것.

**인증**: 헤더 `X-RP-API-Key: <App Key>` (apiKey 방식). App Key 전용 앱이므로 OAuth 불필요.
검증: `GET /v1/codes/employment-types` → 200 OK.

| 필요한 데이터 | 제공? | 근거(실측) |
|---|---|---|
| 채용공고 목록/검색 | ✅ | `GET /v1/jobs` → totalItems 1230, 페이징 정상 |
| 공고의 **연봉/보수** | ❌ **없음** | `JobSummaryResponse`·`JobDetailResponse` 어디에도 salary/pay/compensation 필드 없음. `subtitle`·`description` 자유텍스트에 간혹 있으나 대다수 "회사 내규" → **신뢰 불가** |
| 회사 **규모** | ✅ | `company.size` enum `TINY/SMALL/MEDIUM/LARGE/HUGE` (모든 공고에 포함). `companySizes` 필터도 동작(HUGE 37건 등) |
| 회사 **산업군** | ✅ | `company.industry`(예: `IT_ETC`) + `GET /v1/codes/job-industries`(IT/SERVICE/MANUFACTURING…10개 대분류, 계층형) |
| 직군/숙련도/고용형태 코드 | ✅ | `/v1/codes/{job-categories,seniorities,employment-types}` |
| **회사명으로 회사 검색** | ❌ 없음 | 독립 `/companies` 엔드포인트 없음. 회사 조회는 `GET /v1/jobs?companyId={handle}`로만 가능 → **회사 handle을 알아야 하고, 활성 공고가 있어야 보임** |
| CORS (브라우저 직접 호출) | ❌ | `OPTIONS /v1/jobs` → 401, `Access-Control-Allow-Origin` 헤더 없음 → 브라우저 fetch 차단됨 |

핵심 시사점 두 가지:
1. **연봉이 없다** → 기능 ①의 "공고에서 연봉 자동 적용"은 설계에서 제거한다.
2. **CORS 차단 + 키 노출 위험** → 기능 ①②는 **프록시 없이는 브라우저에서 호출 불가.**

---

## 2. 🔴 보안 (지금 바로)

- **App Key `rp_app_3a07…2852`는 이미 평문으로 채팅에 노출됨 → 로켓펀치 콘솔에서 재발급(회전) 권장.**
- App Key는 **시크릿**이다. **프론트엔드 코드/번들/깃에 절대 포함 금지.** 프록시의 환경변수/시크릿으로만 보관.
- `.gitignore`에 `.env*` 확인. 키는 `RP_APP_KEY` 환경변수로 주입.

---

## 3. 🔑 핵심 결정 — 프라이버시 불변식을 지키는 얇은 프록시

기존 Q7("개인정보 서버 미전송")을 깨지 않으면서 API를 쓰는 유일한 길:

```
┌─ 브라우저 (개인정보 100% 잔류) ───────────────────────┐
│  나이·연소득·월투자액·보유주식  →  결정론 TS 엔진     │
│  (recommend / diffScenarios)        ↑ 결과는 여기서만   │
│                                     │                   │
│   공개 질의(공고검색·회사규모)만 ↓  │ 공개 데이터만 ↑   │
└───────────────────────────────────┼───────────────────┘
                                     │ (개인 절세입력은 절대 안 감)
                          ┌──────────▼──────────┐
                          │  얇은 무상태 프록시   │  X-RP-API-Key 보관
                          │  (serverless fn)     │  CORS 허용
                          │  /api/rp/jobs        │  캐시(공개데이터)
                          │  /api/rp/company     │  레이트리밋
                          └──────────▼──────────┘
                                     │
                          https://openapi.rocketpunch.com/v1
```

**불변식**: 프록시로 가는 것은 *공개 채용/회사 질의*뿐. **나이·소득·투자액 등 절세 입력은
브라우저를 떠나지 않는다.** → "개인정보 서버 미전송" 약속을 형식적으로 유지.

- 프록시 책임: ① API Key 부착 ② CORS 허용 ③ 응답 캐시(공개데이터, 예 10분) ④ 레이트리밋/남용방지
  ⑤ 응답 필드 화이트리스트(필요 필드만 통과). **개인정보 수신·로깅 금지**가 설계 계약.
- 배포 형태(택1): Vite 정적 호스팅 + (a) Vercel/CF Functions 1개, 또는 (b) Cloudflare Worker.
  상태 없음 → 운영비·복잡도 최소.
- 프론트는 `RP_PROXY_BASE`(예 `/api/rp`)만 알면 됨. 키는 모름.

> 이 결정으로 DESIGN.md Q7은 "**개인 절세입력** 서버 미전송"으로 **정밀화**된다(공개 채용질의는 예외).
> 문구 고지도 그에 맞게 갱신.

---

## 4. 기능 ① 이직/연봉 변화 절세 시뮬레이터 (재설계)

### 4.1 재설계 핵심 — "공고에서 연봉을 불러온다"를 버리고, 가치를 분리

연봉이 API에 없으므로:
- **목표 연봉 = 사용자 입력**(슬라이더/직접입력). 공고는 *맥락 칩*(직군·숙련도·근무형태·회사규모)으로만 붙음.
- 공고 선택 시 **연봉 자동 채움이 아니라**, 숙련도(JUNIOR/SENIOR 등) 기반 *가이드 레인지 제안*
  (정적 추정표, "추정" 배지) + 사용자가 확정. 이 추정표는 외부 통계 기반이며 API와 무관.
- 따라서 **시뮬레이터의 핵심 가치(연봉 바뀌면 전략이 어떻게 바뀌나)는 API 없이도 100% 성립.**
  API는 "이 *실제* 공고로 이직하면" 서사를 입히는 부가 레이어.

### 4.2 엔진은 이미 다 있다 — `diffScenarios`(순수함수, API 불요)

`recommend(user, rules)`가 이미 순수함수이고, `marginalRate(income, brackets)`가 소득에
따라 ISA 소득공제 효율(`incomeDeduction`: efficiency = rate × marginalRate)과 청년상품 게이트
(`incomeCap`)를 모두 좌우한다. 즉 **연소득만 바꿔 두 번 호출하고 diff**하면 끝.

```ts
// engine/scenario.ts  (신규, 순수함수 — 설계 시그니처)
export interface ScenarioDelta {
  base: Recommendation;        // 현재 연봉
  scenario: Recommendation;    // 가정 연봉
  marginalRateChange: { from: number; to: number };
  // 자격을 새로 얻은/잃은 상품 (incomeCap 교차)
  gained: string[];            // productId[]
  lost: string[];              // ← "지금 가입 안 하면 이직 후 자격상실" 후크의 근거
  // 워터폴 효율/금액 변화
  efficiencyShift: Array<{ productId: string; from: number; to: number }>;
  netAfterTaxBenefitChange: number; // 첫 해 총 세제혜택 차이(원)
}
export function diffScenarios(
  user: UserProfile, scenarioIncome: number, rules: RuleSet
): ScenarioDelta;
```

`lost`/`gained`는 `base.waterfall ∪ urgent`의 productId 집합과 `scenario`의 집합 차집합으로 계산.
**4,400만→6,000만**: 청년미래적금은 둘 다 가입가능(상한 7,500만)이나 *우대형 tier 이탈* →
`efficiencyShift`로 표현. **7,500만 초과 점프**에서 비로소 `lost`에 들어감 → 그때 긴급 후크 강화.

### 4.3 API 연동 레이어 (부가)

```ts
// data/jobs.ts (프록시 경유)
interface JobChip {                 // 화면에 붙는 관심 공고 칩
  jobId: number; title: string; companyName: string;
  companySize: CompanySize;         // 기능②와 공유
  seniority?: Seniority;            // 연봉 가이드 레인지 매핑용
  jobCategory: string; webUrl: string;
}
async function searchJobs(q: {keyword?; jobCategories?; companySizes?; seniorities?; page?}): Promise<Page<JobChip>>;
```

UX: 관심 공고 검색 → 칩 추가 → "이 공고로 이직 가정" 토글 → 목표 연봉 입력(or 가이드 레인지) →
**현재 vs 가정 2열 비교** + Δ 강조(효율↑, tier 변화, 자격 상실 D-day 후크).

### 4.4 기능 ① 작업 분해

1. (엔진) `engine/scenario.ts` + 완전탐색 대비 단위테스트(임계 연봉 교차 케이스: 3,600/6,000/7,500만).
2. (프록시) `/api/rp/jobs` 1개 라우트(필드 화이트리스트, 캐시).
3. (데이터) `data/jobs.ts` fetch 래퍼 + `seniority→연봉 가이드 레인지` 정적표(`추정` 태그).
4. (UI) 공고 검색·칩, 2열 비교 뷰, Δ 배지.
5. (문구) "공고 연봉은 추정/사용자입력" 고지 배지.

**난이도: 낮음~중.** 엔진 변경 거의 없음(추가만). 위험은 UI/프록시.

---

## 5. 기능 ② 청년·중소기업 자격 자동판정 (재설계)

### 5.1 정직한 가치 산정 (먼저)

- **법적 함정**: 로켓펀치 `size`(TINY~HUGE)는 *임직원 수 기반 자체 분류*로 추정되며,
  세법상 중소기업(조특법 §2 / 중소기업기본법: **업종별 매출액·자산총액 + 독립성 + 상시근로자**)과
  **정의가 다르다.** → "중소기업이다/아니다"를 **단정하면 안 된다.** 힌트로만.
- **대상 상품 부족**: 현 MVP 7종 중 중소기업 재직을 *게이트*로 쓰는 상품은 **0개.**
  중소기업은 `TAX_SAVING.md:227`에서 청년미래적금 **우대형 분류** 뉘앙스로 1회 등장(미모델링).
  → 회사규모로 *새 상품을 해금*하는 효과는 사실상 없음. **"추정 가구중위소득 배지"류를 줄이고
  우대형 tier 신뢰도를 올리는" 보조 가치**가 현실적 상한.

> 결론: 기능 ②는 "신규 자격 해금"이 아니라 **추정값→실데이터 치환으로 추천 신뢰도↑**로
> 포지셔닝해야 정직하다. ROI가 ①보다 낮으므로 **v1.1로 후순위 권장.**

### 5.2 스키마 확장 (모델링)

회사규모를 자격에 반영하려면 게이트 어휘를 추가해야 한다(현 `Eligibility`엔 SME 개념 없음):

```ts
// rules/schema.ts 확장
export type CompanySize = "TINY" | "SMALL" | "MEDIUM" | "LARGE" | "HUGE";

interface Eligibility {
  // ...기존...
  /** 중소기업 재직 요구(법적 정의≠규모enum → 힌트 게이트). */
  requiresSmeEmployer?: Sourced<boolean>;
}

interface UserProfile {
  // ...기존...
  employerSize?: CompanySize;     // 프록시 조회 or 수동선택. 미입력=가정 유지
  employerIndustry?: string;
}
```

판정 로직(보수+포용 원칙 유지): `requiresSmeEmployer`가 confirmed인 상품에서
`employerSize ∈ {TINY,SMALL,MEDIUM}`이면 *우대 tier 후보* + **"규모 기준 추정, 법상 중소기업
여부는 별도 확인"** 배지. `LARGE/HUGE`면 우대 tier 제외(단정 아님, 배지로). 미입력이면 기존 가정 유지.

### 5.3 회사 조회 UX (제약 반영)

회사명 검색 API가 없으므로:
- 1차: 사용자가 **기능 ①의 공고 칩에서 회사를 이미 선택**했으면 `company.size` 재사용(추가호출 0).
- 2차(직접 조회): 회사명 입력 → `keyword`로 `/v1/jobs` 검색 → 후보 회사 리스트 제시 → 사용자가 선택
  (`companyId=handle`). **활성 공고 없는 회사는 조회 불가** → "수동 선택(중소/중견/대기업)" 폴백 제공.

### 5.4 기능 ② 작업 분해

1. (스키마) `Eligibility.requiresSmeEmployer` + `UserProfile.employerSize/Industry`.
2. (규칙) 청년미래적금 우대형에 `size` 보정 + `Sourced` 근거/`추정` 태그.
3. (엔진) `eligibility.checkGate`/`variantQualifies`에 size 분기(+배지). 완전탐색 테스트 갱신.
4. (데이터) `data/company.ts`(`searchCompanies`=jobs keyword 검색 어댑터) + 수동 폴백.
5. (UI) 회사 선택/배지, 법적 단서 고지.

**난이도: 중.** 엔진·스키마·규칙·테스트 동시 변경 → ①보다 침습적, 가치는 더 낮음.

---

## 6. 통합 구현 계획 (권장 순서)

| 단계 | 내용 | 산출물 | API 의존 |
|---|---|---|---|
| P0 | 🔴 App Key 회전, `.env`/시크릿 셋업 | 운영 안전 | — |
| P1 | `diffScenarios` 엔진 + 단위테스트, 2열 비교 UI (목표연봉 수동입력) | **기능 ① 핵심(API 없이 동작)** | ❌ |
| P2 | 얇은 프록시 1개(`/api/rp/jobs`) + 공고 검색/칩 | 기능 ① "실제 공고" 레이어 | ✅ |
| P3 | (선택) 회사규모 스키마 확장 + 자격 보정 + 회사 선택 UX | 기능 ② | ✅ |

P1이 가장 가치 높고 위험 낮음(엔진 재사용). P2로 서사 강화. P3는 ROI 검토 후 결정.

---

## 7. 리스크 / 미해결

- **스펙 신뢰성**: 문서 경로(`/api/v1`)와 실경로(`/v1`) 불일치 확인됨. 추후 스펙 변경 가능 → 프록시에
  base 경로 1곳 상수화, 헬스체크 1개 둘 것.
- **공고 연봉 부재**가 ①의 마케팅 메시지("공고 연봉으로")를 약화 → 메시지를 "*이직 시나리오*
  시뮬레이터"로 조정(연봉은 사용자/추정).
- **규모≠법상 중소기업**: 컴플라이언스상 단정 금지. 면책 문구에 명시.
- **레이트리밋/쿼터**: 로켓펀치 측 한도 미확인 → 프록시 캐시·디바운스로 호출 최소화.
- **CORS 401**: 프록시 불가피(이미 반영). 브라우저 직접호출 옵션은 폐기.
- **회사 검색 불가**: handle/활성공고 의존 → 수동 폴백 필수.

---

## 8. 구현 가능성 최종 평가

| 항목 | 가능? | 비고 |
|---|---|---|
| 기능 ① 시나리오 엔진(diff) | ✅ 확실 | 기존 순수엔진 재사용, API 불요 |
| 기능 ① 실제 공고 맥락 | ✅ (프록시 필요) | 연봉 자동적용만 불가 |
| 기능 ② 회사규모 힌트 | ⚠️ 부분 | 데이터 있음, 법적판정 아님, 대상상품 빈약 → v1.1 |
| 프라이버시 불변식 유지 | ✅ | 절세입력은 브라우저 잔류, 공개질의만 프록시 |
| 백엔드 0 유지(Q7 원형) | ❌ | 얇은 무상태 프록시로 정밀화 필요 |
