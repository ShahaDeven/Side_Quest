/**
 * GitHub public API → RepoFacts. Runs on the server (Worker or script), never in the browser.
 *
 * Budget per profile (Worker free plan allows 50 subrequests): 1 user + 1 repo list, then for up to
 * MAX_REPOS repos a tree, README and contributors call (3 each), then dependency manifests from whatever
 * is left of SUBREQUEST_BUDGET, highest-priority repos first, ≤ 2 per repo.
 */
import { isVendored, type RepoFacts } from './evidence';
import { manifestKind, parseManifest, type Ecosystem, type Manifest } from './manifests';
import { SKILLS, findSkill, topicText } from './skills';
import type { RepoSummary } from './types';

const API = 'https://api.github.com';
export const MAX_REPOS = 9;
/** Total GitHub calls per profile; leaves headroom under the Worker's 50. */
export const SUBREQUEST_BUDGET = 46;
const MAX_MANIFESTS = 2;
const README_CAP = 40_000;

export class GitHubError extends Error {
  readonly kind: 'not-found' | 'rate-limited' | 'failed';
  readonly resetAt: string | null;
  constructor(kind: GitHubError['kind'], message: string, resetAt: string | null = null) {
    super(message);
    this.kind = kind;
    this.resetAt = resetAt;
  }
}

