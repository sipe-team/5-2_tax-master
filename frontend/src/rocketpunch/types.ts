/**
 * 로켓펀치 Open API 응답 타입 (실제 호출로 검증된 필드만).
 * 검증 출처: data/rocketpunch/API_VERIFIED.md
 */

export interface Paged<T> {
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface RpCompany {
  id: string;
  name: string;
  logoUrl?: string | null;
  industry?: string | null;
  size?: string | null;
}

/** /v1/jobs 목록 아이템 (연봉 필드는 API에 없음). */
export interface RpJob {
  jobId: number;
  title: string;
  subtitle?: string | null;
  jobCategory: string; // dataAi | dev | finance | manage | marketingPr | salesCs | strategy ...
  seniorities: string[]; // BEGINNER | JUNIOR | MIDLEVEL | SENIOR ...
  employmentTypes: string[]; // FULL_TIME | FIXED_TERM | COMMISSIONED | INTERN ...
  workType: string; // ONSITE | REMOTE ...
  company: RpCompany;
  endAt?: string | null;
  webUrl: string;
}

export interface RpEventLocation {
  country?: string | null;
  region?: string | null;
  locality?: string | null;
}

/** /v1/events 목록 아이템. */
export interface RpEvent {
  eventId: string;
  eventName: string;
  eventCategories: string[]; // BUSINESS | COMPETITION | CONFERENCE | FAIR | LIFESTYLE | NETWORKING
  eventSubjects: string[]; // BUSINESS | CULTURE | FINANCE | HUMANITIES | PRODUCT | TECHNOLOGY
  startAt?: string | null;
  endAt?: string | null;
  eventOpenType?: string | null; // OFFLINE | ONLINE
  location?: RpEventLocation | null;
  bannerUrl?: string | null;
  hosts?: unknown;
  stats?: unknown;
  webUrl: string;
}
