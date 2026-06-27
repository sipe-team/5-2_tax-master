# tax-master 기능 우선순위 (Feature Prioritization v1)

> pm-product-discovery `prioritize-features` 프레임 기반: Impact × Effort × Risk × 전략정합.
> 후보는 [`COMPETITIVE_ANALYSIS.md`](./COMPETITIVE_ANALYSIS.md)의 차별점 갭에서 도출.
> 전략 앵커: "7종 통합 워터폴 + 한시 D-day + 근거 투명/서버 미전송" (DESIGN.md).

---

## 후보 기능 4종

| ID | 기능 | 한 줄 |
|---|---|---|
| **A** | 절세 캘린더 (.ics D-day 내보내기) | 긴급 트랙의 마감일을 `.ics`로 내보내 캘린더에 D-day 알림 등록 |
| **B** | "왜 이 순서인지" 근거 토글 | 워터폴 각 줄에 효율 수치·법령 근거를 펼침으로 노출 |
| **C** | 결과 공유 카드 (개인정보 없이) | 입력값을 URL 쿼리스트링에 인코딩해 링크/이미지로 공유 |
| **D** | "놓친 절세" 역산 배지 | 적격인데 안 챙긴 항목을 "놓치면 OO만원"으로 경고 |

---

## 평가 (1=낮음 ~ 5=높음, Effort/Risk는 낮을수록 좋음)

| ID | Impact | Effort | Risk | 전략정합 | 비고 |
|---|:--:|:--:|:--:|:--:|---|
| **A** 절세 캘린더 | 5 | 2 | 1 | 5 | 긴급 트랙(킬러 차별점)을 직접 강화. `UrgentAction`에 deadline/dDay 이미 존재 → 순수함수 1개 + 버튼. 백엔드 불필요. **무주공산**(경쟁자 없음). |
| **B** 근거 토글 | 4 | 2 | 1 | 5 | "설명가능성=핵심가치"(DESIGN Q8)를 UI로 구현. `Allocation`에 efficiency/firstYearBenefit/rationale 존재. 다만 법령 근거 텍스트를 규칙 데이터에서 UI까지 노출하는 배선 필요. |
| **C** 공유 카드 | 3 | 3 | 2 | 4 | 바이럴 채널(콘텐츠 경쟁 대응). URL 인코딩은 서버 미전송 원칙 유지. 단 이미지 카드(OG)는 정적 호스팅/메타 필요 → 범위 커질 수 있음. 입력 복원(딥링크)부터가 MVP. |
| **D** 놓친 절세 배지 | 4 | 3 | 3 | 4 | 손실회피 후크로 전환율↑ 기대. 단 "적격인데 미반영" 판정이 자격엔진과 얽혀 **오탐 시 신뢰 훼손**(자문 아님 포지션과 충돌 위험) → 카피·정확도 신중. |

> 점수는 합의 시작점(앵커)이며 팀 리뷰로 조정 대상.

---

## 우선순위 결론 (Now / Next / Later)

### 🟢 Now — 이번 PR에서 구현
- **A. 절세 캘린더 (.ics 내보내기)**
  - 근거: Impact 5 / Effort 2 / Risk 1 / 전략정합 5 — **최고 ROI**.
  - 긴급 트랙은 리서치상 경쟁자가 비운 무주공산인데, "보기"에서 "내 캘린더에 등록"으로 행동을 한 단계 더 밀어줌.
  - 기존 `UrgentAction`(deadline·dDay·description) 재사용 → 순수 함수 + 버튼으로 작게 끝남. 서버/의존성 추가 없음.

### 🟡 Next — 다음 스프린트
- **B. 근거 토글** — 핵심가치(설명가능성)와 정합 최고. 규칙 데이터의 법령 근거를 UI까지 잇는 작업을 별도로.
- **D. 놓친 절세 배지** — 전환 임팩트 크나, 오탐 리스크 관리(카피·정확도 게이트) 후 도입.

### ⚪ Later — 검증 후
- **C. 공유 카드** — 딥링크(입력 복원)부터 MVP로. OG 이미지 카드는 정적 호스팅 결정 후. 그로스 단계 진입 시.

---

## A 기능 구현 메모 (이 PR)
- `engine/calendar.ts`: `buildCalendar(actions, asOf) → string`(RFC 5545 VCALENDAR). 순수 함수, 부수효과 없음.
  - 각 `UrgentAction` → 종일 VEVENT (마감일). `VALARM`으로 7일 전 알림(D-7).
  - 결정론 유지를 위해 UID/DTSTAMP는 입력(productId·asOf)에서 파생 — `Date.now()`/랜덤 미사용(엔진 결정론 원칙·테스트 가능성).
- `engine/__tests__/calendar.test.ts`: VEVENT 개수·필수 필드·CRLF·이스케이프 검증.
- `App.tsx`: 긴급 섹션에 "📅 캘린더에 추가" 버튼 → Blob 다운로드(브라우저 전용, 서버 미전송 유지).
