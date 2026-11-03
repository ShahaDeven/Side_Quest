import { describe, expect, it } from 'vitest';
import { buildProfile, mergeEvidence, readmeText, repoEvidence, resumeEvidence, where, withResume, type RepoFacts } from '../src/lib/evidence';
import type { RepoSummary } from '../src/lib/types';

const summary = (over: Partial<RepoSummary> = {}): RepoSummary => ({
  name: 'agent-lab',
  url: 'https://github.com/dev/agent-lab',
  description: '',
  language: null,
  topics: [],
  stars: 0,
  pushedAt: '2026-10-01T00:00:00Z',
  homepage: null,
  contributors: 1,
  ownerShare: 1,
  ...over,
});

const facts = (over: Partial<RepoFacts> = {}): RepoFacts => ({
  summary: summary(),
  paths: [],
  readme: '',
  manifests: [],
  ...over,
});

const pyFiles = (n: number, dir = 'src') => Array.from({ length: n }, (_, i) => `${dir}/m${i}.py`);
const sizesOf = (paths: string[], bytes = 5_000) => Object.fromEntries(paths.map((p) => [p, bytes]));
const item = (f: RepoFacts, skill: string) => repoEvidence(f).find((e) => e.skill === skill);
const langgraph = [{ path: 'pyproject.toml', ecosystem: 'pypi' as const, deps: ['langgraph'] }];
const graphPy = { path: 'agents/graph.py', text: 'from langgraph.graph import StateGraph\n\ndef build():\n    return StateGraph(dict)\n' };
const NO_DELIVERY = { releases: 0, latestRelease: null, deployments: 0, pages: false };

