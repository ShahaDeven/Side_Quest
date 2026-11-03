/**
 * Hand-check evaluation: does Side Quest's evidence hold up when a person reads the code?
 *
 *   pnpm eval-claims -- --users alice,bob,carol,dan,erin            # 30 claims, spread across levels and users
 *   pnpm eval-claims -- --users alice,bob --claims 20 --out evals/out/mine.csv
 *
 * For each GitHub login it runs the real engine (same reader, same rules as the Worker) and samples claims across
 * levels: Shipped/Demonstrated, Declared and Described. For every Demonstrated or Shipped claim it re-downloads the
 * files that show the skill from raw.githubusercontent.com and checks, independently of the GraphQL read, that the
 * import or code is really there (`auto_check`).
 *
 * It writes a CSV with an empty `your_verdict` column: open each link, judge whether the claim is fair (agree /
 * disagree / unsure), then run with --tally on the filled-in file to get the agreement rate.
 *
 *   pnpm eval-claims -- --tally evals/out/claims-2026-11-03.csv
 *
 * Only GitHub API calls (no LLM). Uses GITHUB_TOKEN from .dev.vars. The CSV names real accounts: it lands in
 * evals/out/ (gitignored). Publish only the aggregate, and only for accounts whose owners agreed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { importsOf, importMatches, usesSkill } from '../src/lib/code';
import { buildProfile, type RepoFacts } from '../src/lib/evidence';
import { fetchProfileFacts } from '../src/lib/github';
import { SKILL_BY_ID } from '../src/lib/skills';
import type { EvidenceItem, Tier } from '../src/lib/types';

if (existsSync('.dev.vars')) process.loadEnvFile('.dev.vars');

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

// --- tally mode -----------------------------------------------------------------------------------

const tallyPath = arg('tally');
if (tallyPath) {
  const rows = parseCsv(readFileSync(tallyPath, 'utf8'));
  const head = rows.shift()!;
  const v = head.indexOf('your_verdict');
  const lvl = head.indexOf('level');
  const by = new Map<string, { agree: number; disagree: number; unsure: number; blank: number }>();
  for (const r of rows) {
    const k = r[lvl];
    const t = by.get(k) ?? { agree: 0, disagree: 0, unsure: 0, blank: 0 };
    const verdict = (r[v] ?? '').trim().toLowerCase();
    if (verdict === 'agree') t.agree++;
    else if (verdict === 'disagree') t.disagree++;
    else if (verdict === 'unsure') t.unsure++;
    else t.blank++;
    by.set(k, t);
  }
  let agree = 0;
  let judged = 0;
  for (const [k, t] of by) {
    const j = t.agree + t.disagree;
    agree += t.agree;
    judged += j;
    console.log(`${k.padEnd(13)} agree ${t.agree} / disagree ${t.disagree} / unsure ${t.unsure}${t.blank ? ` / not yet judged ${t.blank}` : ''}`);
  }
  console.log(`\nAgreement: ${agree} of ${judged} judged claims (${judged ? Math.round((100 * agree) / judged) : 0}%). Unsure claims are left out.`);
  process.exit(0);
}

// --- sample mode ----------------------------------------------------------------------------------

const users = (arg('users') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (!users.length) {
  console.error('Pass --users login1,login2,… (or --tally file.csv).');
  process.exit(1);
}
const want = Number(arg('claims') ?? 30);
const out = arg('out') ?? `evals/out/claims-${new Date().toISOString().slice(0, 10)}.csv`;
const token = process.env.GITHUB_TOKEN || undefined;
if (!token) console.warn('No GITHUB_TOKEN: no code is read, so every claim stops at Declared.');

/** The levels a reviewer should check, strongest first. Mentioned is just a tag or language: skipped. */
const BANDS: Tier[][] = [['shipped', 'demonstrated'], ['declared'], ['described']];

