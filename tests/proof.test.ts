import { describe, expect, it } from 'vitest';
import {
  MAX_NETWORK_ROLES,
  MAX_PROOF_BYTES,
  buildProof,
  fitProof,
  hmacSha256Hex,
  ipBucket,
  isProofId,
  maxRoles,
  newDeleteToken,
  newProofId,
  proofKind,
  proofTitle,
  proofToMarkdown,
  sha256Hex,
  sideQuestOf,
  type ProofDoc,
  type ProofRole,
} from '../src/lib/proof';
import type { BriefFile } from '../src/lib/briefs';
import type { CandidateProfile, EvidenceItem, Role } from '../src/lib/types';

const role = (id: string, over: Partial<Role> = {}): Role => ({
  id,
  title: 'AI Agent Engineer',
  company: `Acme ${id}`,
  companySlug: 'acme',
  stealth: false,
  location: 'San Francisco',
  workplace: null,
  seniority: null,
  specialty: null,
  aiNative: true,
  description: "What we're looking for\n- Strong Python and LangGraph experience\n- Experience building evals for LLM agents\n- Comfort with Docker",
  blurb: '',
  industries: [],
  url: `https://speedrun-talent-network.com/jobs/${id}`,
  publishedAt: null,
  ...over,
});

const ev = (skill: string, tier: EvidenceItem['tier'], source: EvidenceItem['source'] = 'repo'): EvidenceItem => ({
  skill,
  tier,
  source,
  repo: source === 'repo' ? `repo-${skill}` : undefined,
  url: source === 'repo' ? `https://github.com/dev/repo-${skill}` : undefined,
  reasons: source === 'repo' ? [`\`pyproject.toml\` lists ${skill}`, '12 source files', 'CI in `.github/workflows/`'] : ['resume: “secret resume line”'],
});

const profile = (evidence: Record<string, EvidenceItem[]>): CandidateProfile => ({
  login: 'dev',
  name: 'Dev Person',
  avatarUrl: null,
  profileUrl: 'https://github.com/dev',
  repos: [],
  evidence,
  reposConsidered: 3,
  fetchedAt: '2026-11-02T10:00:00Z',
});

const noBriefs: BriefFile = { _note: '', entries: [] };
const roleOpts = { kind: 'role' as const, demo: false, briefs: noBriefs, optedIn: new Set<string>(), now: new Date('2026-11-02T12:00:00Z') };
const netOpts = { ...roleOpts, kind: 'network' as const };
const python = () => profile({ python: [ev('python', 'shipped')] });

describe('buildProof', () => {
  it('records the kind, the candidate, the date and each role’s server-computed match', () => {
    const doc = buildProof(profile({ python: [ev('python', 'shipped')], agents: [ev('agents', 'demonstrated')] }), [role('r1')], roleOpts);
    expect(doc.kind).toBe('role');
    expect(doc.candidate).toMatchObject({ login: 'dev', name: 'Dev Person', demo: false, evidenceFetchedAt: '2026-11-02T10:00:00Z' });
    expect(doc.createdAt).toBe('2026-11-02T12:00:00.000Z');
    expect(doc.roles[0].covered.map((c) => c.skill)).toEqual(expect.arrayContaining(['python', 'agents']));
    expect(doc.roles[0].total).toBeGreaterThan(doc.roles[0].covered.length);
  });

  it('a role link holds exactly one role, even if handed several', () => {
    const doc = buildProof(python(), [role('r1'), role('r2'), role('r3')], roleOpts);
    expect(doc.roles.map((r) => r.roleId)).toEqual(['r1']);
    expect(maxRoles('role')).toBe(1);
  });

  it(`a network link holds up to ${MAX_NETWORK_ROLES} roles`, () => {
    const roles = Array.from({ length: MAX_NETWORK_ROLES + 3 }, (_, i) => role(`r${i}`));
    expect(buildProof(python(), roles, netOpts).roles).toHaveLength(MAX_NETWORK_ROLES);
  });

  it('never carries resume evidence, even if a profile somehow contained it', () => {
    const doc = buildProof(profile({ evals: [ev('evals', 'mentioned', 'resume')] }), [role('r1')], roleOpts);
    expect(JSON.stringify(doc)).not.toContain('secret resume line');
    expect(doc.roles[0].missing.find((m) => m.skill === 'evals')?.evidence).toBeNull();
  });

  it('attaches a side quest only when the role is opted in, proof is strong and a reviewed brief exists', () => {
    const strong = profile(Object.fromEntries(['python', 'agents', 'llm', 'docker'].map((s) => [s, [ev(s, 'shipped')]])));
    const brief = { title: 'Eval harness', why_they_care: 'x', jd_quote: 'x', scope: [], stack: [], data: '', numbers: [], done_looks_like: '', founder_note: '', risks: [] };
    const briefs: BriefFile = { _note: '', entries: [{ roleId: 'r1', company: 'Acme', roleTitle: 'T', targetSkill: 'evals', reviewed: true, model: 'm', generatedAt: '', brief }] };
    expect(buildProof(strong, [role('r1')], { ...roleOpts, briefs }).roles[0].sideQuest).toBeNull(); // not opted in
    expect(buildProof(strong, [role('r1')], { ...roleOpts, briefs, optedIn: new Set(['r1']) }).roles[0].sideQuest?.title).toBe('Eval harness');
  });
});

