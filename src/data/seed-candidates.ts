/**
 * Demo candidates for the founder view (PLAN.md Step 1.6). FICTIONAL people and repos.
 *
 * Deliberately not real GitHub accounts: seeding a hiring shortlist from real profiles would publish evidence
 * about real people without their consent. No links either: a made-up username might belong to someone real.
 * The UI labels every one of these "Demo candidate". Evidence uses the same levels, reason style and notes as
 * the engine's real output (evidence.ts), so matching scores them exactly like a real profile:
 *   declared      a dependency file or matching files, with "Not seen in use in the N files read"
 *   demonstrated  imports or code found in the files read; a language needs a substantial body of own code
 *   shipped       demonstrated, plus a GitHub release, successful deployment or Pages site
 */
import type { EvidenceItem, Tier } from '../lib/types';

export interface SeedCandidate {
  id: string;
  name: string;
  /** One-line archetype shown under the name. */
  headline: string;
  evidence: Record<string, EvidenceItem[]>;
}

type Spec = [skill: string, tier: Tier, repo: string, ...reasons: string[]];

/** Practice notes per repo: context beside declared-or-better evidence, never a level. */
type RepoNotes = Record<string, string[]>;

const READ = 'Not seen in use in the 8 files read';

const build = (specs: Spec[], repoNotes: RepoNotes = {}): Record<string, EvidenceItem[]> => {
  const out: Record<string, EvidenceItem[]> = {};
  for (const [skill, tier, repo, ...reasons] of specs) {
    const practice = ['declared', 'demonstrated', 'shipped'].includes(tier) ? (repoNotes[repo] ?? []) : [];
    const notes = [...(tier === 'declared' ? [READ] : []), ...practice.filter((n) => !(skill === 'testing' && n.includes('test file')) && !(skill === 'ci-cd' && n.includes('CI')))];
    (out[skill] ??= []).push({ skill, tier, source: 'repo', repo, reasons, ...(notes.length ? { notes } : {}) });
  }
  return out;
};

const CI = 'Repo runs CI in `.github/workflows/`';
const tests = (n: number, dir = 'tests') => `Repo has ${n} test files in \`${dir}/\``;

