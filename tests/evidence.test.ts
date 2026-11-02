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
const item = (f: RepoFacts, skill: string) => repoEvidence(f).find((e) => e.skill === skill);

describe('tiers', () => {
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

  it('demonstrated: manifest lists the package AND ecosystem source files exist', () => {
    const manifests = [{ path: 'pyproject.toml', ecosystem: 'pypi' as const, deps: ['langgraph'] }];
    expect(item(facts({ manifests, paths: pyFiles(3) }), 'agents')).toMatchObject({
      tier: 'demonstrated',
      reasons: ['`pyproject.toml` lists langgraph · 3 source files'],
    });
    // A manifest with no matching source files proves nothing.
    expect(item(facts({ manifests, paths: ['web/app.ts'] }), 'agents')?.tier).not.toBe('demonstrated');
  });

  it('demonstrated: enough source files for a language', () => {
    expect(item(facts({ paths: pyFiles(4) }), 'python')).toBeUndefined();
    expect(item(facts({ paths: pyFiles(5) }), 'python')?.reasons[0]).toBe('5 .py files');
  });

  it('shipped: demonstrated plus tests, CI or a live deploy', () => {
    const f = facts({
      paths: [...pyFiles(6), 'tests/test_a.py', 'tests/test_b.py', '.github/workflows/ci.yml'],
      summary: summary({ homepage: 'https://agent-lab.vercel.app/' }),
    });
    expect(item(f, 'python')).toMatchObject({
      tier: 'shipped',
      reasons: ['8 .py files', '2 test files in `tests/`', 'CI in `.github/workflows/`', 'live at agent-lab.vercel.app'],
    });
  });

  it("doesn't repeat a skill's own signal as its shipped extra", () => {
    const f = facts({ paths: ['tests/test_a.py', 'tests/test_b.py', 'tests/test_c.py'] });
    const testing = item(f, 'testing')!;
    expect(testing.tier).toBe('demonstrated');
    expect(testing.reasons).toEqual(['3 files in `tests/`']);
  });
});

describe('false-positive guards', () => {
  it('a charts/ folder of plots is not Kubernetes', () => {
    expect(item(facts({ paths: ['evals/charts/recall.png', 'evals/charts/latency.png'] }), 'kubernetes')).toBeUndefined();
    expect(item(facts({ paths: ['deploy/chart/Chart.yaml'] }), 'kubernetes')?.tier).toBe('demonstrated');
  });

  it('__init__.py is neither a test file nor an example', () => {
    const f = facts({ paths: [...pyFiles(6), 'pkg/tests/__init__.py', 'tests/test_one.py'] });
    expect(item(f, 'python')?.tier).toBe('demonstrated'); // only 1 real test file: not shipped
  });

  it('notes shared repos', () => {
    const e = item(facts({ paths: pyFiles(5), summary: summary({ contributors: 3, ownerShare: 0.82 }) }), 'python');
    expect(e?.reasons.at(-1)).toBe('1 of 3 contributors (82% of commits)');
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
