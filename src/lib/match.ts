/**
 * Role requirements × candidate evidence → MatchResult, and the side-quest gate. PLAN.md §2, §5.
 * Pure and deterministic; runs in the browser over every role.
 */
import { snippet } from './evidence';
import { SKILLS, countSkill, findSkill, type Skill } from './skills';
import {
  tierRank,
  type CoveredRequirement,
  type EvidenceItem,
  type MatchResult,
  type MissingRequirement,
  type Requirement,
  type Role,
  type Strength,
} from './types';

// --- JD → requirements -------------------------------------------------------------------------

type Section = Requirement['section'];

// Order matters: nice-to-have beats requirements ("Preferred Qualifications"), other beats role.
const NICE_HEADING = /(nice[- ]to[- ]haves?|bonus|preferred|pluses|plus if|extra credit)/i;
const REQ_HEADING = /(requirements|qualifications|you have|you'll have|you bring|must[- ]haves?|what we('| a)re looking for|we('| a)re looking for|who you are|you should have|for this role|good fit|about you|what you'll need|skills)/i;
const OTHER_HEADING = /(benefits|perks|what we offer|compensation|about us|about the company|about [A-Z]\w+$|who we are|why join|location|salary|equity|interview process|how to apply|apply)/i;
const ROLE_HEADING = /(what you'll do|what you will do|you will|you'll|responsibilities|the role|about the role|in this role|day to day|our stack|tech stack|stack|tools we use)/i;

/** A heading is a short line that isn't a bullet and doesn't read like a sentence. */
const isHeading = (line: string) => line.length > 0 && line.length < 70 && !/^[-•*]/.test(line) && !/[.;]$/.test(line);

interface Line {
  text: string;
  section: Section;
}

export function sectionLines(description: string): Line[] {
  let section: Section = 'other';
  return description
    .replace(/[‘’ʼ]/g, "'") // "What We’re Looking For"
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((text) => {
      if (isHeading(text)) {
        if (NICE_HEADING.test(text)) section = 'nice-to-have';
        else if (REQ_HEADING.test(text)) section = 'requirements';
        else if (OTHER_HEADING.test(text)) section = 'other';
        else if (ROLE_HEADING.test(text)) section = 'role';
      }
      // Inline "Bonus: …" / "Nice to have: …" lines inside a requirements list.
      const inline = /^[-•*]?\s*(bonus|nice to have|a plus|plus)\b/i.test(text) ? 'nice-to-have' : section;
      return { text, section: inline };
    });
}

/**
 * The clause around the skill, not the whole line: some JDs arrive with several bullets run together on
 * one line, and a 300-character "quote" hides the part that matters.
 */
const cleanQuote = (line: string, skill: Skill) => {
  const text = line.replace(/^[-•*]\s*/, '').trim();
  const at = findSkill(skill, text);
  if (at < 0) return text;
  // Bullets flattened with no punctuation ("…cost optimization Creating debuggable agents…"): quote only the
  // clause holding the skill. Splitting, never inserting, keeps the quote the founder's exact words.
  let start = 0;
  for (const m of text.matchAll(RUN_TOGETHER)) {
    const cut = m.index + m[0].length;
    if (cut > at) {
      return snippet(text.slice(start, m.index), at - start, 160);
    }
    start = cut;
  }
  return snippet(text.slice(start), at - start, 160);
};
/** A lowercase word, then a capitalised -ing verb: the seam where two bullets were run together. */
const RUN_TOGETHER = /(?<=[a-z0-9)])\s+(?=[A-Z][a-z]+ing\b)/g;

/** "IOS: https://apps.apple.com/…" is a link, not a requirement. */
const isLinkLine = (line: string) => /https?:\/\//.test(line) && line.replace(/https?:\/\/\S+/g, '').trim().split(/\s+/).length < 4;

/**
 * Weight: title +3 · requirements +2 · role (responsibilities, stack) +1 · nice-to-have +0.5
 *         · +1 per mention (max 3).
 *
 * When the JD has recognisable sections, a skill named only in intro/about/benefits text is not a
 * requirement at all: speedrun's own posting would otherwise "ask for" AI agents because its company blurb
 * mentions an MCP server for AI agents. A JD with no detectable sections keeps every mention, so it never
 * comes back empty.
 */
export function extractRequirements(role: Pick<Role, 'title' | 'description'>, skills: Skill[] = SKILLS): Requirement[] {
  const lines = sectionLines(role.description);
  const hasSections = lines.some((l) => l.section !== 'other');
  const out: Requirement[] = [];

  for (const skill of skills) {
    const inTitle = findSkill(skill, role.title) >= 0;
    const hits = lines.filter((l) => !isLinkLine(l.text) && findSkill(skill, l.text) >= 0);
    if (!inTitle && hits.length === 0) continue;
    if (!inTitle && hasSections && hits.every((l) => l.section === 'other')) continue;

    const mentions = Math.min(3, hits.reduce((n, l) => n + countSkill(skill, l.text), 0));
    const inReq = hits.find((l) => l.section === 'requirements');
    const inRole = hits.find((l) => l.section === 'role');
    const inNice = hits.find((l) => l.section === 'nice-to-have');
    const section: Section = inReq ? 'requirements' : inRole ? 'role' : inNice ? 'nice-to-have' : 'other';
    const weight = (inTitle ? 3 : 0) + mentions + (inReq ? 2 : inRole ? 1 : inNice ? 0.5 : 0);
    const quoteLine = inReq ?? inRole ?? inNice ?? hits[0] ?? null;

    out.push({ skill: skill.id, weight, quote: quoteLine ? cleanQuote(quoteLine.text, skill) : role.title, inTitle, section });
  }
  return out.sort((a, b) => b.weight - a.weight || SECTION_RANK[a.section] - SECTION_RANK[b.section]);
}

