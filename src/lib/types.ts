/** One speedrun role, normalized from the public API (see docs/api-notes.md). */
export interface Role {
  id: string;
  title: string;
  company: string;
  /** `null` for stealth roles: no company profile, no blurb. */
  companySlug: string | null;
  stealth: boolean;
  location: string | null;
  workplace: string | null;
  seniority: string | null;
  /** `labels.specialty` from the detail endpoint, e.g. "LLM apps and agents". */
  specialty: string | null;
  aiNative: boolean;
  /** Plain-text JD. Empty only for a brand-new role whose detail fetch hasn't happened yet. */
  description: string;
  blurb: string;
  industries: string[];
  /** Canonical speedrun job URL. Always link out to this; never re-host the listing. */
  url: string;
  publishedAt: string | null;
}

// --- evidence (PLAN.md §5) ---------------------------------------------------------------------

/**
 * Ordered weakest → strongest. Each level claims only what was checked:
 *   mentioned     a repo tag, the repo language, the description, or a resume line names it
 *   described     the README talks about it
 *   declared      a dependency file lists it, or matching files exist; no file read shows it in use
 *   demonstrated  files that were read use it (import it, or contain the skill's own code)
 *   shipped       demonstrated, and GitHub records a release, a successful deployment or a Pages site
 * Resume-only claims never get past `mentioned`. Tests and CI are practice notes; they never raise a level.
 */
export const TIERS = ['mentioned', 'described', 'declared', 'demonstrated', 'shipped'] as const;
export type Tier = (typeof TIERS)[number];

export const tierRank = (t: Tier) => TIERS.indexOf(t);

/** One reason a skill counts, from one source. Shown verbatim in the UI. */
export interface EvidenceItem {
  skill: string;
  tier: Tier;
  source: 'repo' | 'resume';
  /** Repo name, for `source: 'repo'`. */
  repo?: string;
  url?: string;
  /** Why it reached this level, strongest first, e.g. `imported in 3 of 6 files read, e.g. agent/graph.py`. */
  reasons: string[];
  /**
   * Context that never raises the level: tests that import the same package, the repo's CI and test suite, a
   * declared deploy URL (not checked), ownership. Absent on evidence read before notes existed.
   */
  notes?: string[];
}

/** What GitHub itself records about delivery. Free signals: no URL is ever requested to check a deploy. */
export interface Delivery {
  releases: number;
  latestRelease: string | null;
  /** Deployments whose latest status is success (Vercel, Netlify and Cloudflare integrations record these). */
  deployments: number;
  pages: boolean;
}

/** Public facts about a repo, shown next to its evidence. */
export interface RepoSummary {
  name: string;
  url: string;
  description: string;
  language: string | null;
  topics: string[];
  stars: number;
  pushedAt: string;
  homepage: string | null;
  /** Distinct contributors, and the candidate's share of commits (0–1). null if GitHub didn't say. */
  contributors: number | null;
  ownerShare: number | null;
}

/** What `/api/github/:user` returns. Raw files/READMEs stay on the server. */
export interface CandidateProfile {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  profileUrl: string;
  repos: RepoSummary[];
  /** Per skill, best evidence first. */
  evidence: Record<string, EvidenceItem[]>;
  /** How many public non-fork repos exist vs how many were read in depth. */
  reposConsidered: number;
  /** Whether source files were read. False (no token, or the request failed): nothing passes Declared. */
  codeRead?: boolean;
  fetchedAt: string;
}

// --- matching ----------------------------------------------------------------------------------

/** A skill the JD asks for, with how much it matters and the line that asked for it. */
export interface Requirement {
  skill: string;
  weight: number;
  /** The JD line it came from (trimmed), preferring a requirements-section line. */
  quote: string;
  inTitle: boolean;
  /** requirements > role (responsibilities, our stack) > nice-to-have > other (intro, benefits). */
  section: 'requirements' | 'role' | 'nice-to-have' | 'other';
}

export type Strength = 'strong' | 'some' | 'thin';

export interface CoveredRequirement extends Requirement {
  evidence: EvidenceItem;
}

export interface MissingRequirement extends Requirement {
  /** Best evidence we do have, if any (below demonstrated). */
  evidence: EvidenceItem | null;
}

export interface MatchResult {
  roleId: string;
  /** Requirements with demonstrated-or-better evidence. */
  covered: CoveredRequirement[];
  /** Requirements below demonstrated, heaviest first. */
  missing: MissingRequirement[];
  strength: Strength;
  /** Share of requirement weight backed by demonstrated+ evidence (0–1). For sorting, never shown as a %. */
  score: number;
  /** Up to 2 repos carrying the most requirement weight. */
  bestRepos: string[];
  /**
   * Why a high score still isn't "strong", so the UI never says "2 of 2 covered" next to "Some proof"
   * without explaining. null when the label follows from the score alone.
   */
  cappedBy: 'few-requirements' | 'few-core-covered' | null;
}

export interface FunctionCount {
  fn: string;
  n: number;
}

export interface RoleSet {
  /** Function this set covers (MVP: "engineering"). */
  fn: string;
  roles: Role[];
  /** `total` reported by the API for this function. The UI shows roles.length and flags any mismatch. */
  total: number;
  /** Counts for every function, used for the "coming next" scope label. */
  functionCounts: FunctionCount[];
  fetchedAt: string;
  source: 'live' | 'snapshot';
}
