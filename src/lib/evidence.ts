/**
 * Repo facts → tiered evidence with reasons. PLAN.md §5.
 *
 *   mentioned     repo language / topics / description, or resume text
 *   described     the README talks about it (quoted)
 *   demonstrated  a manifest lists it AND matching source files exist, or enough source files prove it
 *   shipped       demonstrated, plus tests, CI, or a live deploy in the same repo
 *
 * Pure: no fetching. `github.ts` produces RepoFacts; tests build them by hand.
 */
import { ECOSYSTEM_EXTS, type Manifest } from './manifests';
import { SKILLS, findSkill, packageMatches, topicText, type Skill } from './skills';
import { tierRank, type CandidateProfile, type EvidenceItem, type RepoSummary, type Tier } from './types';

/**
 * Bump whenever repo selection, the taxonomy or tier rules change. It is part of every cache key, so a
 * deploy never serves evidence computed by older rules (it happened: a 6-repo profile outlived the 9-repo change).
 */
export const EVIDENCE_VERSION = 5;

export interface RepoFacts {
  summary: RepoSummary;
  /** File paths from the git tree, vendored/generated dirs already removed. */
  paths: string[];
  /** Raw README markdown ('' if none). */
  readme: string;
  manifests: Manifest[];
}

const VENDORED = /(^|\/)(node_modules|vendor|dist|build|out|\.venv|venv|env|site-packages|__pycache__|\.next|\.astro|coverage|third_party|\.git)\//;
export const isVendored = (path: string) => VENDORED.test(path);

const DEPLOY_HOSTS = /https?:\/\/[^\s)"'>]*\b(vercel\.app|netlify\.app|pages\.dev|workers\.dev|streamlit\.app|hf\.space|huggingface\.co\/spaces|fly\.dev|onrender\.com|railway\.app|github\.io|herokuapp\.com)[^\s)"'>]*/i;

const ext = (p: string) => {
  const base = p.slice(p.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot).toLowerCase() : '';
};

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** Package markers carry no evidence and make poor examples. */
const isBoilerplate = (p: string) => /(^|\/)__init__\.py$/.test(p);

// --- README prose ------------------------------------------------------------------------------

/** Markdown → plain prose, so quotes read like sentences and code samples don't count as claims. */
export function readmeText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+>|]\s?/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[*_]{1,3}([^*_\n]+)[*_]{1,3}/g, '$1')
    .replace(/[ \t]+/g, ' ');
}

/** Emoji and pictographs from READMEs and descriptions: decoration, not evidence. */
const PICTOGRAPHS = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]️?‍?/gu;

/**
 * The sentence or line around `index`, trimmed to ~`max` chars. Trimming happens at word boundaries: a quote
 * cut mid-word ("…ong software engineering") reads as careless extraction, which a credibility product can't afford.
 */
