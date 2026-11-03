/**
 * Proof links (PLAN.md Step 1.5): a frozen, public snapshot of a candidate's evidence for chosen roles.
 *
 * Built ONLY on the server from the server's own GitHub read and role data. The browser sends a login and
 * role ids, never evidence, so a proof page can't be forged by posting made-up "shipped" claims.
 * Resume text never reaches the server, so it can't end up in a proof.
 */
import { pickBrief, type BriefFile } from './briefs';
import { extractRequirements, matchRole, sideQuestGate } from './match';
import { SKILL_BY_ID } from './skills';
import type { CandidateProfile, CoveredRequirement, MatchResult, MissingRequirement, Role, Strength } from './types';

/**
 * 2: evidence read under the stricter levels (Declared added; Demonstrated needs code that was read to use the
 * skill; Shipped needs a GitHub release, deployment or Pages site). Version 1 links keep their stored evidence
 * and say they were read under the earlier, looser rules.
 */
export const PROOF_VERSION = 2;
/** Links stored before the stricter evidence levels. */
export const readUnderLooserRules = (doc: Pick<ProofDoc, 'v'>) => (doc.v ?? 1) < 2;
/**
 * Size guard for a stored proof. Proofs are built by the server (never posted by the client), so this only
 * stops runaway growth; 8 strong roles with evidence and side quests come to ~40 KB.
 */
export const MAX_PROOF_BYTES = 64_000;
export const PROOFS_PER_IP_PER_DAY = 20;

/**
 * Two audiences, two kinds of link:
 *  - role:    for one company's founder or recruiter. Exactly one role; never mentions other companies
 *             (a founder seeing your other applications reads as spraying, the opposite of proof of work).
 *  - network: for the speedrun talent team. Up to MAX_NETWORK_ROLES strong roles, summarised then expandable.
 */
export type ProofKind = 'role' | 'network';
export const MAX_NETWORK_ROLES = 8;
export const maxRoles = (kind: ProofKind) => (kind === 'role' ? 1 : MAX_NETWORK_ROLES);

export interface ProofRole {
  roleId: string;
  company: string;
  title: string;
  location: string | null;
  url: string;
  strength: Strength;
  cappedBy: MatchResult['cappedBy'];
  /** Number of requirements read from the JD. */
  total: number;
  covered: CoveredRequirement[];
  missing: MissingRequirement[];
  /** Only the parts the proof page shows; the full brief stays in the app. */
  sideQuest: ProofSideQuest | null;
}

export interface ProofSideQuest {
  targetSkill: string;
  title: string;
  why_they_care: string;
  scope: string[];
}

/**
 * Links created on 2026-11-02 before the slim format stored the whole brief under `brief`; read both.
 */
export function sideQuestOf(r: ProofRole): ProofSideQuest | null {
  const sq = r.sideQuest as (ProofSideQuest & { brief?: { title: string; why_they_care: string; scope: string[] } }) | null;
  if (!sq) return null;
  return sq.brief ? { targetSkill: sq.targetSkill, title: sq.brief.title, why_they_care: sq.brief.why_they_care, scope: sq.brief.scope } : sq;
}

export interface ProofDoc {
  /** PROOF_VERSION when stored. */
  v: number;
  /** Absent on links created before link kinds existed; read it through proofKind(). */
  kind?: ProofKind;
  createdAt: string;
  candidate: {
    login: string;
    name: string | null;
    avatarUrl: string | null;
    profileUrl: string;
    /** The bundled demo profile rather than a live read. */
    demo: boolean;
    evidenceFetchedAt: string;
    reposRead: number;
  };
  roles: ProofRole[];
}

/** Repo evidence only. Belt and braces: a server-built profile has no resume items anyway. */
const repoOnly = <T extends { evidence: { source: string } | null }>(items: T[]): T[] =>
  items.map((m) => (m.evidence && m.evidence.source !== 'repo' ? { ...m, evidence: null } : m));

export function buildProof(
  profile: CandidateProfile,
  roles: Role[],
  opts: { kind: ProofKind; demo: boolean; briefs: BriefFile; optedIn: Set<string>; now?: Date },
): ProofDoc {
  const proofRoles = roles.slice(0, maxRoles(opts.kind)).map((role): ProofRole => {
    const requirements = extractRequirements(role);
    const match = matchRole(role, profile.evidence, requirements);
    const gate = sideQuestGate(match, opts.optedIn.has(role.id));
    const brief = gate.reason === 'unlocked' ? pickBrief(opts.briefs, role.id, match.missing) : null;
    return {
      roleId: role.id,
      company: role.company,
      title: role.title,
      location: role.location,
      url: role.url,
      strength: match.strength,
      cappedBy: match.cappedBy,
      total: requirements.length,
      covered: match.covered.filter((c) => c.evidence.source === 'repo'),
      missing: repoOnly(match.missing),
      sideQuest: brief
        ? { targetSkill: brief.targetSkill, title: brief.brief.title, why_they_care: brief.brief.why_they_care, scope: brief.brief.scope }
        : null,
    };
  });

  return {
    v: PROOF_VERSION,
    kind: opts.kind,
    createdAt: (opts.now ?? new Date()).toISOString(),
    candidate: {
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      profileUrl: profile.profileUrl,
      demo: opts.demo,
      evidenceFetchedAt: profile.fetchedAt,
      reposRead: profile.repos.length,
    },
    roles: proofRoles,
  };
}