interface Claim {
  login: string;
  item: EvidenceItem;
  facts: RepoFacts | undefined;
}

const pools: Claim[][][] = []; // [user][band] → claims
for (const login of users) {
  process.stdout.write(`reading ${login}… `);
  const f = await fetchProfileFacts(login, { token, timeoutMs: 20_000 });
  const profile = buildProfile(f.user, f.repos, f.reposConsidered);
  const byRepo = new Map(f.repos.map((r) => [r.summary.name, r]));
  const best = Object.values(profile.evidence).map((items) => items[0]);
  pools.push(BANDS.map((band) => best.filter((e) => band.includes(e.tier)).map((item) => ({ login: profile.login, item, facts: byRepo.get(item.repo ?? '') }))));
  console.log(`${best.length} skills with evidence, code read: ${profile.codeRead ? 'yes' : 'no'}`);
}

// Round-robin over users, then over bands, so no single profile or level dominates the sample. Deterministic.
const picked: Claim[] = [];
const cursor = pools.map(() => BANDS.map(() => 0));
for (let round = 0; picked.length < want && round < 200; round++) {
  for (let u = 0; u < pools.length && picked.length < want; u++) {
    const band = round % BANDS.length;
    const list = pools[u][band];
    if (cursor[u][band] < list.length) picked.push(list[cursor[u][band]++]);
  }
}

/** Files that show the skill, re-checked against a fresh download (not the copy the engine read). */
async function autoCheck(c: Claim): Promise<{ urls: string[]; result: string }> {
  const skill = SKILL_BY_ID.get(c.item.skill)!;
  if (!c.facts || !['demonstrated', 'shipped'].includes(c.item.tier)) return { urls: [c.item.url ?? ''], result: 'n/a (not a code-level claim)' };
  const files = usesSkill(skill, c.facts.files ?? []).files;
  const lang = c.item.reasons[0]?.match(/^\d+ \S+ files, \d+ KB/);
  if (!files.length) return { urls: [c.item.url ?? ''], result: lang ? 'n/a (language volume: check the repo)' : 'no file found' };
  const repoUrl = c.facts.summary.url;
  const raw = (p: string) => `${repoUrl.replace('https://github.com/', 'https://raw.githubusercontent.com/')}/HEAD/${p}`;
  let confirmed = 0;
  for (const p of files.slice(0, 3)) {
    const res = await fetch(raw(p));
    if (!res.ok) continue;
    const text = await res.text();
    const fresh = { path: p, text };
    const ok = importsOf(fresh).some((m) => skill.importsDemonstrate !== false && importMatches(skill, m)) || usesSkill(skill, [fresh]).files.length > 0;
    if (ok) confirmed++;
  }
  return { urls: files.slice(0, 3).map((p) => `${repoUrl}/blob/HEAD/${p}`), result: `${confirmed} of ${Math.min(3, files.length)} files confirmed` };
}

const rows: string[][] = [['login', 'repo', 'skill', 'level', 'reasons', 'notes', 'files_to_open', 'auto_check', 'your_verdict', 'your_note']];
for (const c of picked) {
  const { urls, result } = await autoCheck(c);
  rows.push([
    c.login,
    c.item.repo ?? '',
    SKILL_BY_ID.get(c.item.skill)?.label ?? c.item.skill,
    c.item.tier,
    c.item.reasons.join(' | '),
    (c.item.notes ?? []).join(' | '),
    urls.join(' '),
    result,
    '',
    '',
  ]);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n');
const levels = picked.reduce<Record<string, number>>((m, c) => ((m[c.item.tier] = (m[c.item.tier] ?? 0) + 1), m), {});
console.log(`\nwrote ${picked.length} claims to ${out}`);
console.log(`levels: ${Object.entries(levels).map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log('Fill in your_verdict (agree / disagree / unsure), then: pnpm eval-claims -- --tally ' + out);

// --- csv ------------------------------------------------------------------------------------------

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ''));
}