export function snippet(text: string, index: number, max = 120): string {
  const before = text.slice(0, index);
  const start = Math.max(before.lastIndexOf('\n'), before.search(/[.!?]\s[^.!?]*$/) + 1, 0);
  const tail = text.slice(index);
  const endRel = tail.search(/[.!?](\s|$)|\n/);
  const raw = text.slice(start, endRel === -1 ? text.length : index + endRel + 1);
  // Position of the match inside the cleaned sentence, so the window stays centred on it.
  const lead = raw.slice(0, index - start).replace(PICTOGRAPHS, '').replace(/\s+/g, ' ').trimStart().length;
  const s = raw.replace(PICTOGRAPHS, '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;

  let from = Math.max(0, lead - Math.floor(max / 3));
  let to = Math.min(s.length, from + max);
  if (from > 0) {
    const space = s.indexOf(' ', from);
    from = space === -1 || space > lead ? from : space + 1;
  }
  if (to < s.length) {
    const space = s.lastIndexOf(' ', to);
    to = space > from ? space : to;
  }
  return `${from > 0 ? '…' : ''}${s.slice(from, to).trim()}${to < s.length ? '…' : ''}`;
}

// --- per-repo ----------------------------------------------------------------------------------

interface RepoSignals {
  byExt: Map<string, number>;
  testFiles: string[];
  ciFiles: string[];
  deployUrl: string | null;
  prose: string;
}

type ShipKind = 'tests' | 'ci' | 'deploy';

/** A skill's own signal isn't repeated as a "shipped" extra (Testing doesn't also get "has tests"). */
const OWN_SHIP_KIND: Record<string, ShipKind> = { testing: 'tests', 'ci-cd': 'ci' };

function repoSignals(facts: RepoFacts): RepoSignals {
  const byExt = new Map<string, number>();
  for (const p of facts.paths) {
    const e = ext(p);
    if (e) byExt.set(e, (byExt.get(e) ?? 0) + 1);
  }
  const testing = SKILLS.find((s) => s.id === 'testing')!;
  const prose = readmeText(facts.readme);
  const home = facts.summary.homepage && /^https?:\/\//.test(facts.summary.homepage) ? facts.summary.homepage : null;
  return {
    byExt,
    testFiles: facts.paths.filter((p) => !isBoilerplate(p) && testing.paths!.some((re) => re.test(p))),
    ciFiles: facts.paths.filter((p) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p) || p === '.gitlab-ci.yml'),
    deployUrl: home ?? facts.readme.match(DEPLOY_HOSTS)?.[0] ?? null,
    prose,
  };
}

const countExts = (sig: RepoSignals, exts: string[]) => exts.reduce((n, e) => n + (sig.byExt.get(e) ?? 0), 0);

/** Deepest folder shared by every path ('' if none). */
function commonDir(paths: string[]): string {
  const dirs = paths.map((p) => p.split('/').slice(0, -1));
  const first = dirs[0] ?? [];
  let n = 0;
  while (n < first.length && dirs.every((d) => d[n] === first[n])) n++;
  return first.slice(0, n).join('/');
}

/** Where matched files live: "in `evals/`", "`Dockerfile`, `compose.yml`", or "e.g. `agent/graph.py`". */
export function where(paths: string[]): string {
  const dir = commonDir(paths);
  if (dir) return `in \`${dir}/\``;
  if (paths.length <= 3) return paths.map((p) => `\`${p}\``).join(', ');
  return `e.g. \`${paths[0]}\``;
}

function demonstrated(skill: Skill, facts: RepoFacts, sig: RepoSignals): string[] {
  const reasons: string[] = [];

  for (const m of facts.manifests) {
    const hits = m.deps.filter((d) => packageMatches(skill, d));
    const src = countExts(sig, ECOSYSTEM_EXTS[m.ecosystem]);
    if (hits.length && src > 0) {
      reasons.push(`\`${m.path}\` lists ${hits.slice(0, 3).join(', ')} · ${plural(src, 'source file')}`);
      break;
    }
  }

  if (skill.exts) {
    const n = countExts(sig, skill.exts);
    if (n >= (skill.minFiles ?? 5)) reasons.push(`${n} ${skill.exts.filter((e) => sig.byExt.get(e)).join('/')} files`);
  }

  if (skill.paths) {
    const files = facts.paths.filter((p) => !isBoilerplate(p) && skill.paths!.some((re) => re.test(p)));
    if (files.length >= (skill.minFiles ?? 2)) {
      const label = skill.id === 'ci-cd' ? plural(files.length, 'workflow') : plural(files.length, 'file');
      reasons.push(`${label} ${where(files)}`);
    }
  }

  return reasons;
}

function shippedReasons(sig: RepoSignals): { kind: ShipKind; text: string }[] {
  const r: { kind: ShipKind; text: string }[] = [];
  if (sig.testFiles.length >= 2) r.push({ kind: 'tests', text: `${plural(sig.testFiles.length, 'test file')} ${where(sig.testFiles)}` });
  if (sig.ciFiles.length) r.push({ kind: 'ci', text: 'CI in `.github/workflows/`' });
  if (sig.deployUrl) r.push({ kind: 'deploy', text: `live at ${sig.deployUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}` });
  return r;
}