export interface GitHubOptions {
  token?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

interface ApiUser {
  login: string;
  name: string | null;
  avatar_url: string | null;
}

export interface ApiRepo {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  pushed_at: string;
  homepage: string | null;
  fork: boolean;
  archived: boolean;
  size: number;
  default_branch: string;
}

/** A 403 is a rate limit only when GitHub says so: no calls left, or a (secondary) rate-limit message. */
async function isRateLimit(res: Response): Promise<boolean> {
  if (res.headers.get('x-ratelimit-remaining') === '0') return true;
  const body = await res
    .clone()
    .text()
    .catch(() => '');
  return /rate limit/i.test(body);
}

function client(opts: GitHubOptions) {
  const f = opts.fetch ?? fetch;
  return async function gh(path: string, accept = 'application/vnd.github+json'): Promise<Response | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
    try {
      const res = await f(API + path, {
        signal: ctrl.signal,
        headers: {
          accept,
          'user-agent': 'side-quest',
          'x-github-api-version': '2022-11-28',
          ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        },
      });
      if (res.status === 404 || res.status === 409 /* empty repo */) return null;
      if (res.status === 429 || (res.status === 403 && (await isRateLimit(res)))) {
        const reset = res.headers.get('x-ratelimit-reset');
        throw new GitHubError('rate-limited', 'GitHub rate limit reached', reset ? new Date(Number(reset) * 1000).toISOString() : null);
      }
      // Any other 403 refuses this one resource, e.g. "contributor list is too large" on torvalds/linux.
      // Skip that piece of evidence instead of failing the whole profile.
      if (res.status === 403) return null;
      if (!res.ok) throw new GitHubError('failed', `GitHub ${res.status} for ${path}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Taxonomy skills a repo's own metadata (name, description, topics, language) points at. */
export function repoSkills(r: ApiRepo): Set<string> {
  const text = `${r.name.replace(/[-_]/g, ' ')} · ${r.description ?? ''} · ${topicText(r.topics ?? [])}`;
  return new Set(SKILLS.filter((s) => findSkill(s, text) >= 0 || (r.language && s.languages?.includes(r.language))).map((s) => s.id));
}

/** Skills already covered by earlier picks still count a little: depth matters, just less than breadth. */
const OVERLAP_CREDIT = 0.1;

/**
 * Owned, non-fork, non-archived, non-empty repos, in reading order. Greedy for coverage: each next repo
 * is the one adding the most skills not yet signalled, so the only fine-tuning repo beats a fifth agents
 * repo. Ties → recently pushed, described repos first.
 */
export function selectRepos(repos: ApiRepo[], login: string, now = Date.now()): ApiRepo[] {
  const pool = repos
    .filter((r) => !r.fork && !r.archived && r.size > 0 && r.name.toLowerCase() !== login.toLowerCase())
    .map((r) => ({
      r,
      skills: repoSkills(r),
      bonus: (now - Date.parse(r.pushed_at) < 180 * 864e5 ? 1 : 0) + (r.description ? 0.5 : 0),
    }));

  const covered = new Set<string>();
  const order: ApiRepo[] = [];
  while (pool.length) {
    let best = 0;
    let bestScore = -Infinity;
    pool.forEach((c, i) => {
      let fresh = 0;
      for (const s of c.skills) if (!covered.has(s)) fresh++;
      const score = fresh + OVERLAP_CREDIT * (c.skills.size - fresh) + c.bonus;
      const tie = score === bestScore && Date.parse(c.r.pushed_at) > Date.parse(pool[best].r.pushed_at);
      if (score > bestScore || tie) {
        best = i;
        bestScore = score;
      }
    });
    const [pick] = pool.splice(best, 1);
    pick.skills.forEach((s) => covered.add(s));
    order.push(pick.r);
  }
  return order;
}

/** Shallowest manifest per ecosystem first, so a monorepo's frontend and backend both get read. */
export function pickManifests(paths: string[], max = MAX_MANIFESTS): string[] {
  // pyproject.toml beats requirements*.txt at the same depth (it usually lists everything).
  const rank = (p: string) => (p.endsWith('pyproject.toml') ? 0 : 1);
  const candidates = paths
    .filter((p) => manifestKind(p) && !isVendored(p))
    .sort((a, b) => a.split('/').length - b.split('/').length || rank(a) - rank(b));
  const picked: string[] = [];
  const seen = new Set<Ecosystem>();
  for (const p of candidates) {
    const k = manifestKind(p)!;
    if (!seen.has(k)) {
      seen.add(k);
      picked.push(p);
    }
  }
  for (const p of candidates) if (picked.length < max && !picked.includes(p)) picked.push(p);
  return picked.slice(0, max);
}

const repoBase = (owner: string, r: ApiRepo) => `/repos/${owner}/${encodeURIComponent(r.name)}`;

/** Phase 1 (3 calls): tree, README, contributors. Manifests come later, from the leftover budget. */
async function readRepoCore(gh: ReturnType<typeof client>, owner: string, r: ApiRepo): Promise<RepoFacts> {
  const base = repoBase(owner, r);
  const branch = encodeURIComponent(r.default_branch);

  const [treeRes, readmeRes, contribRes] = await Promise.all([
    gh(`${base}/git/trees/${branch}?recursive=1`),
    gh(`${base}/readme`, 'application/vnd.github.raw+json'),
    gh(`${base}/contributors?per_page=100`),
  ]);

  const tree = treeRes ? ((await treeRes.json()) as { tree?: { path: string; type: string }[] }) : { tree: [] };
  const paths = (tree.tree ?? []).filter((t) => t.type === 'blob' && !isVendored(t.path)).map((t) => t.path);
  const readme = readmeRes ? (await readmeRes.text()).slice(0, README_CAP) : '';

  let contributors: number | null = null;
  let ownerShare: number | null = null;
  if (contribRes && contribRes.status === 200) {
    const list = (await contribRes.json()) as { login?: string; contributions: number }[];
    if (Array.isArray(list) && list.length) {
      contributors = list.length;
      const total = list.reduce((n, c) => n + c.contributions, 0);
      const mine = list.find((c) => c.login?.toLowerCase() === owner.toLowerCase())?.contributions ?? 0;
      ownerShare = total ? mine / total : null;
    }
  }

  const summary: RepoSummary = {
    name: r.name,
    url: r.html_url,
    description: r.description ?? '',
    language: r.language,
    topics: r.topics ?? [],
    stars: r.stargazers_count,
    pushedAt: r.pushed_at,
    homepage: r.homepage || null,
    contributors,
    ownerShare,
  };
  return { summary, paths, readme, manifests: [] };
}

async function readManifest(gh: ReturnType<typeof client>, owner: string, r: ApiRepo, path: string): Promise<Manifest | null> {
  const url = `${repoBase(owner, r)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(r.default_branch)}`;
  const res = await gh(url, 'application/vnd.github.raw+json');
  return res ? parseManifest(path, await res.text()) : null;
}

/**
 * Spread `budget` manifest reads over repos in priority order: everyone's first manifest before anyone's
 * second, so a low-priority repo isn't starved by a monorepo above it.
 */
export function planManifests(wanted: string[][], budget: number): string[][] {
  const plan = wanted.map(() => [] as string[]);
  for (let round = 0; round < MAX_MANIFESTS && budget > 0; round++) {
    wanted.forEach((paths, i) => {
      if (budget > 0 && paths[round]) {
        plan[i].push(paths[round]);
        budget--;
      }
    });
  }
  return plan;
}

export interface FetchedProfile {
  user: { login: string; name: string | null; avatarUrl: string | null };
  repos: RepoFacts[];
  reposConsidered: number;
}

export async function fetchProfileFacts(login: string, opts: GitHubOptions = {}): Promise<FetchedProfile> {
  const gh = client(opts);
  const userRes = await gh(`/users/${encodeURIComponent(login)}`);
  if (!userRes) throw new GitHubError('not-found', `GitHub user ${login} not found`);
  const user = (await userRes.json()) as ApiUser;

  const reposRes = await gh(`/users/${encodeURIComponent(user.login)}/repos?per_page=100&type=owner&sort=pushed`);
  const all = reposRes ? ((await reposRes.json()) as ApiRepo[]) : [];
  const eligible = selectRepos(all, user.login);

  const chosen = eligible.slice(0, MAX_REPOS);
  const repos = await Promise.all(chosen.map((r) => readRepoCore(gh, user.login, r)));

  const left = SUBREQUEST_BUDGET - 2 - 3 * chosen.length;
  const plan = planManifests(repos.map((f) => pickManifests(f.paths)), left);
  await Promise.all(
    plan.map(async (paths, i) => {
      const ms = await Promise.all(paths.map((p) => readManifest(gh, user.login, chosen[i], p)));
      repos[i].manifests = ms.filter((m): m is Manifest => m !== null);
    }),
  );

  return {
    user: { login: user.login, name: user.name, avatarUrl: user.avatar_url },
    repos,
    reposConsidered: eligible.length,
  };
}

export const isValidLogin = (s: string) => /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(s);
