/**
 * Regenerate src/data/jobs-snapshot.json from the live speedrun API.
 *
 *   pnpm snapshot              # engineering (MVP scope)
 *   pnpm snapshot -- --fn design
 *
 * The snapshot is both the Worker's base (descriptions it can't refetch within the subrequest limit)
 * and the client's fallback when the Worker is unreachable.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchCompany, fetchJobDetail, fetchJobList, normalizeRole } from '../src/lib/speedrun';
import type { ApiCompany, ApiJobDetail } from '../src/lib/speedrun';
import type { RoleSet } from '../src/lib/types';

const OUT = fileURLToPath(new URL('../src/data/jobs-snapshot.json', import.meta.url));
const fnArg = process.argv.indexOf('--fn');
const fn = fnArg > -1 ? process.argv[fnArg + 1] : 'engineering';
const opts = { timeoutMs: 15_000 }; // a build script can afford to wait

/** Run `task` over `items` with at most `limit` in flight. Be polite to a public API. */
async function pool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await task(items[i]);
      }
    }),
  );
  return out;
}

const list = await fetchJobList(fn, opts);
console.log(`list: ${list.jobs.length} roles (API total ${list.total})`);

const details = await pool(list.jobs, 6, (j) => fetchJobDetail(j.id, opts));
const slugs = [...new Set(list.jobs.flatMap((j) => (j.company_slug ? [j.company_slug] : [])))];
const companies = new Map<string, ApiCompany>(
  (await pool(slugs, 6, (s) => fetchCompany(s, opts))).map((c) => [c.slug, c]),
);
console.log(`details: ${details.length}, companies: ${companies.size}`);

const roles = details.map((d: ApiJobDetail) =>
  normalizeRole(d, d.company_slug ? companies.get(d.company_slug) : undefined),
);
const missing = roles.filter((r) => !r.description).map((r) => `${r.company} / ${r.title}`);
if (missing.length) console.warn(`no description for ${missing.length}: ${missing.join('; ')}`);

const set: RoleSet = {
  fn,
  roles,
  total: list.total,
  functionCounts: list.functionCounts,
  fetchedAt: new Date().toISOString(),
  source: 'snapshot',
};
await writeFile(OUT, JSON.stringify(set, null, 1) + '\n');
console.log(`wrote ${OUT}`);
