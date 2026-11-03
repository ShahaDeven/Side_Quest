import { describe, expect, it } from 'vitest';
import { importMatches, importsOf, pickSamples, usesSkill, SAMPLE_SOURCES } from '../src/lib/code';
import { SKILL_BY_ID } from '../src/lib/skills';

const skill = (id: string) => SKILL_BY_ID.get(id)!;

describe('importsOf', () => {
  it('Python: from/import, with every dotted prefix, skipping relative imports', () => {
    const text = 'from google.cloud import bigquery\nimport os, langgraph.graph as g\nfrom .local import x\n';
    expect(importsOf({ path: 'a.py', text })).toEqual(expect.arrayContaining(['google', 'google.cloud', 'os', 'langgraph', 'langgraph.graph']));
    expect(importsOf({ path: 'a.py', text })).not.toContain('.local');
  });

  it('JS/TS: import, dynamic import, require and re-export; scoped names kept whole; relative skipped', () => {
    const text = "import React from 'react';\nconst x = await import('next/router');\nconst y = require('fastify');\nexport { z } from '@langchain/langgraph/prebuilt';\nimport './local';\n";
    expect(importsOf({ path: 'a.tsx', text }).sort()).toEqual(['@langchain/langgraph', 'fastify', 'next', 'react']);
  });

  it('Go and Rust', () => {
    expect(importsOf({ path: 'a.go', text: 'import (\n  "fmt"\n  kafka "github.com/segmentio/kafka-go"\n)\n' })).toEqual(['fmt', 'github.com/segmentio/kafka-go']);
    expect(importsOf({ path: 'a.rs', text: 'use tokio::sync;\nextern crate serde;\n' })).toEqual(['tokio', 'serde']);
  });
});

describe('importMatches', () => {
  it('maps module names onto package names, including the ones that differ', () => {
    expect(importMatches(skill('rag'), 'sentence_transformers')).toBe(true);
    expect(importMatches(skill('rag'), 'faiss')).toBe(true); // faiss-cpu
    expect(importMatches(skill('ml'), 'sklearn')).toBe(true); // scikit-learn
    expect(importMatches(skill('gcp'), 'google.cloud.bigquery')).toBe(true); // google-cloud-*
    expect(importMatches(skill('agents'), 'json')).toBe(false);
  });
});

describe('usesSkill', () => {
  it('code patterns count only in the files they are about', () => {
    const docker = skill('docker');
    expect(usesSkill(docker, [{ path: 'Dockerfile', text: 'FROM node:24\n' }]).files).toEqual(['Dockerfile']);
    expect(usesSkill(docker, [{ path: 'notes.py', text: '# FROM here on\n' }]).files).toEqual([]);
  });

  it('SQL statements must be upper-case keywords, not prose', () => {
    const sql = skill('sql');
    expect(usesSkill(sql, [{ path: 'q.py', text: 'Q = "SELECT id FROM users"' }]).files).toHaveLength(1);
    expect(usesSkill(sql, [{ path: 'q.py', text: '"""select the best one from the list"""' }]).files).toHaveLength(0);
  });

  it('a hand-written eval harness is demonstrated by its scoring functions', () => {
    const evals = skill('evals');
    expect(usesSkill(evals, [{ path: 'evals/scorer.py', text: 'def score_answer(pred, gold):\n    return pred == gold\n' }]).files).toHaveLength(1);
    expect(usesSkill(evals, [{ path: 'app/scorer.py', text: 'def score_answer(pred, gold):\n    return 1\n' }]).files).toHaveLength(0);
  });
});

describe('pickSamples', () => {
  const sizes = (paths: string[], n = 2_000) => Object.fromEntries(paths.map((p) => [p, n]));

  it('takes one file from each skill folder first, preferring entry points', () => {
    const paths = ['mcp_servers/x/tools.py', 'mcp_servers/x/server.py', ...Array.from({ length: 10 }, (_, i) => `agent/a${i}.py`)];
    const s = sizes(paths);
    s['mcp_servers/x/tools.py'] = 13_000;
    const picked = pickSamples(paths, s);
    expect(picked).toContain('mcp_servers/x/server.py');
    expect(picked.filter((p) => !p.includes('test'))).toHaveLength(SAMPLE_SOURCES);
  });

  it('skips tiny, huge, vendored and non-code files', () => {
    const paths = ['src/a.py', 'src/empty.py', 'src/huge.py', 'node_modules/x/index.js', 'src/types.d.ts', 'docs/readme.py'];
    const s = { ...sizes(paths), 'src/empty.py': 10, 'src/huge.py': 500_000 };
    expect(pickSamples(paths, s)).toEqual(['src/a.py']);
  });

  it('adds up to 2 test files and config artefacts', () => {
    const paths = ['src/a.py', 'tests/test_a.py', 'tests/test_b.py', 'tests/test_c.py', 'Dockerfile', '.github/workflows/ci.yml'];
    const picked = pickSamples(paths, sizes(paths));
    expect(picked.filter((p) => p.startsWith('tests/'))).toHaveLength(2);
    expect(picked).toEqual(expect.arrayContaining(['Dockerfile', '.github/workflows/ci.yml']));
  });
});
