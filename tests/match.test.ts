import { describe, expect, it } from 'vitest';
import { compareMatches, extractRequirements, matchRole, sectionLines, sideQuestGate } from '../src/lib/match';
import type { EvidenceItem, Tier } from '../src/lib/types';

const JD = `About Acme
We build agents for logistics. Benefits include Python lunch-and-learns.

What you'll do
- Ship our React frontend and Postgres backend

What We’re Looking For
- Strong Python and LangGraph experience
- Experience building evals for LLM agents
- Comfort with Docker

Nice to have
- Kubernetes

IOS: https://apps.apple.com/us/app/acme/id1
Benefits
- Health insurance`;

const role = { id: 'r1', title: 'AI Agent Engineer', description: JD };
const ev = (skill: string, tier: Tier): EvidenceItem => ({ skill, tier, source: 'repo', repo: `repo-${skill}`, reasons: ['x'] });
const evidence = (pairs: [string, Tier][]) => Object.fromEntries(pairs.map(([s, t]) => [s, [ev(s, t)]]));

describe('sectionLines', () => {
  it('reads curly-apostrophe headings and classifies sections', () => {
    const by = Object.fromEntries(sectionLines(JD).map((l) => [l.text, l.section]));
    expect(by['- Strong Python and LangGraph experience']).toBe('requirements');
    expect(by['- Ship our React frontend and Postgres backend']).toBe('role');
    expect(by['- Kubernetes']).toBe('nice-to-have');
    expect(by['- Health insurance']).toBe('other');
  });
});

describe('extractRequirements', () => {
  const reqs = extractRequirements(role);
  const req = (s: string) => reqs.find((r) => r.skill === s);

  it('weights title > requirements > role > nice-to-have > intro', () => {
    expect(req('agents')).toMatchObject({ inTitle: true, section: 'requirements' });
    expect(req('agents')!.weight).toBeGreaterThan(req('evals')!.weight);
    expect(req('python')!.section).toBe('requirements');
    expect(req('react')).toMatchObject({ section: 'role', weight: 2 });
    expect(req('kubernetes')).toMatchObject({ section: 'nice-to-have', weight: 1.5 });
  });

  it('quotes the requirements line', () => {
    expect(req('python')!.quote).toBe('Strong Python and LangGraph experience');
  });

  it('ignores link-only lines like app-store URLs', () => {
    expect(req('ios')).toBeUndefined();
  });
});

describe('matchRole', () => {
  it('covers only demonstrated+ evidence; weaker evidence stays in missing with what we have', () => {
    const m = matchRole(role, evidence([['agents', 'shipped'], ['python', 'demonstrated'], ['evals', 'described']]));
    expect(m.covered.map((c) => c.skill)).toEqual(expect.arrayContaining(['agents', 'python']));
    expect(m.missing.find((x) => x.skill === 'evals')?.evidence?.tier).toBe('described');
    expect(m.bestRepos[0]).toBe('repo-agents');
  });

  it('strong needs most weight demonstrated, enough specific asks, and ≥2 core requirements covered', () => {
    const all: [string, Tier][] = ['agents', 'python', 'evals', 'llm', 'docker', 'react', 'postgres', 'kubernetes'].map((s) => [s, 'shipped']);
    const strong = matchRole(role, evidence(all));
    expect(strong.strength).toBe('strong');
    expect(strong.cappedBy).toBeNull();

    // Same score, but a JD whose only recognisable asks are generic can't be "strong", and says why.
    const thinJd = { id: 'r2', title: 'Creative Technologist', description: 'Requirements\n- Experience with LLM tools\n- Love for art' };
    const capped = matchRole(thinJd, evidence([['llm', 'shipped']]));
    expect(capped.strength).not.toBe('strong');
    expect(capped.score).toBe(1);
    expect(capped.cappedBy).toBe('few-requirements');
  });

  it('has no cap explanation when the score itself is low', () => {
    expect(matchRole(role, {}).cappedBy).toBeNull();
  });

  it('mentions alone are thin', () => {
    const all: [string, Tier][] = ['agents', 'python', 'evals', 'llm', 'docker', 'react', 'postgres'].map((s) => [s, 'mentioned']);
    expect(matchRole(role, evidence(all)).strength).toBe('thin');
  });

  it('sorts strong before some before thin', () => {
    const strong = matchRole(role, evidence(['agents', 'python', 'evals', 'llm', 'docker', 'react', 'postgres', 'kubernetes'].map((s) => [s, 'shipped'] as [string, Tier])));
    const thin = matchRole(role, {});
    expect([thin, strong].sort(compareMatches)[0]).toBe(strong);
  });
});

describe('sideQuestGate', () => {
  const strong = matchRole(role, evidence(['agents', 'python', 'llm', 'docker', 'react', 'postgres'].map((s) => [s, 'shipped'] as [string, Tier])));

  it('is invited, earned, and targeted at the heaviest real gap', () => {
    expect(strong.strength).toBe('strong');
    expect(sideQuestGate(strong, false).reason).toBe('not-opted-in');
    expect(sideQuestGate(matchRole(role, {}), true).reason).toBe('needs-stronger-proof');
    const g = sideQuestGate(strong, true);
    expect(g.reason).toBe('unlocked');
    expect(g.target?.skill).toBe('evals');
  });
});