describe('stored side quests', () => {
  it('keep only what the page shows, and old full-brief links still read', () => {
    const strong = profile(Object.fromEntries(['python', 'agents', 'llm', 'docker'].map((s) => [s, [ev(s, 'shipped')]])));
    const brief = { title: 'T', why_they_care: 'W', jd_quote: 'Q', scope: ['a'], stack: ['x'], data: 'D', numbers: ['n'], done_looks_like: 'L', founder_note: 'N', risks: ['r'] };
    const briefs: BriefFile = { _note: '', entries: [{ roleId: 'r1', company: 'Acme', roleTitle: 'T', targetSkill: 'evals', reviewed: true, model: 'm', generatedAt: '', brief }] };
    const doc = buildProof(strong, [role('r1')], { ...roleOpts, briefs, optedIn: new Set(['r1']) });
    expect(doc.roles[0].sideQuest).toEqual({ targetSkill: 'evals', title: 'T', why_they_care: 'W', scope: ['a'] });

    const old = { ...doc.roles[0], sideQuest: { targetSkill: 'evals', brief } } as unknown as ProofRole;
    expect(sideQuestOf(old)).toEqual({ targetSkill: 'evals', title: 'T', why_they_care: 'W', scope: ['a'] });
  });

  it(`a network link with ${MAX_NETWORK_ROLES} full roles fits without dropping any`, () => {
    const strong = profile(Object.fromEntries(['python', 'agents', 'llm', 'docker', 'evals'].map((s) => [s, [ev(s, 'shipped')]])));
    const roles = Array.from({ length: MAX_NETWORK_ROLES }, (_, i) => role(`r${i}`));
    expect(fitProof(buildProof(strong, roles, netOpts))?.roles).toHaveLength(MAX_NETWORK_ROLES);
  });
});

describe('proofKind and proofTitle', () => {
  it('reads older links without a kind by their role count', () => {
    const one = buildProof(python(), [role('r1')], roleOpts);
    const many = buildProof(python(), [role('r1'), role('r2')], netOpts);
    expect(proofKind({ ...one, kind: undefined })).toBe('role');
    expect(proofKind({ ...many, kind: undefined })).toBe('network');
  });

  it('names the company for a role link and the count for a network link', () => {
    expect(proofTitle(buildProof(python(), [role('r1')], roleOpts))).toBe("Dev Person's evidence for Acme r1: AI Agent Engineer");
    expect(proofTitle(buildProof(python(), [role('r1'), role('r2')], netOpts))).toBe("Dev Person's evidence across 2 speedrun roles");
  });
});

