import { describe, expect, it, vi } from 'vitest';
import { fetchJobList, normalizeRole, refreshRoleSet, type ApiJobListItem } from '../src/lib/speedrun';
import type { Role, RoleSet } from '../src/lib/types';

const item = (id: string, over: Partial<ApiJobListItem> = {}): ApiJobListItem => ({
  id,
  title: `Role ${id}`,
  company: 'Acme',
  company_slug: 'acme',
  url: `https://speedrun-talent-network.com/jobs/${id}`,
  location: 'San Francisco',
  workplace_type: 'Onsite',
  seniority: null,
  published_at: '2026-10-01',
  ...over,
});

/** Fake API: routes by path + `page`, records every URL it was asked for. */
function fakeApi(routes: (url: URL) => unknown) {
  const calls: URL[] = [];
  const f = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    const body = routes(url);
    return body === undefined
      ? new Response('not found', { status: 404 })
      : new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const listPages = (pages: ApiJobListItem[][], total = pages.flat().length) => (url: URL) => {
  if (url.pathname.endsWith('/jobs')) {
    const p = Number(url.searchParams.get('page'));
    return {
      jobs: pages[p] ?? [],
      total,
      page: p,
      total_pages: pages.length,
      facets: { fn: [{ v: 'engineering', n: total }, { v: 'design', n: 12 }] },
    };
  }
  return undefined;
};

describe('fetchJobList', () => {
  it('walks every 0-based page, tags requests with source, and dedupes ids', async () => {
    const { f, calls } = fakeApi(listPages([[item('a'), item('b')], [item('b'), item('c')]], 3));
    const list = await fetchJobList('engineering', { fetch: f });

    expect(list.jobs.map((j) => j.id)).toEqual(['a', 'b', 'c']);
    expect(list.total).toBe(3);
    expect(list.functionCounts).toContainEqual({ fn: 'design', n: 12 });
    expect(calls.map((u) => u.searchParams.get('page')).sort()).toEqual(['0', '1']);
    expect(calls.every((u) => u.searchParams.get('source') === 'side-quest')).toBe(true);
  });

  it('throws on a non-OK response so callers can fall back', async () => {
    const { f } = fakeApi(() => undefined);
    await expect(fetchJobList('engineering', { fetch: f })).rejects.toThrow(/404/);
  });
});

describe('normalizeRole', () => {
  it('marks stealth roles (null company_slug) and keeps them', () => {
    const r = normalizeRole(item('s', { company: 'Stealth', company_slug: null, stealth: true }));
    expect(r.stealth).toBe(true);
    expect(r.companySlug).toBeNull();
    expect(r.blurb).toBe('');
  });

  it('reads description and labels from a detail response', () => {
    const r = normalizeRole(
      { ...item('d'), description_text: 'Build agents.', labels: { specialty: 'LLM apps and agents', ai_native_role: true } },
      { slug: 'acme', name: 'Acme', blurb: 'We make things.', industries: ['computer_software'] },
    );
    expect(r).toMatchObject({ description: 'Build agents.', specialty: 'LLM apps and agents', aiNative: true, blurb: 'We make things.' });
  });
});

describe('refreshRoleSet', () => {
  const snapRole = (id: string): Role => ({ ...normalizeRole(item(id)), description: `JD ${id}`, blurb: 'Acme blurb' });
  const snapshot: RoleSet = {
    fn: 'engineering',
    roles: [snapRole('a'), snapRole('closed')],
    total: 2,
    functionCounts: [],
    fetchedAt: '2026-11-01T00:00:00Z',
    source: 'snapshot',
  };

  it('drops closed roles, reuses snapshot descriptions, fetches details only for new roles', async () => {
    const { f, calls } = fakeApi((url) => {
      if (url.pathname.endsWith('/jobs/new')) return { job: { ...item('new'), description_text: 'JD new' } };
      return listPages([[item('a', { title: 'Role a (renamed)' }), item('new')]])(url);
    });

    const set = await refreshRoleSet(snapshot, { fetch: f });

    expect(set.source).toBe('live');
    expect(set.roles.map((r) => r.id)).toEqual(['a', 'new']);
    expect(set.roles[0]).toMatchObject({ title: 'Role a (renamed)', description: 'JD a' });
    expect(set.roles[1]).toMatchObject({ description: 'JD new', blurb: 'Acme blurb' });
    expect(calls.filter((u) => /\/jobs\/[^/]+$/.test(u.pathname)).map((u) => u.pathname)).toEqual(['/api/v1/jobs/new']);
  });

  it('caps detail fetches so a Worker stays under the 50-subrequest limit', async () => {
    const fresh = Array.from({ length: 30 }, (_, i) => item(`n${i}`));
    const { f, calls } = fakeApi((url) => {
      const m = url.pathname.match(/\/jobs\/(n\d+)$/);
      if (m) return { job: { ...item(m[1]), description_text: 'x' } };
      return listPages([fresh])(url);
    });

    const set = await refreshRoleSet(snapshot, { fetch: f, maxNewDetails: 20 });

    expect(calls.length).toBeLessThanOrEqual(1 + 20);
    expect(set.roles).toHaveLength(30); // still listed, just without a description yet
    expect(set.roles.filter((r) => r.description).length).toBe(20);
  });

  it('keeps a new role even if its detail fetch fails', async () => {
    const { f } = fakeApi(listPages([[item('a'), item('broken')]]));
    const set = await refreshRoleSet(snapshot, { fetch: f });
    expect(set.roles.find((r) => r.id === 'broken')).toMatchObject({ description: '' });
  });
});