/** Links made before kinds existed: one role behaves as a role link, several as a network link. */
export const proofKind = (doc: ProofDoc): ProofKind => doc.kind ?? (doc.roles.length === 1 ? 'role' : 'network');

const bytes = (doc: ProofDoc) => new TextEncoder().encode(JSON.stringify(doc)).length;

/**
 * Keep a proof under MAX_PROOF_BYTES: first trim each evidence item to its two strongest reasons, then drop
 * roles from the end (the first role is the one the candidate asked for). Returns null if even one role won't fit.
 */
export function fitProof(doc: ProofDoc): ProofDoc | null {
  let out = doc;
  if (bytes(out) <= MAX_PROOF_BYTES) return out;
  out = {
    ...out,
    roles: out.roles.map((r) => ({
      ...r,
      // Reasons say why a level was reached, so the first two stay. Notes are context: one stays, if any.
      covered: r.covered.map((c) => ({
        ...c,
        evidence: { ...c.evidence, reasons: c.evidence.reasons.slice(0, 2), ...(c.evidence.notes ? { notes: c.evidence.notes.slice(0, 1) } : {}) },
      })),
      missing: r.missing.map((m) => (m.evidence?.notes ? { ...m, evidence: { ...m.evidence, notes: m.evidence.notes.slice(0, 1) } } : m)),
    })),
  };
  while (out.roles.length > 1 && bytes(out) > MAX_PROOF_BYTES) out = { ...out, roles: out.roles.slice(0, -1) };
  return bytes(out) <= MAX_PROOF_BYTES ? out : null;
}

// --- Markdown ----------------------------------------------------------------------------------

const label = (id: string) => SKILL_BY_ID.get(id)?.label ?? id;
const TIER_WORD = { shipped: 'Shipped', demonstrated: 'Demonstrated', declared: 'Declared', described: 'Described', mentioned: 'Mentioned' } as const;
const STRENGTH_WORD = { strong: 'Strong evidence', some: 'Some evidence', thin: 'Thin evidence' } as const;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

/** One-line verdict for a role, shared by the network page's summaries and the Markdown. */
export const roleSummary = (r: ProofRole) => `${r.covered.length} of ${r.total} skills shown in the code`;

/** Title for the page and the Markdown heading. A role link names the company; a network link never needs to. */
export function proofTitle(doc: ProofDoc): string {
  const who = doc.candidate.name ?? doc.candidate.login;
  if (proofKind(doc) === 'role') return `${who}'s evidence for ${doc.roles[0].company}: ${doc.roles[0].title}`;
  return `${who}'s evidence across ${doc.roles.length} speedrun ${doc.roles.length === 1 ? 'role' : 'roles'}`;
}

/**
 * Plain Markdown for pasting into an application form, email or README.
 * Role link: the full evidence for that one role. Network link: one line per role, full detail on the page.
 */
export function proofToMarkdown(doc: ProofDoc, url: string): string {
  const c = doc.candidate;
  const lines = [
    `# ${proofTitle(doc)}`,
    '',
    `Read from [github.com/${c.login}](${c.profileUrl}) on ${fmtDate(c.evidenceFetchedAt)} by Side Quest. Full page: ${url}`,
    '',
  ];

  if (proofKind(doc) === 'network') {
    for (const r of doc.roles) lines.push(`- **${r.company}, ${r.title}**: ${STRENGTH_WORD[r.strength]}, ${roleSummary(r)}.`);
    return lines.join('\n').trimEnd() + '\n';
  }

  const r = doc.roles[0];
  lines.push(`${STRENGTH_WORD[r.strength]}: ${roleSummary(r)}.`, '');
  for (const item of r.covered) {
    const e = item.evidence;
    lines.push(`- **${label(item.skill)}** (${TIER_WORD[e.tier]}) in [${e.repo}](${e.url}): ${e.reasons.join('; ')}`);
  }
  if (r.missing.length) lines.push('', `Not shown yet: ${r.missing.map((m) => label(m.skill)).join(', ')}.`);
  const sq = sideQuestOf(r);
  if (sq) lines.push('', `Side quest: **${sq.title}** (closes ${label(sq.targetSkill)}).`);
  return lines.join('\n').trimEnd() + '\n';
}

// --- ids, tokens, hashing ------------------------------------------------------------------------

/** No 0/O, 1/l/i: ids get read aloud and retyped. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function randomString(length: number): string {
  const bytesArr = crypto.getRandomValues(new Uint8Array(length));
  // 31-char alphabet: modulo bias is < 1% and irrelevant for unguessable ids.
  return Array.from(bytesArr, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const newProofId = () => randomString(10);
export const newDeleteToken = () => randomString(32);
export const isProofId = (s: string) => /^[a-hjkmnp-z2-9]{10}$/.test(s);

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

/** HMAC-SHA256 of `message` under `secret`, as hex. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

/**
 * Rate-limit bucket: HMAC-SHA256(IP_HASH_SECRET, "day:ip"), first 16 hex chars. Keyed, because a plain hash of
 * an IPv4 address can be reversed by hashing all 2^32 addresses; without the secret that search is useless.
 * The date in the message rotates every bucket daily. Raw IPs are never stored.
 */
export const ipBucket = async (ip: string, day: string, secret: string) => (await hmacSha256Hex(secret, `${day}:${ip}`)).slice(0, 16);
