import { describe, expect, it } from 'vitest';
import { SKILL_BY_ID, findSkill, normalizePackage, packageMatches } from '../src/lib/skills';

const skill = (id: string) => SKILL_BY_ID.get(id)!;
const finds = (id: string, text: string) => findSkill(skill(id), text) >= 0;

describe('text matching', () => {
  it('matches dotted and symbol names as whole words', () => {
    expect(finds('node', 'Experience with Node.js services')).toBe(true);
    expect(finds('nextjs', 'our Next.js frontend')).toBe(true);
    expect(finds('cpp', 'modern C++ and Python')).toBe(true);
  });

  it('keeps case-sensitive names from matching ordinary English', () => {
    expect(finds('react', 'Strong React and TypeScript skills')).toBe(true);
    expect(finds('react', 'react quickly to customer feedback')).toBe(false);
    expect(finds('rust', 'Rust or Go services')).toBe(true);
    expect(finds('rust', 'build trust and rust-free hardware')).toBe(false);
  });

  it('does not confuse neighbouring names', () => {
    expect(finds('java', 'JavaScript and TypeScript')).toBe(false);
    expect(finds('java', 'Java or Kotlin backends')).toBe(true);
    expect(finds('sql', 'PostgreSQL and NoSQL stores')).toBe(false);
    expect(finds('sql', 'fluent in SQL')).toBe(true);
  });

  it('only reads "Go" as the language in language-like contexts', () => {
    expect(finds('go', 'Backend in Go, Rust, or Python')).toBe(true);
    expect(finds('go', 'services written in Go')).toBe(true);
    expect(finds('go', 'Go-to-market experience')).toBe(false);
    expect(finds('go', 'Go above and beyond for customers')).toBe(false);
  });

  it('does not treat a CUDA GPU mention as C++ work', () => {
    expect(finds('cpp', 'Runs on a CUDA 12.8 GPU pod in 16 minutes')).toBe(false);
  });

  it('does not read "queues" the verb as distributed systems', () => {
    expect(finds('distributed', 'Approving a quote writes the new prices and queues the reply')).toBe(false);
    expect(finds('distributed', 'Experience with message queues and Kafka')).toBe(true);
  });
});

describe('packages', () => {
  it('normalizes PyPI names (PEP 503)', () => {
    expect(normalizePackage('Pyannote.Audio')).toBe('pyannote-audio');
    expect(packageMatches(skill('speech'), 'pyannote_audio')).toBe(true);
  });

  it('supports scope/prefix wildcards', () => {
    expect(packageMatches(skill('observability'), '@opentelemetry/api')).toBe(true);
    expect(packageMatches(skill('gcp'), 'google-cloud-bigquery')).toBe(true);
    expect(packageMatches(skill('agents'), 'langgraph')).toBe(true);
    expect(packageMatches(skill('agents'), 'langgraph-checkpoint')).toBe(false);
  });

  it('experiment tracking is not observability', () => {
    expect(packageMatches(skill('observability'), 'mlflow')).toBe(false);
    expect(packageMatches(skill('observability'), 'langfuse')).toBe(true);
  });
});