describe('fitProof', () => {
  const big = (roles: number, reasonLength: number): ProofDoc => {
    const doc = buildProof(python(), Array.from({ length: roles }, (_, i) => role(`r${i}`)), netOpts);
    for (const r of doc.roles) for (const c of r.covered) c.evidence.reasons = Array.from({ length: 6 }, () => 'x'.repeat(reasonLength));
    return doc;
  };

  it('returns small proofs unchanged', () => {
    const doc = buildProof(python(), [role('r1')], roleOpts);
    expect(fitProof(doc)).toBe(doc);
  });

  // Fixture sizes derive from the cap, so changing MAX_PROOF_BYTES can't silently turn these into no-ops.
  const bytesOf = (doc: ProofDoc) => new TextEncoder().encode(JSON.stringify(doc)).length;

  it('trims reasons, then drops trailing roles, keeping the first role', () => {
    // 6 reasons × 8 roles of this length is over the cap; 2 reasons × 8 roles is well under it.
    const reasonLength = Math.ceil(MAX_PROOF_BYTES / (6 * MAX_NETWORK_ROLES)) + 100;
    const doc = big(MAX_NETWORK_ROLES, reasonLength);
    expect(bytesOf(doc)).toBeGreaterThan(MAX_PROOF_BYTES); // precondition: the fixture really is too big

    const fitted = fitProof(doc)!;
    expect(bytesOf(fitted)).toBeLessThanOrEqual(MAX_PROOF_BYTES);
    expect(fitted.roles[0].roleId).toBe('r0');
    expect(fitted.roles[0].covered[0].evidence.reasons.length).toBeLessThanOrEqual(2);
  });

  it('gives up (null) when even one role cannot fit', () => {
    // A single reason as long as the whole cap: even trimmed to 2 reasons, one role is over it.
    expect(fitProof(big(1, MAX_PROOF_BYTES))).toBeNull();
  });
});

describe('proofToMarkdown', () => {
  const url = 'https://sq.example/p/abcdefghjk';

  it('role link: full evidence for that one role, sources linked', () => {
    const md = proofToMarkdown(buildProof(python(), [role('r1')], roleOpts), url);
    expect(md).toMatch(/^# Dev Person's evidence for Acme r1: AI Agent Engineer/);
    expect(md).toContain(`Full page: ${url}`);
    expect(md).toContain('**Python** (Shipped) in [repo-python](https://github.com/dev/repo-python)');
    expect(md).toContain('Not shown yet:');
  });

  it('network link: one line per role and no evidence dump', () => {
    const md = proofToMarkdown(buildProof(python(), [role('r1'), role('r2')], netOpts), url);
    expect(md).toMatch(/^# Dev Person's evidence across 2 speedrun roles/);
    expect(md).toContain('- **Acme r1, AI Agent Engineer**: ');
    expect(md).toContain('- **Acme r2, AI Agent Engineer**: ');
    expect(md).not.toContain('repo-python');
  });
});

describe('ids, tokens and hashing', () => {
  it('makes unambiguous 10-character ids and long delete tokens', () => {
    const ids = new Set(Array.from({ length: 200 }, newProofId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(isProofId(id)).toBe(true);
    expect(newDeleteToken()).toHaveLength(32);
    expect(isProofId('abcdefghi0')).toBe(false);
    expect(isProofId('../etc/pas')).toBe(false);
  });

  it('hashes delete tokens with SHA-256', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('buckets IPs with HMAC-SHA256 keyed by a secret, rotating daily, never storing the IP', async () => {
    // RFC 4231 test case 2: HMAC-SHA256(key "Jefe", "what do ya want for nothing?").
    expect(await hmacSha256Hex('Jefe', 'what do ya want for nothing?')).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');

    const a = await ipBucket('203.0.113.7', '2026-11-02', 'secret-1');
    expect(a).toBe((await hmacSha256Hex('secret-1', '2026-11-02:203.0.113.7')).slice(0, 16));
    expect(a).toHaveLength(16);
    expect(a).not.toContain('203');
    // Not the old, brute-forceable plain hash of the same message.
    expect(a).not.toBe((await sha256Hex('2026-11-02:203.0.113.7')).slice(0, 16));
    expect(await ipBucket('203.0.113.7', '2026-11-03', 'secret-1')).not.toBe(a); // rotates daily
    expect(await ipBucket('203.0.113.7', '2026-11-02', 'secret-2')).not.toBe(a); // useless without the key
    expect(await ipBucket('203.0.113.8', '2026-11-02', 'secret-1')).not.toBe(a);
  });
});
