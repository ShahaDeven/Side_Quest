import { describe, expect, it } from 'vitest';
import briefsJson from '../src/data/briefs.json';
import optins from '../src/data/optins.json';
import snapshot from '../src/data/jobs-snapshot.json';
import { briefTargets, pickBrief, quoteAppearsIn, validateBrief, type Brief, type BriefFile } from '../src/lib/briefs';
import type { MissingRequirement, Requirement, RoleSet } from '../src/lib/types';

const good: Brief = {
  title: 'Durable job queue with a chaos test',
  why_they_care: 'They ask for distributed systems experience.',
  jd_quote: 'Experience with distributed / real-time systems',
  scope: ['Build a queue.', 'Add retries and a dead-letter stream.', 'Write a chaos test.'],
  stack: ['Python', 'Redis'],
  data: 'Synthetic prompts.',
  numbers: ['Duplicates per 1,000 tasks', 'p95 latency'],
  done_looks_like: 'One command runs it.',
  founder_note: 'I built a queue. The finding was [FINDING]. It is at [LINK]. Could we talk for 15 minutes?',
  risks: ['Do not claim exactly-once.'],
};
const JD = 'We are looking for\n- Experience with distributed / real-time systems\n- Strong Python';

describe('quoteAppearsIn', () => {
  it('accepts exact lines despite curly quotes, bullets and whitespace', () => {
    expect(quoteAppearsIn('- Experience  with distributed / real-time systems', JD)).toBe(true);
    expect(quoteAppearsIn('You’ll own the lane', "You'll own the lane end-to-end")).toBe(true);
  });
  it('rejects paraphrases and fragments too short to mean anything', () => {
    expect(quoteAppearsIn('Experience with distributed systems', JD)).toBe(false);
    expect(quoteAppearsIn('Python', JD)).toBe(false);
  });
});

describe('validateBrief', () => {
  it('passes a well-formed one-day brief', () => {
    expect(validateBrief(good, JD, 'distributed')).toEqual([]);
  });

  it('rejects invented quotes, take-home scope, and notes without placeholders', () => {
    const errors = validateBrief(
      {
        ...good,
        jd_quote: 'We value distributed systems',
        scope: Array.from({ length: 5 }, () => 'Build a large thing with many many parts and dashboards and exporters and more.'),
        stack: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        founder_note: 'I built it. It was great. Really great. So great. Talk soon.',
      },
      JD,
      'distributed',
    );
    expect(errors.join(' ')).toMatch(/not copied exactly/);
    expect(errors.join(' ')).toMatch(/3 to 4 bullets/);
    expect(errors.join(' ')).toMatch(/stack/);
    expect(errors.join(' ')).toMatch(/\[LINK\] and \[FINDING\]/);
    expect(errors.join(' ')).toMatch(/at most 4 sentences/);
  });

  it('rejects a valid bullet count that is still too much work for a day', () => {
    const long = Array.from({ length: 30 }, (_, i) => `step${i}`).join(' '); // 30 words
    const errors = validateBrief({ ...good, scope: [long, long, long, long] }, JD, 'distributed'); // 120 words
    expect(errors).toEqual(['scope is 120 words; cut it to at most 110 so one person can finish in one day.']);
  });

  it('requires the quote to name the target skill when the JD does', () => {
    const offTopic = { ...good, jd_quote: 'Strong Python' };
    expect(validateBrief(offTopic, JD + '\n- Strong Python', 'distributed').join(' ')).toMatch(/names Distributed/);
  });
});

describe('briefTargets', () => {
  const req = (skill: string, section: Requirement['section'], weight = 3): Requirement => ({ skill, section, weight, quote: '', inTitle: false });
  it('takes real asks, skips languages and intro mentions, and always includes the extra target', () => {
    const reqs = [req('python', 'requirements', 9), req('agents', 'requirements'), req('docker', 'other'), req('evals', 'role'), req('rag', 'nice-to-have')];
    expect(briefTargets(reqs, ['distributed'])).toEqual(['distributed', 'agents', 'evals']);
  });
});

describe('pickBrief', () => {
  const file: BriefFile = {
    _note: '',
    entries: [
      { roleId: 'r', company: 'A', roleTitle: 'T', targetSkill: 'evals', reviewed: true, model: 'm', generatedAt: '', brief: good },
      { roleId: 'r', company: 'A', roleTitle: 'T', targetSkill: 'distributed', reviewed: false, model: 'm', generatedAt: '', brief: good },
    ],
  };
  const miss = (skill: string): MissingRequirement => ({ skill, weight: 1, quote: '', inTitle: false, section: 'requirements', evidence: null });

  it('returns the first missing skill with a reviewed brief, never an unreviewed one', () => {
    expect(pickBrief(file, 'r', [miss('distributed'), miss('evals')])?.targetSkill).toBe('evals');
    expect(pickBrief(file, 'r', [miss('distributed')])).toBeNull();
    expect(pickBrief(file, 'other-role', [miss('evals')])).toBeNull();
  });
});

describe('shipped briefs (src/data/briefs.json)', () => {
  const file = briefsJson as BriefFile;
  const roles = new Map((snapshot as RoleSet).roles.map((r) => [r.id, r]));

  it('only exist for opted-in roles', () => {
    const opted = new Set(optins.roles.map((r) => r.id));
    expect(file.entries.every((e) => opted.has(e.roleId))).toBe(true);
  });

  it.each(file.entries.filter((e) => e.reviewed).map((e) => [`${e.company} · ${e.targetSkill}`, e] as const))(
    '%s passes every check against its real job description',
    (_, entry) => {
      const role = roles.get(entry.roleId);
      expect(role, 'role missing from snapshot').toBeDefined();
      expect(validateBrief(entry.brief, role!.description, entry.targetSkill)).toEqual([]);
    },
  );
});