describe('levels', () => {
  it('mentioned: repo language, topics, or description only', () => {
    const e = item(facts({ summary: summary({ language: 'Python', topics: ['llm-agents'] }) }), 'agents');
    expect(e?.tier).toBe('mentioned');
    expect(e?.reasons[0]).toContain('`llm-agents`');
    expect(item(facts({ summary: summary({ language: 'Python' }) }), 'python')?.reasons).toEqual(['repo language is Python']);
  });

  it('described: README prose, quoted, ignoring code blocks', () => {
    const readme = '# Lab\n\nA multi-agent planner built with LangGraph.\n\n```bash\npip install pytorch\n```';
    const e = item(facts({ readme }), 'agents');
    expect(e?.tier).toBe('described');
    expect(e?.reasons[0]).toBe('README: “A multi-agent planner built with LangGraph.”');
    expect(item(facts({ readme }), 'deep-learning')).toBeUndefined();
  });

  it('declared: a manifest listing the package is not use, even with source files', () => {
    const e = item(facts({ manifests: langgraph, paths: pyFiles(3) }), 'agents');
    expect(e).toMatchObject({ tier: 'declared', reasons: ['`pyproject.toml` lists langgraph'] });
    expect(e?.notes?.[0]).toBe('Code was not read for this profile');
  });

  it('declared, not demonstrated, when the files read never use it', () => {
    const files = [{ path: 'src/app.py', text: 'import json\n\nprint(json.dumps({}))\n' }];
    const e = item(facts({ manifests: langgraph, paths: ['src/app.py'], files, codeRead: true }), 'agents');
    expect(e?.tier).toBe('declared');
    expect(e?.notes?.[0]).toBe('Not seen in use in the 1 file read');
  });

  it('demonstrated: a file that was read imports the package', () => {
    const e = item(facts({ manifests: langgraph, paths: ['agents/graph.py'], files: [graphPy], codeRead: true }), 'agents');
    expect(e?.tier).toBe('demonstrated');
    expect(e?.reasons[0]).toBe('langgraph imported in 1 of 1 file read, in `agents/`');
    expect(e?.reasons[1]).toBe('`pyproject.toml` lists langgraph');
  });

  it('a language: file counts alone only declare it', () => {
    expect(item(facts({ paths: pyFiles(4) }), 'python')).toBeUndefined();
    expect(item(facts({ paths: pyFiles(5) }), 'python')).toMatchObject({ tier: 'declared', reasons: ['5 .py files'] });
  });

  it("a language: demonstrated on a substantial body of the candidate's own code that was read", () => {
    const paths = pyFiles(6);
    const files = [{ path: paths[0], text: 'def f():\n    return 1\n' }];
    const base = { paths, sizes: sizesOf(paths), files, codeRead: true };
    expect(item(facts(base), 'python')).toMatchObject({ tier: 'demonstrated', reasons: ['6 .py files, 30 KB; sole contributor; 1 file read'] });
    // Too little code, or mostly someone else's commits: declared only.
    expect(item(facts({ ...base, sizes: sizesOf(paths, 1_000) }), 'python')?.tier).toBe('declared');
    expect(item(facts({ ...base, summary: summary({ contributors: 4, ownerShare: 0.2 }) }), 'python')?.tier).toBe('declared');
  });

  it('SQL needs SQL statements in the code read; importing a driver only declares it', () => {
    const drv = { path: 'src/db.py', text: 'import duckdb\ncon = duckdb.connect()\n' };
    const sql = { path: 'src/report.py', text: 'Q = """SELECT region, SUM(sales) FROM orders GROUP BY region"""\n' };
    const manifests = [{ path: 'requirements.txt', ecosystem: 'pypi' as const, deps: ['duckdb'] }];
    expect(item(facts({ manifests, paths: ['src/db.py'], files: [drv], codeRead: true }), 'sql')?.tier).toBe('declared');
    expect(item(facts({ manifests, paths: ['src/db.py', 'src/report.py'], files: [drv, sql], codeRead: true }), 'sql')).toMatchObject({
      tier: 'demonstrated',
      reasons: ['SQL statements in 1 of 2 files read, in `src/`', '`requirements.txt` lists duckdb'],
    });
  });

  it('shipped: demonstrated, plus a release, deployment or Pages site recorded by GitHub', () => {
    const base = { manifests: langgraph, paths: ['agents/graph.py'], files: [graphPy], codeRead: true };
    expect(item(facts({ ...base, delivery: { ...NO_DELIVERY, releases: 3, latestRelease: 'v1.2.0' } }), 'agents')).toMatchObject({
      tier: 'shipped',
      reasons: ['langgraph imported in 1 of 1 file read, in `agents/`', '`pyproject.toml` lists langgraph', '3 GitHub releases, latest `v1.2.0`'],
    });
    expect(item(facts({ ...base, delivery: { ...NO_DELIVERY, deployments: 2 } }), 'agents')?.tier).toBe('shipped');
    expect(item(facts({ ...base, delivery: { ...NO_DELIVERY, pages: true } }), 'agents')?.tier).toBe('shipped');
    expect(item(facts({ ...base, delivery: NO_DELIVERY }), 'agents')?.tier).toBe('demonstrated');
  });

  it('tests, CI and a deploy URL are notes: they never raise a level', () => {
    const paths = ['agents/graph.py', 'tests/test_a.py', 'tests/test_b.py', '.github/workflows/ci.yml'];
    const e = item(
      facts({
        manifests: langgraph,
        paths,
        files: [graphPy],
        codeRead: true,
        delivery: NO_DELIVERY,
        summary: summary({ homepage: 'https://agent-lab.vercel.app/' }),
      }),
      'agents',
    );
    expect(e?.tier).toBe('demonstrated');
    expect(e?.notes).toEqual([
      'Repo has 2 test files in `tests/`',
      'Repo runs CI in `.github/workflows/`',
      'Deploy URL declared, not checked: agent-lab.vercel.app',
    ]);
  });

  it('notes a test file that imports the same package', () => {
    const test = { path: 'tests/test_graph.py', text: 'from langgraph.graph import StateGraph\n\ndef test_build():\n    assert StateGraph\n' };
    const e = item(
      facts({ manifests: langgraph, paths: ['agents/graph.py', 'tests/test_graph.py'], files: [graphPy, test], codeRead: true }),
      'agents',
    );
    expect(e?.notes).toContain('Tested: `tests/test_graph.py` imports it');
  });

  it('a test file that imports Playwright demonstrates browser automation', () => {
    const spec = { path: 'tests/checkout.spec.ts', text: "import { test, expect } from '@playwright/test';\ntest('pays', async ({ page }) => {});\n" };
    expect(item(facts({ paths: [spec.path], files: [spec], codeRead: true }), 'browser-automation')?.tier).toBe('demonstrated');
  });

  it("doesn't repeat a skill's own signal as its note", () => {
    const tests = ['tests/test_a.py', 'tests/test_b.py', 'tests/test_c.py'];
    const testing = item(facts({ paths: tests }), 'testing')!;
    expect(testing.tier).toBe('declared');
    expect(testing.reasons).toEqual(['3 files in `tests/`']);
    expect(testing.notes?.some((n) => n.startsWith('Repo has'))).toBe(false);
  });
});

