import { describe, expect, it } from 'vitest';
import { parseManifest, parsePyproject, parseRequirements } from '../src/lib/manifests';

describe('parseManifest', () => {
  it('reads every dependency table of package.json', () => {
    const m = parseManifest('web/package.json', JSON.stringify({ dependencies: { react: '^19' }, devDependencies: { typescript: '^6' } }));
    expect(m).toEqual({ path: 'web/package.json', ecosystem: 'npm', deps: ['react', 'typescript'] });
  });

  it('returns no deps for broken JSON instead of throwing', () => {
    expect(parseManifest('package.json', '{ nope')?.deps).toEqual([]);
  });

  it('recognises requirements-*.txt as PyPI', () => {
    expect(parseManifest('sqlforge/requirements-grpo.txt', 'trl==0.12\npeft>=0.13')?.deps).toEqual(['trl', 'peft']);
  });

  it('ignores unknown files', () => {
    expect(parseManifest('README.md', '# hi')).toBeNull();
  });
});

describe('parseRequirements', () => {
  it('strips versions, extras, markers and comments; skips options and URLs', () => {
    const text = [
      '# core',
      'langgraph>=0.2  # agents',
      'pyannote.audio[onnx]==3.1; python_version < "3.13"',
      '-r base.txt',
      '-e .',
      'git+https://github.com/x/y.git',
      '',
      'Flask',
    ].join('\n');
    expect(parseRequirements(text)).toEqual(['langgraph', 'pyannote.audio', 'Flask']);
  });
});

describe('parsePyproject', () => {
  it('reads PEP 621 dependencies, optional-dependencies and dependency-groups', () => {
    const text = `
[project]
name = "x"
dependencies = [
  "anthropic>=0.40",
  "fastmcp",  # tools
]

[project.optional-dependencies]
eval = ["ragas>=0.2", "pytest"]

[dependency-groups]
dev = [
  "ruff",
]
`;
    expect(parsePyproject(text)).toEqual(['anthropic', 'fastmcp', 'ragas', 'pytest', 'ruff']);
  });

  it('reads Poetry tables and skips the python constraint', () => {
    const text = `
[tool.poetry.dependencies]
python = "^3.11"
psycopg = { version = "^3", extras = ["binary"] }

[tool.poetry.group.dev.dependencies]
pytest = "^8"
`;
    expect(parsePyproject(text)).toEqual(['psycopg', 'pytest']);
  });
});
