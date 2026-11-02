/**
 * Pre-generate side-quest briefs for opted-in roles (PLAN.md Step 1.3, prompt in §12).
 *
 *   pnpm briefs -- --dry-run            # show the plan and a cost estimate, no API calls
 *   pnpm briefs                         # generate missing briefs (cap: --max-usd, default 0.25)
 *   pnpm briefs -- --role 6b385ffe      # one role (id prefix)
 *   pnpm briefs -- --force              # also regenerate unreviewed entries that already exist
 *
 * Reviewed or hand-edited entries are never overwritten. New entries land with `reviewed: false`;
 * flip it to true in src/data/briefs.json after reading them. Only reviewed briefs ever reach the UI.
 *
 * Needs ANTHROPIC_API_KEY in .env (script-only; never in .dev.vars / the Worker).
 */
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import optins from '../src/data/optins.json';
import snapshot from '../src/data/jobs-snapshot.json';
import demoProfile from '../src/data/demo-profile.json';
import { briefTargets, validateBrief, type Brief, type BriefEntry, type BriefFile } from '../src/lib/briefs';
import { extractRequirements, matchRole, sideQuestGate } from '../src/lib/match';
import { SKILL_BY_ID } from '../src/lib/skills';
import type { CandidateProfile, Role, RoleSet } from '../src/lib/types';

const MODEL = 'claude-haiku-5-5';
/** USD per token, Claude Haiku 5.5 (prompts under 100K tokens). */
const PRICE = { input: 0.1 / 1e6, output: 0.5 / 1e6 };
const OUT = fileURLToPath(new URL('../src/data/briefs.json', import.meta.url));

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const maxUsd = Number(opt('max-usd') ?? 0.25);
const onlyRole = opt('role');

if (existsSync('.env')) process.loadEnvFile('.env');

// --- schema & prompt (PLAN.md §12) -------------------------------------------------------------

const BriefSchema = z.object({
  title: z.string().describe('Short project name, no company branding'),
  why_they_care: z.string().describe('One line, quoting or closely paraphrasing a line from the job description'),
  jd_quote: z.string().describe('The exact job-description line it is based on, copied character for character'),
  scope: z.array(z.string()).describe('3 or 4 bullets, each a concrete deliverable; at most 110 words in total'),
  stack: z.array(z.string()).describe('At most 6 tools and libraries'),
  data: z.string().describe('What demo data to use and how to get or synthesize it legally'),
  numbers: z.array(z.string()).describe('2 or 3 concrete things to measure and report'),
  done_looks_like: z.string().describe('One or two sentences'),
  founder_note: z.string().describe('At most 4 sentences, containing the placeholders [LINK] and [FINDING]'),
  risks: z.array(z.string()).describe('Anything that could backfire and how to avoid it'),
});

const SYSTEM = `You write a small proof-of-work project brief for a job candidate applying to a startup.
The founder has invited side quests for this role. The candidate already has strong evidence for most of the
role; the brief closes ONE gap: the target skill.

Use ONLY the role text you are given. Do not invent product features, customers, metrics, or internal details.
If the text doesn't support a specific claim, leave it out.

Rules:
- Extend or measure something around their product (an eval, an integration, a failure-mode analysis, a small
  missing feature). Never clone their product.
- Must be doable by one person in 1 day using only public information and synthetic or public data.
- Must not require login access to their product, their branding, or their private data.
- Must exercise the target skill, visibly: someone reading the scope should see that skill doing real work.
- One focused day, not a take-home: 3 or 4 scope bullets, at most 110 words across them, at most 6 stack
  items. Cut nice-to-haves (dashboards, extra exporters, multi-tenant features) before core work.
- why_they_care: ground it in what the text says. Do not speculate about their scale, roadmap or problems.
- jd_quote: copy one line (or one clause of a line) from the job description exactly, character for character.
  If the description names the target skill, quote a line that names it.
- founder_note: written in the candidate's voice, at most 4 sentences: what they built, the one finding (write
  the literal placeholder [FINDING]), the link (write the literal placeholder [LINK]), and an ask for a
  15-minute chat. No flattery, no "I hope this finds you well".
- Plain, specific language. No hype words ("revolutionary", "cutting-edge", "seamless").`;

function userPrompt(role: Role, skillLabel: string): string {
  return `ROLE: ${role.title} at ${role.company} (${role.seniority ?? 'level not stated'}, ${role.location ?? 'location not stated'})
COMPANY BLURB: ${role.blurb || '(none)'}
INDUSTRIES: ${role.industries.join(', ') || '(none)'}
JOB DESCRIPTION:
${role.description}

TARGET SKILL (what the candidate has not shown yet): ${skillLabel}`;
}

// --- generation --------------------------------------------------------------------------------

const client = new Anthropic();
let spent = 0;
let calls = 0;

class BudgetExceeded extends Error {}