function ownershipNote(s: RepoSummary): string | null {
  if (!s.contributors || s.contributors <= 1) return null;
  const share = s.ownerShare == null ? '' : ` (${Math.round(s.ownerShare * 100)}% of commits)`;
  return `1 of ${s.contributors} contributors${share}`;
}

/** Best evidence per skill found in one repo. */
export function repoEvidence(facts: RepoFacts, skills: Skill[] = SKILLS): EvidenceItem[] {
  const sig = repoSignals(facts);
  const s = facts.summary;
  const ship = shippedReasons(sig);
  const owner = ownershipNote(s);
  const out: EvidenceItem[] = [];

  for (const skill of skills) {
    let tier: Tier | null = null;
    let reasons: string[] = [];

    const demo = demonstrated(skill, facts, sig);
    if (demo.length) {
      const extra = ship.filter((x) => x.kind !== OWN_SHIP_KIND[skill.id]).map((x) => x.text);
      tier = extra.length ? 'shipped' : 'demonstrated';
      reasons = [...demo, ...extra];
    } else {
      const at = findSkill(skill, sig.prose);
      if (at >= 0) {
        tier = 'described';
        reasons = [`README: “${snippet(sig.prose, at)}”`];
      } else {
        const mentions: string[] = [];
        if (s.language && skill.languages?.includes(s.language)) mentions.push(`repo language is ${s.language}`);
        const topics = s.topics.filter((t) => findSkill(skill, topicText([t])) >= 0);
        if (topics.length) mentions.push(`tagged ${topics.slice(0, 2).map((t) => `\`${t}\``).join(', ')}`);
        const d = findSkill(skill, s.description);
        if (d >= 0) mentions.push(`description: “${snippet(s.description, d)}”`);
        if (mentions.length) {
          tier = 'mentioned';
          reasons = mentions;
        }
      }
    }

    if (tier) {
      if (owner) reasons.push(owner);
      out.push({ skill: skill.id, tier, source: 'repo', repo: s.name, url: s.url, reasons });
    }
  }
  return out;
}

// --- profile -----------------------------------------------------------------------------------

const byStrength = (a: EvidenceItem, b: EvidenceItem) =>
  tierRank(b.tier) - tierRank(a.tier) || b.reasons.length - a.reasons.length;

/** Merge evidence items into per-skill lists, best first, at most `keep` per skill. */
export function mergeEvidence(items: EvidenceItem[], keep = 3): Record<string, EvidenceItem[]> {
  const out: Record<string, EvidenceItem[]> = {};
  for (const it of items) (out[it.skill] ??= []).push(it);
  for (const k of Object.keys(out)) out[k] = out[k].sort(byStrength).slice(0, keep);
  return out;
}

export function buildProfile(
  user: { login: string; name: string | null; avatarUrl: string | null },
  repos: RepoFacts[],
  reposConsidered: number,
): CandidateProfile {
  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatarUrl,
    profileUrl: `https://github.com/${user.login}`,
    repos: repos.map((r) => r.summary),
    evidence: mergeEvidence(repos.flatMap((r) => repoEvidence(r))),
    reposConsidered,
    fetchedAt: new Date().toISOString(),
  };
}

/** Resume text → Mentioned-only evidence. Runs in the browser; the text never leaves it. */
export function resumeEvidence(text: string, skills: Skill[] = SKILLS): EvidenceItem[] {
  const prose = text.replace(/\s+/g, ' ');
  return skills.flatMap((skill) => {
    const at = findSkill(skill, prose);
    return at < 0 ? [] : [{ skill: skill.id, tier: 'mentioned' as const, source: 'resume' as const, reasons: [`resume: “${snippet(prose, at, 90)}”`] }];
  });
}

/** Add resume items to a profile's evidence without letting them outrank repo evidence. */
export function withResume(evidence: Record<string, EvidenceItem[]>, resume: EvidenceItem[]): Record<string, EvidenceItem[]> {
  return mergeEvidence([...Object.values(evidence).flat(), ...resume], 4);
}
