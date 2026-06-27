/**
 * 로켓펀치 채용공고 검색 클라이언트 (DESIGN_ROCKETPUNCH §4.3).
 *
 * 브라우저 → **얇은 프록시(/api/rp)** → 로켓펀치. API Key는 프록시에만 있고
 * 브라우저는 모른다. 개인 절세입력(나이·소득 등)은 절대 이 레이어로 가지 않는다.
 */

import type { IncomeType } from "../rules/schema";

export type CompanySize = "TINY" | "SMALL" | "MEDIUM" | "LARGE" | "HUGE";
export type Seniority = "BEGINNER" | "JUNIOR" | "MIDLEVEL" | "SENIOR" | "EXECUTIVE";
export type WorkType = "ONSITE" | "HYBRID" | "REMOTE";

/** 화면에 붙는 관심 공고 칩(프록시 화이트리스트 필드만). */
export interface JobChip {
  jobId: number;
  title: string;
  subtitle?: string;
  companyId: string;
  companyName: string;
  companySize?: CompanySize;
  companyIndustry?: string;
  /** 대표 숙련도(연봉 가이드 매핑용). seniorities[0]. */
  seniority?: Seniority;
  /** 고용형태 코드(소득유형 추정용). 예: FULL_TIME, FREELANCER. */
  employmentTypes?: string[];
  jobCategory?: string;
  workType?: WorkType;
  webUrl?: string;
}

// 고용형태 → 소득유형 추정 (근로 vs 사업·기타).
const EARNED_EMPLOYMENT = new Set(["FULL_TIME", "FIXED_TERM", "INTERN"]);
const COMPREHENSIVE_EMPLOYMENT = new Set(["FREELANCER", "SELF_EMPLOYED", "COMMISSIONED"]);

/**
 * 공고 고용형태로 소득유형(직장인 earned / 사업·기타 comprehensive) 추정.
 * 판단 불가하면 undefined(사용자 입력 유지). 둘 다 섞이면 근로 우선.
 */
export function inferIncomeType(employmentTypes?: string[]): IncomeType | undefined {
  if (!employmentTypes?.length) return undefined;
  if (employmentTypes.some((e) => EARNED_EMPLOYMENT.has(e))) return "earned";
  if (employmentTypes.some((e) => COMPREHENSIVE_EMPLOYMENT.has(e))) return "comprehensive";
  return undefined;
}

export interface Page<T> {
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface JobQuery {
  keyword?: string;
  companyId?: string;
  jobCategories?: string[];
  seniorities?: Seniority[];
  employmentTypes?: string[];
  companySizes?: CompanySize[];
  workTypes?: WorkType[];
  sort?: "RELEVANCE_DESC" | "DATE_DESC" | "POPULARITY_DESC";
  page?: number;
  pageSize?: number;
}

const PROXY_BASE = "/api/rp";

export class ProxyError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ProxyError";
    this.status = status;
  }
}

const COMPANY_SIZE_LABEL: Record<CompanySize, string> = {
  TINY: "초기/소규모",
  SMALL: "소기업",
  MEDIUM: "중기업",
  LARGE: "대기업",
  HUGE: "초대형",
};

export function companySizeLabel(size?: CompanySize): string {
  return size ? COMPANY_SIZE_LABEL[size] : "규모 미상";
}

interface RawJobItem {
  jobId: number;
  title: string;
  subtitle?: string;
  jobCategory?: string;
  seniorities?: string[];
  employmentTypes?: string[];
  workType?: WorkType;
  company?: {
    id?: string;
    name?: string;
    industry?: string;
    size?: CompanySize;
  };
  webUrl?: string;
}

function toChip(raw: RawJobItem): JobChip {
  return {
    jobId: raw.jobId,
    title: raw.title,
    subtitle: raw.subtitle,
    companyId: raw.company?.id ?? "",
    companyName: raw.company?.name ?? "(회사 미상)",
    companySize: raw.company?.size,
    companyIndustry: raw.company?.industry,
    seniority: (raw.seniorities?.[0] as Seniority | undefined) ?? undefined,
    employmentTypes: raw.employmentTypes,
    jobCategory: raw.jobCategory,
    workType: raw.workType,
    webUrl: raw.webUrl,
  };
}

export async function searchJobs(q: JobQuery): Promise<Page<JobChip>> {
  const params = new URLSearchParams();
  if (q.keyword) params.set("keyword", q.keyword);
  if (q.companyId) params.set("companyId", q.companyId);
  for (const v of q.jobCategories ?? []) params.append("jobCategories", v);
  for (const v of q.seniorities ?? []) params.append("seniorities", v);
  for (const v of q.employmentTypes ?? []) params.append("employmentTypes", v);
  for (const v of q.companySizes ?? []) params.append("companySizes", v);
  for (const v of q.workTypes ?? []) params.append("workTypes", v);
  if (q.sort) params.set("sort", q.sort);
  params.set("page", String(q.page ?? 1));
  params.set("pageSize", String(q.pageSize ?? 12));

  let res: Response;
  try {
    res = await fetch(`${PROXY_BASE}/jobs?${params.toString()}`);
  } catch {
    throw new ProxyError(0, "프록시에 연결할 수 없어요(dev 서버/네트워크 확인).");
  }

  if (!res.ok) {
    let msg = `프록시 오류 (HTTP ${res.status})`;
    if (res.status === 503) msg = "프록시에 RocketPunch 키가 설정되지 않았어요(.env.local).";
    throw new ProxyError(res.status, msg);
  }

  const data = (await res.json()) as Partial<Page<RawJobItem>>;
  return {
    totalItems: data.totalItems ?? 0,
    totalPages: data.totalPages ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 0,
    items: (data.items ?? []).map(toChip),
  };
}
