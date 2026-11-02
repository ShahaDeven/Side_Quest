import type { FunctionCount, Role, RoleSet } from './types';

export const API_BASE = 'https://speedrun-talent-network.com/api/v1';
export const SOURCE = 'side-quest';

type FetchFn = typeof fetch;

export interface FetchOptions {
  fetch?: FetchFn;
  /** Per-call timeout. PLAN.md: 3 s. */
  timeoutMs?: number;
}

// --- raw API shapes (only the fields we read) ---------------------------------------------------

export interface ApiJobListItem {
  id: string;
  title: string;
  company: string;
  /** `null` for stealth roles (company "Stealth"). */
  company_slug: string | null;
  stealth?: boolean;
  url: string;
  location: string | null;
  workplace_type: string | null;
  seniority: string | null;
  published_at: string | null;
}

export interface ApiJobDetail extends ApiJobListItem {
  status?: string;
  description_text?: string | null;
  labels?: { specialty?: string | null; ai_native_role?: boolean | null } | null;
}

export interface ApiCompany {
  slug: string;
  name: string;
  blurb?: string | null;
  industries?: string[] | null;
}

interface ApiJobListPage {
  jobs: ApiJobListItem[];
  total: number;
  page: number;
  total_pages: number;
  facets?: { fn?: { v: string; n: number }[] };
}

// --- fetching ----------------------------------------------------------------------------------

async function getJson<T>(path: string, params: Record<string, string>, opts: FetchOptions): Promise<T> {
  const f = opts.fetch ?? fetch;
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries({ ...params, source: SOURCE })) url.searchParams.set(k, v);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 3000);
  try {
    const res = await f(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`speedrun API ${res.status} for ${url.pathname}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface JobList {
  jobs: ApiJobListItem[];
  total: number;
  functionCounts: FunctionCount[];
}

/** Every page of `/jobs` for one function. `page` is 0-based, 50 per page. */
export async function fetchJobList(fn: string, opts: FetchOptions = {}): Promise<JobList> {
  const params = { scope: 'speedrun', fn };
  const first = await getJson<ApiJobListPage>('/jobs', { ...params, page: '0' }, opts);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.total_pages - 1) }, (_, i) =>
      getJson<ApiJobListPage>('/jobs', { ...params, page: String(i + 1) }, opts),
    ),
  );

  const seen = new Set<string>();
  const jobs = [first, ...rest]
    .flatMap((p) => p.jobs)
    .filter((j) => !seen.has(j.id) && seen.add(j.id));

  return {
    jobs,
    total: first.total,
    functionCounts: (first.facets?.fn ?? []).map(({ v, n }) => ({ fn: v, n })),
  };
}

export async function fetchJobDetail(id: string, opts: FetchOptions = {}): Promise<ApiJobDetail> {
  return (await getJson<{ job: ApiJobDetail }>(`/jobs/${encodeURIComponent(id)}`, {}, opts)).job;
}

export async function fetchCompany(slug: string, opts: FetchOptions = {}): Promise<ApiCompany> {
  return (await getJson<{ company: ApiCompany }>(`/companies/${encodeURIComponent(slug)}`, {}, opts)).company;
}

// --- normalizing -------------------------------------------------------------------------------

export function normalizeRole(job: ApiJobListItem | ApiJobDetail, company?: ApiCompany): Role {
  const detail = job as ApiJobDetail;
  return {
    id: job.id,
    title: job.title.trim(),
    company: job.company,
    companySlug: job.company_slug ?? null,
    stealth: job.stealth === true || job.company_slug == null,
    location: job.location,
    workplace: job.workplace_type,
    seniority: job.seniority,
    specialty: detail.labels?.specialty ?? null,
    aiNative: detail.labels?.ai_native_role === true,
    description: detail.description_text ?? '',
    blurb: company?.blurb ?? '',
    industries: company?.industries ?? [],
    url: job.url,
    publishedAt: job.published_at,
  };
}

/**
 * Bring a snapshot up to date with the live job list without refetching every detail.
 *
 * Cloudflare's free plan allows 50 external subrequests per invocation, so the Worker can't rebuild
 * 96 details + companies per request. Instead: live list (closed roles drop out, list fields refresh),
 * snapshot descriptions reused, and only roles new since the snapshot get a detail fetch, capped.
 */
export async function refreshRoleSet(
  snapshot: RoleSet,
  opts: FetchOptions & { maxNewDetails?: number } = {},
): Promise<RoleSet> {
  const list = await fetchJobList(snapshot.fn, opts);
  const known = new Map(snapshot.roles.map((r) => [r.id, r]));

  const fresh = list.jobs.filter((j) => !known.has(j.id)).slice(0, opts.maxNewDetails ?? 20);
  const details = new Map(
    (await Promise.allSettled(fresh.map((j) => fetchJobDetail(j.id, opts))))
      .flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
      .map((d) => [d.id, d]),
  );

  const roles = list.jobs.map((j) => {
    const prev = known.get(j.id);
    if (prev) return { ...prev, ...pickListFields(normalizeRole(j)) };
    // New role: company blurb comes from another snapshot role at the same company if we have one.
    const sameCompany = j.company_slug ? snapshot.roles.find((r) => r.companySlug === j.company_slug) : undefined;
    const company = sameCompany
      ? { slug: sameCompany.companySlug!, name: j.company, blurb: sameCompany.blurb, industries: sameCompany.industries }
      : undefined;
    return normalizeRole(details.get(j.id) ?? j, company);
  });

  return {
    fn: snapshot.fn,
    roles,
    total: list.total,
    functionCounts: list.functionCounts,
    fetchedAt: new Date().toISOString(),
    source: 'live',
  };
}

/** Fields the list endpoint is authoritative for; everything else stays from the snapshot. */
function pickListFields(r: Role): Partial<Role> {
  const { title, company, location, workplace, seniority, url, publishedAt } = r;
  return { title, company, location, workplace, seniority, url, publishedAt };
}
