import { describe, expect, it } from 'vitest';
import { SEED_CANDIDATES } from '../src/data/seed-candidates';
import { isBoardId, isCandidateRef, isRoleId, newBoardId, seedRef, githubRef } from '../src/lib/shortlist';
import { SKILL_BY_ID } from '../src/lib/skills';
import { TIERS } from '../src/lib/types';

describe('seed candidates', () => {
  it('are fictional: no links anywhere, and hostnames only on the reserved .example TLD', () => {
    for (const c of SEED_CANDIDATES) {
      for (const items of Object.values(c.evidence)) {
        for (const e of items) {
          expect(e.url, `${c.name}: ${e.skill}`).toBeUndefined();
          for (const r of e.reasons) expect(r).not.toMatch(/github\.com|https?:\/\//);
          for (const host of e.reasons.join(' ').match(/live at (\S+)/g) ?? []) expect(host).toMatch(/\.example$/);
        }
      }
    }
  });

  it('use real skill ids and tiers, and repo evidence only', () => {
    for (const c of SEED_CANDIDATES) {
      for (const [skill, items] of Object.entries(c.evidence)) {
        expect(SKILL_BY_ID.has(skill), `${c.name}: unknown skill ${skill}`).toBe(true);
        for (const e of items) {
          expect(e.skill).toBe(skill);
          expect(TIERS).toContain(e.tier);
          expect(e.source).toBe('repo');
          expect(e.reasons.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('have unique ids that make valid shortlist refs', () => {
    const ids = SEED_CANDIDATES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(isCandidateRef(seedRef(id))).toBe(true);
  });
});

describe('shortlist validation', () => {
  it('accepts seed and GitHub refs, rejects anything else', () => {
    expect(isCandidateRef('seed:avery')).toBe(true);
    expect(isCandidateRef(githubRef('ShahaDeven'))).toBe(true);
    expect(githubRef('ShahaDeven')).toBe('gh:shahadeven');
    expect(isCandidateRef('gh:-bad')).toBe(false);
    expect(isCandidateRef('seed:<script>')).toBe(false);
    expect(isCandidateRef('avery')).toBe(false);
  });

  it('only takes speedrun-style UUID role ids and well-formed board ids', () => {
    expect(isRoleId('6b385ffe-8550-44cb-969e-5fae13d6f42a')).toBe(true);
    expect(isRoleId('6b385ffe')).toBe(false);
    expect(isRoleId("x' OR 1=1 --")).toBe(false);
    expect(isBoardId(newBoardId())).toBe(true);
    expect(isBoardId('short')).toBe(false);
  });
});
