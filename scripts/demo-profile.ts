/**
 * Capture the demo candidate's evidence profile into src/data/demo-profile.json, then print how it
 * matches each opted-in role so the reasons can be reviewed by a human (PLAN.md Step 1.2 "done when").
 *
 *   pnpm demo-profile                 # ShahaDeven
 *   pnpm demo-profile -- --user someone --no-write
 *
 * Uses GITHUB_TOKEN from .dev.vars if present (works without it: ~32 requests, under the anonymous 60/h).
 */
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import optins from '../src/data/optins.json';
import snapshot from '../src/data/jobs-snapshot.json';
import { buildProfile } from '../src/lib/evidence';
import { fetchProfileFacts } from '../src/lib/github';
import { compareMatches, matchRole, sideQuestGate } from '../src/lib/match';
import { SKILL_BY_ID } from '../src/lib/skills';
import type { RoleSet } from '../src/lib/types';

if (existsSync('.dev.vars')) process.loadEnvFile('.dev.vars');

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const login = arg('user') ?? 'ShahaDeven';
const write = !process.argv.includes('--no-write');
const OUT = fileURLToPath(new URL('../src/data/demo-profile.json', import.meta.url));

const facts = await fetchProfileFacts(login, { token: process.env.GITHUB_TOKEN || undefined, timeoutMs: 20_000 });
const profile = buildProfile(facts.user, facts.repos, facts.reposConsidered);

console.log(`\n${profile.login}: read ${profile.repos.length} of ${profile.reposConsidered} eligible repos in depth`);
console.log(`  ${profile.repos.map((r) => r.name).join(', ')}`);
console.log(`  skills with evidence: ${Object.keys(profile.evidence).length}`);
for (const [skill, items] of Object.entries(profile.evidence)) {
  const best = items[0];
  console.log(`   ${best.tier.padEnd(12)} ${SKILL_BY_ID.get(skill)!.label.padEnd(36)} ${best.repo ?? ''} · ${best.reasons[0]}`);
}

const roles = (snapshot as RoleSet).roles;

// Calibration: a label that is "strong" for most roles means nothing.
const all = roles.map((r) => ({ r, m: matchRole(r, profile.evidence) })).sort((a, b) => compareMatches(a.m, b.m));
const dist = { strong: 0, some: 0, thin: 0 };
for (const { m } of all) dist[m.strength]++;
console.log(`\nAcross all ${roles.length} roles: strong ${dist.strong} · some ${dist.some} · thin ${dist.thin}`);
console.log('  top 10:');
for (const { r, m } of all.slice(0, 10)) console.log(`   ${m.strength.padEnd(6)} ${m.score.toFixed(2)}  ${r.company} · ${r.title}`);

for (const o of optins.roles) {
  const role = roles.find((r) => r.id === o.id);
  if (!role) {
    console.log(`\n!! ${o.company} / ${o.title}: not in snapshot (closed?)`);
    continue;
  }
  const m = matchRole(role, profile.evidence);
  const gate = sideQuestGate(m, true);
  console.log(`\n== ${role.company} · ${role.title}  →  ${m.strength.toUpperCase()} (demonstrated share ${m.score.toFixed(2)}), best repos: ${m.bestRepos.join(', ') || '-'}`);
  for (const c of m.covered)
    console.log(`  ✓ ${SKILL_BY_ID.get(c.skill)!.label.padEnd(34)} w${c.weight}  ${c.evidence.tier.padEnd(12)} ${c.evidence.repo} · ${c.evidence.reasons.join(' | ')}`);
  for (const x of m.missing)
    console.log(`  · ${SKILL_BY_ID.get(x.skill)!.label.padEnd(34)} w${x.weight}  ${(x.evidence?.tier ?? 'none').padEnd(12)} JD: “${x.quote.slice(0, 90)}”`);
  console.log(`  side quest: ${gate.reason}${gate.target ? ` → target ${SKILL_BY_ID.get(gate.target.skill)!.label}` : ''}`);
}

if (write) {
  await writeFile(OUT, JSON.stringify(profile, null, 1) + '\n');
  console.log(`\nwrote ${OUT}`);
}