export const SEED_CANDIDATES: SeedCandidate[] = [
  {
    id: 'avery',
    name: 'Avery Lin',
    headline: 'Agent infrastructure: durable workflows, tracing',
    evidence: build(
      [
        ['agents', 'shipped', 'agent-ledger', 'langgraph imported in 4 of 8 files read, in `agents/`', '`pyproject.toml` lists langgraph', '4 GitHub releases, latest `v0.6.0`'],
        ['distributed', 'shipped', 'agent-ledger', 'temporalio imported in 3 of 8 files read, e.g. `agent_ledger/workflows.py`', '`pyproject.toml` lists temporalio', '4 GitHub releases, latest `v0.6.0`'],
        ['observability', 'shipped', 'agent-ledger', 'opentelemetry imported in 2 of 8 files read, e.g. `agent_ledger/tracing.py`', '`pyproject.toml` lists opentelemetry-sdk', '4 GitHub releases, latest `v0.6.0`'],
        ['llm', 'shipped', 'agent-ledger', 'anthropic imported in 2 of 8 files read, in `agents/`', '`pyproject.toml` lists anthropic', '4 GitHub releases, latest `v0.6.0`'],
        ['evals', 'demonstrated', 'trace-evals', 'scoring functions in 2 of 8 files read, in `evals/`'],
        ['python', 'shipped', 'agent-ledger', '38 .py files, 212 KB; sole contributor; 6 files read', '4 GitHub releases, latest `v0.6.0`'],
        ['typescript', 'demonstrated', 'ledger-console', "22 .ts/.tsx files, 61 KB; sole contributor; 6 files read"],
        ['postgres', 'shipped', 'agent-ledger', 'asyncpg imported in 1 of 8 files read, e.g. `agent_ledger/store.py`', '`pyproject.toml` lists asyncpg', '4 GitHub releases, latest `v0.6.0`'],
        ['docker', 'shipped', 'agent-ledger', 'a Dockerfile that builds an image in 1 of 8 files read, e.g. `Dockerfile`', '4 GitHub releases, latest `v0.6.0`'],
        ['kubernetes', 'declared', 'agent-ledger', '3 files in `deploy/k8s/`'],
        ['testing', 'shipped', 'agent-ledger', 'pytest imported in 2 of 8 files read, in `tests/`', 'test cases in 2 of 8 files read, in `tests/`', '4 GitHub releases, latest `v0.6.0`'],
        ['ci-cd', 'shipped', 'agent-ledger', 'a workflow that runs jobs in 1 of 8 files read, e.g. `.github/workflows/ci.yml`', '4 GitHub releases, latest `v0.6.0`'],
      ],
      { 'agent-ledger': [tests(14), CI] },
    ),
  },
  {
    id: 'sam',
    name: 'Sam Okafor',
    headline: 'Full-stack product engineer, TypeScript',
    evidence: build(
      [
        ['typescript', 'shipped', 'shiftboard', '64 .ts/.tsx files, 188 KB; sole contributor; 6 files read', '31 successful GitHub deployments'],
        ['react', 'shipped', 'shiftboard', 'react imported in 5 of 8 files read, in `src/`', '`package.json` lists react, react-dom', '31 successful GitHub deployments'],
        ['nextjs', 'shipped', 'shiftboard', 'next imported in 3 of 8 files read, in `src/app/`', '`package.json` lists next', '31 successful GitHub deployments'],
        ['node', 'demonstrated', 'shiftboard-api', 'fastify imported in 3 of 8 files read, in `src/routes/`', '`package.json` lists fastify'],
        ['postgres', 'demonstrated', 'shiftboard-api', 'pg imported in 2 of 8 files read, e.g. `src/db.ts`', '`package.json` lists pg'],
        ['testing', 'shipped', 'shiftboard', 'vitest imported in 2 of 8 files read, in `src/__tests__/`', 'test cases in 2 of 8 files read, in `src/__tests__/`', '31 successful GitHub deployments'],
        ['ci-cd', 'shipped', 'shiftboard', 'a workflow that runs jobs in 1 of 8 files read, e.g. `.github/workflows/ci.yml`', '31 successful GitHub deployments'],
        ['llm', 'declared', 'shiftboard-api', '`package.json` lists openai'],
        ['aws', 'demonstrated', 'shiftboard-api', '@aws-sdk/client-s3 imported in 1 of 8 files read, e.g. `src/uploads.ts`', '`package.json` lists @aws-sdk/client-s3'],
        ['sql', 'demonstrated', 'shiftboard-api', 'SQL statements in 2 of 8 files read, e.g. `src/db.ts`'],
        ['docker', 'described', 'shiftboard-api', 'README: “Run the API and Postgres with Docker Compose.”'],
        ['agents', 'described', 'shiftboard', 'README: “An agent drafts next week’s schedule for a manager to approve.”'],
      ],
      { shiftboard: [tests(18, 'src/__tests__'), CI], 'shiftboard-api': [tests(6), CI] },
    ),
  },
  {
    id: 'priya',
    name: 'Priya Natarajan',
    headline: 'ML engineer: ranking, retrieval, recommendations',
    evidence: build(
      [
        ['search-ranking', 'demonstrated', 'two-tower-recs', 'implicit imported in 2 of 8 files read, e.g. `recs/candidates.py`', '`pyproject.toml` lists implicit'],
        ['ml', 'demonstrated', 'two-tower-recs', 'sklearn, lightgbm imported in 3 of 8 files read, e.g. `recs/rank.py`', '`pyproject.toml` lists scikit-learn, lightgbm'],
        ['deep-learning', 'demonstrated', 'two-tower-recs', 'torch imported in 3 of 8 files read, e.g. `recs/model.py`', '`pyproject.toml` lists torch'],
        ['rag', 'shipped', 'paper-search', 'faiss, sentence_transformers imported in 2 of 8 files read, e.g. `search/index.py`', '`requirements.txt` lists faiss-cpu, sentence-transformers', 'published with GitHub Pages'],
        ['data-pipelines', 'declared', 'two-tower-recs', '5 files in `pipelines/`'],
        ['python', 'demonstrated', 'two-tower-recs', '27 .py files, 96 KB; 88% of commits are the candidate’s; 6 files read'],
        ['sql', 'demonstrated', 'two-tower-recs', 'SQL statements in 1 of 8 files read, e.g. `recs/features.py`'],
        ['gcp', 'declared', 'two-tower-recs', '`pyproject.toml` lists google-cloud-bigquery'],
        ['fine-tuning', 'declared', 'paper-search', '`requirements.txt` lists peft'],
        ['llm', 'demonstrated', 'paper-search', 'litellm imported in 1 of 8 files read, e.g. `search/answer.py`', '`requirements.txt` lists litellm'],
        ['evals', 'described', 'paper-search', 'README: “Retrieval quality is scored against 200 hand-labelled LLM queries.”'],
      ],
      { 'two-tower-recs': [tests(9), CI] },
    ),
  },
  {
    id: 'mateo',
    name: 'Mateo Ruiz',
    headline: 'Data engineer: pipelines and warehouses',
    evidence: build(
      [
        ['data-pipelines', 'demonstrated', 'freight-etl', 'dagster imported in 4 of 8 files read, in `pipelines/`', '`pyproject.toml` lists dagster'],
        ['python', 'demonstrated', 'freight-etl', '41 .py files, 134 KB; sole contributor; 6 files read'],
        ['sql', 'demonstrated', 'freight-etl', 'SQL statements in 3 of 8 files read, in `models/`'],
        ['postgres', 'demonstrated', 'freight-etl', 'psycopg imported in 2 of 8 files read, e.g. `freight/load.py`', '`pyproject.toml` lists psycopg'],
        ['aws', 'demonstrated', 'freight-etl', 'boto3 imported in 2 of 8 files read, e.g. `freight/extract.py`', '`pyproject.toml` lists boto3'],
        ['docker', 'demonstrated', 'freight-etl', 'a Dockerfile that builds an image in 1 of 8 files read, e.g. `Dockerfile`'],
        ['distributed', 'declared', 'freight-stream', '`requirements.txt` lists confluent-kafka'],
        ['testing', 'demonstrated', 'freight-etl', 'pytest imported in 2 of 8 files read, in `tests/`', 'test cases in 2 of 8 files read, in `tests/`'],
        ['ci-cd', 'demonstrated', 'freight-etl', 'a workflow that runs jobs in 1 of 8 files read, e.g. `.github/workflows/ci.yml`'],
        ['llm', 'mentioned', 'freight-etl', 'tagged `llm`'],
      ],
      { 'freight-etl': [tests(10), CI] },
    ),
  },
  {
    id: 'jordan',
    name: 'Jordan Kim',
    headline: 'New-grad generalist: coursework and hackathons',
    evidence: build([
      ['python', 'declared', 'campus-eats', '14 .py files'],
      ['javascript', 'declared', 'campus-eats-web', '9 .js/.jsx files'],
      ['react', 'demonstrated', 'campus-eats-web', 'react imported in 4 of 8 files read, in `src/`', '`package.json` lists react'],
      ['llm', 'described', 'study-buddy', 'README: “Uses an LLM to turn lecture notes into flashcards.”'],
      ['agents', 'mentioned', 'study-buddy', 'tagged `ai-agents`'],
      ['testing', 'described', 'campus-eats', 'README: “Run the unit tests with pytest.”'],
      ['sql', 'mentioned', 'campus-eats', 'description: “Menu data in SQLite.”'],
    ]),
  },
  {
    id: 'noor',
    name: 'Noor Haddad',
    headline: 'Test automation engineer, moving into AI QA',
    evidence: build(
      [
        ['testing', 'demonstrated', 'checkout-e2e', '@playwright/test imported in 2 of 8 files read, in `tests/`', 'test cases in 2 of 8 files read, in `tests/`'],
        ['browser-automation', 'demonstrated', 'checkout-e2e', '@playwright/test imported in 2 of 8 files read, in `tests/`', '`package.json` lists @playwright/test'],
        ['typescript', 'demonstrated', 'checkout-e2e', '48 .ts files, 74 KB; sole contributor; 6 files read'],
        ['ci-cd', 'demonstrated', 'checkout-e2e', 'a workflow that runs jobs in 1 of 8 files read, e.g. `.github/workflows/e2e.yml`'],
        ['evals', 'declared', 'llm-regression-kit', '7 files in `evals/`'],
        ['llm', 'demonstrated', 'llm-regression-kit', 'openai imported in 3 of 8 files read, in `evals/`', '`requirements.txt` lists openai'],
        ['python', 'declared', 'llm-regression-kit', '11 .py files'],
        ['docker', 'demonstrated', 'checkout-e2e', 'a Dockerfile that builds an image in 1 of 8 files read, e.g. `Dockerfile`'],
        ['observability', 'described', 'llm-regression-kit', 'README: “Each run exports traces so failures can be replayed.”'],
      ],
      { 'checkout-e2e': [tests(48), CI] },
    ),
  },
];
