/**
 * Side-quest briefs: shape, validation and selection. PLAN.md Step 1.3 and §12.
 * Generation lives in scripts/build-briefs.ts (build time only; the site never calls a model).
 */
import { SKILL_BY_ID, findSkill } from './skills';
import type { MissingRequirement, Requirement } from './types';

export interface Brief {
  title: string;
  why_they_care: string;
  /** Must appear verbatim in the role's description (see quoteAppearsIn). */
  jd_quote: string;
  scope: string[];
  stack: string[];
  data: string;
  numbers: string[];
  done_looks_like: string;
  /** Template the candidate fills in: contains [LINK] and [FINDING]. */
  founder_note: string;
  risks: string[];
}

export interface BriefEntry {
  roleId: string;
  company: string;
  roleTitle: string;
  /** Skill id of the gap this brief closes. */
  targetSkill: string;
  /** Only reviewed briefs are ever shown. New generations start unreviewed. */
  reviewed: boolean;
  /** Set when a human rewrote parts of the brief; the generator never overwrites these. */
  handEdited?: boolean;
  model: string;
  generatedAt: string;
  brief: Brief;
}

export interface BriefFile {
  _note: string;
  entries: BriefEntry[];
}

// --- validation --------------------------------------------------------------------------------

/** Whitespace, bullets and curly quotes differ between the API's text and what a model echoes back. */
const norm = (s: string) =>
  s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

/** The quote must be a real line from the JD: an exact substring after whitespace/quote normalization. */
export function quoteAppearsIn(quote: string, description: string): boolean {
  const q = norm(quote).replace(/^[-•*]\s*/, '').replace(/^"|"$/g, '');
  return q.length >= 12 && norm(description).includes(q);
}

const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter((x) => x.trim()).length;
const words = (xs: string[]) => xs.join(' ').split(/\s+/).filter(Boolean).length;

/** A one-day side quest, not a free take-home: limits that keep scope honest. */
export const LIMITS = { scopeBullets: [3, 4], scopeWords: 110, stackItems: 6 } as const;

/** Every reason a brief can't ship. Empty array = valid. */
export function validateBrief(brief: Brief, description: string, targetSkill?: string): string[] {
  const errors: string[] = [];
  if (!quoteAppearsIn(brief.jd_quote, description))
    errors.push('jd_quote is not copied exactly from the job description. Copy one line (or a clause of one) character for character.');

  // If the JD names the target skill anywhere, the quote must be one of those lines, not a generic one.
  const skill = targetSkill ? SKILL_BY_ID.get(targetSkill) : undefined;
  if (skill && findSkill(skill, description) >= 0 && findSkill(skill, brief.jd_quote) < 0)
    errors.push(`jd_quote must be a line that names ${skill.label} (the job description has one); pick that line.`);

  const [minB, maxB] = LIMITS.scopeBullets;
  if (brief.scope.length < minB || brief.scope.length > maxB) errors.push(`scope must have ${minB} to ${maxB} bullets (got ${brief.scope.length}).`);
  if (words(brief.scope) > LIMITS.scopeWords)
    errors.push(`scope is ${words(brief.scope)} words; cut it to at most ${LIMITS.scopeWords} so one person can finish in one day.`);
  if (brief.stack.length > LIMITS.stackItems) errors.push(`stack lists ${brief.stack.length} items; keep it to at most ${LIMITS.stackItems}.`);
  if (brief.numbers.length < 2 || brief.numbers.length > 3) errors.push(`numbers must have 2 or 3 items (got ${brief.numbers.length}).`);
  if (!brief.founder_note.includes('[LINK]') || !brief.founder_note.includes('[FINDING]'))
    errors.push('founder_note must contain the placeholders [LINK] and [FINDING].');
  if (sentences(brief.founder_note) > 4) errors.push('founder_note must be at most 4 sentences.');
  if (!brief.title.trim() || brief.title.length > 70) errors.push('title must be a short project name (70 characters max).');
  return errors;
}

// --- which gaps get a brief ------------------------------------------------------------------

/** Languages make poor side quests ("write something in Python"); briefs target capabilities. */
export const isBriefableSkill = (skillId: string) => SKILL_BY_ID.get(skillId)?.category !== 'language';

/** Gaps worth pre-writing a brief for: the role's heaviest real asks (not intro text), capabilities only. */
export function briefTargets(requirements: Requirement[], extra: string[] = [], max = 3): string[] {
  const top = requirements
    .filter((r) => (r.inTitle || r.section === 'requirements' || r.section === 'role') && isBriefableSkill(r.skill))
    .slice(0, max)
    .map((r) => r.skill);
  return [...new Set([...extra.filter(isBriefableSkill), ...top])];
}

/**
 * The brief to show for a candidate: the reviewed brief for this role whose target is the candidate's
 * heaviest missing requirement that has one. No reviewed match → no side quest (never a bad brief).
 */
export function pickBrief(file: BriefFile, roleId: string, missing: MissingRequirement[]): BriefEntry | null {
  const forRole = file.entries.filter((e) => e.roleId === roleId && e.reviewed);
  for (const m of missing) {
    const hit = forRole.find((e) => e.targetSkill === m.skill);
    if (hit) return hit;
  }
  return null;
}