describe('false-positive guards', () => {
  it('a charts/ folder of plots is not Kubernetes', () => {
    expect(item(facts({ paths: ['evals/charts/recall.png', 'evals/charts/latency.png'] }), 'kubernetes')).toBeUndefined();
    expect(item(facts({ paths: ['deploy/chart/Chart.yaml'] }), 'kubernetes')?.tier).toBe('declared');
  });

  it('a Dockerfile that was read and builds an image demonstrates Docker', () => {
    const files = [{ path: 'Dockerfile', text: 'FROM python:3.12-slim\nCOPY . .\n' }];
    expect(item(facts({ paths: ['Dockerfile'], files, codeRead: true }), 'docker')?.tier).toBe('demonstrated');
  });

  it('__init__.py is neither a test file nor an example', () => {
    const f = facts({ paths: [...pyFiles(6), 'pkg/tests/__init__.py', 'tests/test_one.py'] });
    expect(item(f, 'python')?.notes?.some((n) => n.startsWith('Repo has'))).toBe(false); // only 1 real test file
  });

  it('notes shared repos', () => {
    const e = item(facts({ paths: pyFiles(5), summary: summary({ contributors: 3, ownerShare: 0.82 }) }), 'python');
    expect(e?.notes?.at(-1)).toBe('1 of 3 contributors (82% of commits)');
  });
});

describe('where', () => {
  it('names the deepest shared folder, short file lists, or an example', () => {
    expect(where(['evals/a.py', 'evals/b/c.py'])).toBe('in `evals/`');
    expect(where(['Dockerfile', 'docker-compose.yml'])).toBe('`Dockerfile`, `docker-compose.yml`');
    expect(where(['a/x.py', 'b/y.py', 'c/z.py', 'd/w.py'])).toBe('e.g. `a/x.py`');
  });
});

describe('profile + resume', () => {
  it('keeps the strongest evidence first per skill', () => {
    const weak = facts({ summary: summary({ name: 'old', language: 'Python' }) });
    const strong = facts({ summary: summary({ name: 'new' }), paths: pyFiles(9) });
    const p = buildProfile({ login: 'dev', name: null, avatarUrl: null }, [weak, strong], 2);
    expect(p.evidence.python.map((e) => e.repo)).toEqual(['new', 'old']);
    expect(p.profileUrl).toBe('https://github.com/dev');
  });

  it('resume text only ever reaches mentioned, and never outranks repo evidence', () => {
    const resume = resumeEvidence('Built LangGraph agents and fine-tuned Qwen with LoRA.');
    expect(resume.every((e) => e.tier === 'mentioned' && e.source === 'resume')).toBe(true);
    expect(resume.map((e) => e.skill)).toEqual(expect.arrayContaining(['agents', 'fine-tuning']));

    const repo = mergeEvidence(repoEvidence(facts({ manifests: [{ path: 'pyproject.toml', ecosystem: 'pypi', deps: ['langgraph'] }], paths: pyFiles(2) })));
    expect(withResume(repo, resume).agents[0].source).toBe('repo');
  });
});

describe('readmeText', () => {
  it('keeps link text, drops images, html and badges', () => {
    expect(readmeText('[![ci](b.svg)](x) See [the docs](https://d) <img src="a.png"> now').replace(/\s+/g, ' ').trim()).toBe('See the docs now');
  });
});