/** On equal weight, an explicit requirement outranks a responsibility, which outranks a nice-to-have. */
const SECTION_RANK: Record<Section, number> = { requirements: 0, role: 1, 'nice-to-have': 2, other: 3 };

// --- matching ----------------------------------------------------------------------------------

/** Credit per tier when scoring. Only demonstrated+ counts toward "strong". */
const CREDIT = { mentioned: 0.15, described: 0.4, declared: 0.6, demonstrated: 1, shipped: 1 } as const;

export const STRONG_DEMO_SHARE = 0.7;
export const SOME_CREDIT_SHARE = 0.3;
/**
 * "Strong" needs at least this many requirements the JD actually asks for (title, requirements or
 * nice-to-have section). Skills only named in intro/benefits text don't count, and a JD whose real
 * asks fall outside the taxonomy can't reach "strong" on a handful of generic matches.
 */
export const MIN_SPECIFIC_FOR_STRONG = 3;
/**
 * …and at least this many *covered* requirements from the requirements list or title. Guards against
 * taxonomy blind spots: a role whose real asks we can't see (creative tools, domain expertise) would
 * otherwise look "strong" on generic matches like Python + LLM.
 */
export const MIN_CORE_COVERED_FOR_STRONG = 2;

const isSpecific = (r: Requirement) => r.inTitle || r.section !== 'other';
const isCore = (r: Requirement) => r.inTitle || r.section === 'requirements';

export function matchRole(
  role: Pick<Role, 'id' | 'title' | 'description'>,
  evidence: Record<string, EvidenceItem[]>,
  requirements: Requirement[] = extractRequirements(role),
): MatchResult {
  const covered: CoveredRequirement[] = [];
  const missing: MissingRequirement[] = [];
  let total = 0;
  let demoWeight = 0;
  let credit = 0;
  const repoWeight = new Map<string, number>();

  for (const req of requirements) {
    total += req.weight;
    const best = evidence[req.skill]?.[0] ?? null;
    if (best) credit += req.weight * CREDIT[best.tier];

    if (best && tierRank(best.tier) >= tierRank('demonstrated')) {
      covered.push({ ...req, evidence: best });
      demoWeight += req.weight;
      if (best.repo) repoWeight.set(best.repo, (repoWeight.get(best.repo) ?? 0) + req.weight);
    } else {
      missing.push({ ...req, evidence: best });
    }
  }

  const score = total ? demoWeight / total : 0;
  const creditShare = total ? credit / total : 0;
  const enoughAsks = requirements.filter(isSpecific).length >= MIN_SPECIFIC_FOR_STRONG;
  const enoughCore = covered.filter(isCore).length >= MIN_CORE_COVERED_FOR_STRONG;
  const highScore = score >= STRONG_DEMO_SHARE;
  const strength: Strength =
    highScore && enoughAsks && enoughCore ? 'strong' : creditShare >= SOME_CREDIT_SHARE ? 'some' : 'thin';
  const cappedBy = !highScore || strength === 'strong' ? null : !enoughAsks ? 'few-requirements' : 'few-core-covered';

  return {
    roleId: role.id,
    covered,
    missing,
    strength,
    score,
    bestRepos: [...repoWeight.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r]) => r),
    cappedBy,
  };
}

const STRENGTH_ORDER: Record<Strength, number> = { strong: 0, some: 1, thin: 2 };

/** Strongest proof first; within a band, by share of requirement weight demonstrated. */
export const compareMatches = (a: MatchResult, b: MatchResult) =>
  STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] || b.score - a.score;

// --- side-quest gate ---------------------------------------------------------------------------

export type GateReason = 'unlocked' | 'not-opted-in' | 'needs-stronger-proof' | 'nothing-missing';

/**
 * Side quests are invited (founder opt-in), earned (strong existing proof) and targeted (a real gap).
 * Returns the gap to target when unlocked.
 */
export function sideQuestGate(match: MatchResult, optedIn: boolean): { reason: GateReason; target: MissingRequirement | null } {
  if (!optedIn) return { reason: 'not-opted-in', target: null };
  if (match.strength !== 'strong') return { reason: 'needs-stronger-proof', target: null };
  const target = match.missing.find((m) => m.section !== 'other') ?? match.missing[0] ?? null;
  return target ? { reason: 'unlocked', target } : { reason: 'nothing-missing', target: null };
}

// --- evidence breakdown ------------------------------------------------------------------------

export interface TierBreakdown {
  shipped: number;
  demonstrated: number;
  declared: number;
  described: number;
  mentioned: number;
  /** Requirements with no evidence at all. */
  none: number;
}

/**
 * How the role's requirements split across evidence levels. Shown next to the strength label everywhere, so
 * a reader sees the spread of evidence, never a single score standing in for it.
 */
export function tierBreakdown(match: Pick<MatchResult, 'covered' | 'missing'>): TierBreakdown {
  const out: TierBreakdown = { shipped: 0, demonstrated: 0, declared: 0, described: 0, mentioned: 0, none: 0 };
  for (const c of match.covered) out[c.evidence.tier]++;
  for (const m of match.missing) {
    if (m.evidence) out[m.evidence.tier]++;
    else out.none++;
  }
  return out;
}
