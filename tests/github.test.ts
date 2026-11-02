import { describe, expect, it, vi } from 'vitest';
import {
  GitHubError,
  MAX_REPOS,
  SUBREQUEST_BUDGET,
  fetchProfileFacts,
  isValidLogin,
  pickManifests,
  planManifests,
  selectRepos,
  type ApiRepo,
} from '../src/lib/github';

const NOW = Date.parse('2026-11-02T00:00:00Z');

const repo = (name: string, over: Partial<ApiRepo> = {}): ApiRepo => ({
  name,
  html_url: `https://github.com/dev/${name}`,
  description: null,
  language: 'Python',
  topics: [],
  stargazers_count: 0,
  pushed_at: '2026-10-01T00:00:00Z',
  homepage: null,
  fork: false,
  archived: false,
  size: 100,
  default_branch: 'main',
  ...over,
});

describe('selectRepos', () => {
  it('drops forks, archived, empty and profile repos', () => {
    const picked = selectRepos(
      [
        repo('dev'), // profile README repo
        repo('forked', { fork: true, topics: ['langgraph'] }),
        repo('old-archive', { archived: true }),
        repo('empty', { size: 0 }),
        repo('kept'),
      ],
      'dev',
      NOW,
    );
    expect(picked.map((r) => r.name)).toEqual(['kept']);
  });

  it('orders for coverage: the only fine-tuning repo beats a second agents repo', () => {
    const picked = selectRepos(
      [
        repo('agents-a', { topics: ['langgraph', 'mcp'] }),
        repo('agents-b', { topics: ['langgraph', 'mcp', 'rag'] }),
        repo('tuning', { topics: ['fine-tuning'] }),
        repo('stale-vision', { topics: ['computer-vision'], pushed_at: '2024-01-01T00:00:00Z' }),
      ],
      'dev',
      NOW,
    );
    expect(picked.map((r) => r.name)).toEqual(['agents-b', 'tuning', 'agents-a', 'stale-vision']);
  });
});

describe('planManifests', () => {
  it("gives every repo its first manifest before anyone's second, within budget", () => {
    expect(planManifests([['a1', 'a2'], ['b1'], ['c1', 'c2']], 4)).toEqual([['a1', 'a2'], ['b1'], ['c1']]);
    expect(planManifests([['a1', 'a2']], 0)).toEqual([[]]);
  });
});

describe('pickManifests', () => {
  it('takes the shallowest manifest per ecosystem first, skipping vendored ones', () => {
    const paths = ['web/package.json', 'node_modules/x/package.json', 'pyproject.toml', 'sub/requirements.txt', 'package.json'];
    expect(pickManifests(paths)).toEqual(['pyproject.toml', 'package.json']);
  });
});

describe('isValidLogin', () => {
  it('follows GitHub username rules', () => {
    expect(isValidLogin('ShahaDeven')).toBe(true);
    expect(isValidLogin('a-b')).toBe(true);
    expect(isValidLogin('-ab')).toBe(false);
    expect(isValidLogin('a--b')).toBe(false);
    expect(isValidLogin('../etc')).toBe(false);
  });
});

describe('fetchProfileFacts', () => {
  const defaultTree = ['pyproject.toml', 'src/a.py', 'node_modules/x.js'];

  function fakeGitHub(repos: ApiRepo[], tree = defaultTree) {
    const calls: string[] = [];
    const f = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      const json = (b: unknown) => new Response(JSON.stringify(b));
      if (path === '/users/dev') return json({ login: 'dev', name: 'Dev', avatar_url: null });
      if (path === '/users/dev/repos') return json(repos);
      if (path.includes('/git/trees/')) return json({ tree: tree.map((p) => ({ path: p, type: 'blob' })) });
      if (path.endsWith('/readme')) return new Response('', { status: 404 });
      if (path.endsWith('/contributors')) return json([{ login: 'dev', contributions: 8 }, { login: 'pal', contributions: 2 }]);
      if (path.endsWith('/contents/pyproject.toml')) return new Response('[project]\ndependencies = ["langgraph"]');
      return new Response('', { status: 404 });
    }) as unknown as typeof fetch;
    return { f, calls };
  }

  it('reads at most MAX_REPOS repos within the Worker subrequest budget', async () => {
    const repos = Array.from({ length: 10 }, (_, i) => repo(`r${i}`));
    const { f, calls } = fakeGitHub(repos);
    const out = await fetchProfileFacts('dev', { fetch: f });

    expect(out.repos).toHaveLength(MAX_REPOS);
    expect(out.reposConsidered).toBe(10);
    expect(calls.length).toBeLessThanOrEqual(SUBREQUEST_BUDGET);
    const r0 = out.repos[0];
    expect(r0.paths).toEqual(['pyproject.toml', 'src/a.py']); // vendored path dropped
    expect(r0.readme).toBe(''); // missing README is fine
    expect(r0.manifests[0].deps).toEqual(['langgraph']);
    expect(r0.summary).toMatchObject({ contributors: 2, ownerShare: 0.8 });
  });

  it('never exceeds the request budget, even when every repo has several manifests', async () => {
    const repos = Array.from({ length: 12 }, (_, i) => repo(`r${i}`));
    const { f, calls } = fakeGitHub(repos, ['pyproject.toml', 'package.json', 'go.mod', 'src/a.py']);
    await fetchProfileFacts('dev', { fetch: f });
    expect(calls.length).toBe(SUBREQUEST_BUDGET);
    expect(SUBREQUEST_BUDGET).toBeLessThan(50);
  });

  it('maps 404 and rate limits to typed errors', async () => {
    const notFound = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    await expect(fetchProfileFacts('ghost', { fetch: notFound })).rejects.toMatchObject({ kind: 'not-found' });

    const limited = vi.fn(async () => new Response('', { status: 403, headers: { 'x-ratelimit-reset': '1793600000' } })) as unknown as typeof fetch;
    const err = await fetchProfileFacts('dev', { fetch: limited }).catch((e) => e);
    expect(err).toBeInstanceOf(GitHubError);
    expect(err).toMatchObject({ kind: 'rate-limited' });
    expect(err.resetAt).toMatch(/^2026-/);
  });
});