async function call(messages: Anthropic.MessageParam[]): Promise<Brief> {
  // Stop before a call that could cross the cap: assume the next call costs as much as the priciest so far.
  const next = calls ? spent / calls * 2 : 0.01;
  if (spent + next > maxUsd) throw new BudgetExceeded(`stopping: $${spent.toFixed(4)} spent, cap $${maxUsd}`);

  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages,
    output_config: { effort: 'medium', format: zodOutputFormat(BriefSchema) },
  });
  calls++;
  spent += res.usage.input_tokens * PRICE.input + res.usage.output_tokens * PRICE.output;

  if (res.stop_reason === 'refusal') throw new Error(`refused (${res.stop_details?.category ?? 'no category'})`);
  if (res.stop_reason === 'max_tokens') throw new Error('hit max_tokens');
  if (!res.parsed_output) throw new Error('no parsed output');
  return res.parsed_output;
}

/** One attempt plus one corrective retry with the validation errors; null if both fail. */
async function generate(role: Role, skillId: string): Promise<{ brief: Brief | null; errors: string[] }> {
  const label = SKILL_BY_ID.get(skillId)!.label;
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt(role, label) }];

  const first = await call(messages);
  const errors = validateBrief(first, role.description, skillId);
  if (!errors.length) return { brief: first, errors: [] };

  messages.push(
    { role: 'assistant', content: JSON.stringify(first) },
    { role: 'user', content: `That brief failed these checks:\n- ${errors.join('\n- ')}\nReturn a corrected brief.` },
  );
  const second = await call(messages);
  const again = validateBrief(second, role.description, skillId);
  return again.length ? { brief: null, errors: again } : { brief: second, errors: [] };
}

// --- plan --------------------------------------------------------------------------------------

const roles = (snapshot as RoleSet).roles;
const profile = demoProfile as CandidateProfile;
const existing: BriefFile = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, 'utf8'))
  : { _note: '', entries: [] };

const plan: { role: Role; skill: string }[] = [];
for (const o of optins.roles) {
  if (onlyRole && !o.id.startsWith(onlyRole)) continue;
  const role = roles.find((r) => r.id === o.id);
  if (!role) {
    console.warn(`skip ${o.company}: role not in snapshot (closed?)`);
    continue;
  }
  // The demo candidate's real gap is always covered; plus the role's heaviest capability asks.
  const demoTarget = sideQuestGate(matchRole(role, profile.evidence), true).target?.skill;
  for (const skill of briefTargets(extractRequirements(role), demoTarget ? [demoTarget] : [])) {
    const prev = existing.entries.find((e) => e.roleId === role.id && e.targetSkill === skill);
    if (prev && (prev.reviewed || prev.handEdited || !flag('force'))) continue;
    plan.push({ role, skill });
  }
}

console.log(`${plan.length} briefs to generate with ${MODEL} (cap $${maxUsd}):`);
for (const p of plan) console.log(`  ${p.role.company.padEnd(10)} · ${SKILL_BY_ID.get(p.skill)!.label}`);
// ~2.5K input + ~3K output (incl. thinking) per call, worst case doubled by a retry.
console.log(`  estimate: ~$${(plan.length * (2500 * PRICE.input + 3000 * PRICE.output)).toFixed(3)} (up to 2x with retries)`);
if (flag('dry-run') || plan.length === 0) process.exit(0);

// --- run ---------------------------------------------------------------------------------------

const entries = [...existing.entries];
const dropped: string[] = [];
try {
  for (const { role, skill } of plan) {
    const tag = `${role.company} · ${SKILL_BY_ID.get(skill)!.label}`;
    try {
      const { brief, errors } = await generate(role, skill);
      if (!brief) {
        dropped.push(`${tag}: ${errors.join(' | ')}`);
        continue;
      }
      const entry: BriefEntry = {
        roleId: role.id,
        company: role.company,
        roleTitle: role.title,
        targetSkill: skill,
        reviewed: false,
        model: MODEL,
        generatedAt: new Date().toISOString(),
        brief,
      };
      const i = entries.findIndex((e) => e.roleId === role.id && e.targetSkill === skill);
      if (i >= 0) entries[i] = entry;
      else entries.push(entry);
      console.log(`  ✓ ${tag}: “${brief.title}”  ($${spent.toFixed(4)} so far)`);
    } catch (e) {
      if (e instanceof BudgetExceeded || e instanceof Anthropic.AuthenticationError) throw e;
      dropped.push(`${tag}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
} catch (e) {
  console.error(`\n${e instanceof Error ? e.message : String(e)}`);
} finally {
  const file: BriefFile = {
    _note:
      'Side-quest briefs for DEMO opt-in roles (founders have not actually opted in). Generated at build time; only entries with reviewed: true are shown. Set handEdited: true after editing so regeneration never overwrites it.',
    entries: entries.sort((a, b) => a.company.localeCompare(b.company) || a.targetSkill.localeCompare(b.targetSkill)),
  };
  await writeFile(OUT, JSON.stringify(file, null, 2) + '\n');
  console.log(`\n${calls} calls, $${spent.toFixed(4)} spent. Wrote ${OUT}`);
  if (dropped.length) console.log(`dropped ${dropped.length}:\n  ${dropped.join('\n  ')}`);
}
