/**
 * Demo candidates for the founder view (PLAN.md Step 1.6). FICTIONAL people and repos.
 *
 * Deliberately not real GitHub accounts: seeding a hiring shortlist from real profiles would publish evidence
 * about real people without their consent. No links either: a made-up username might belong to someone real.
 * The UI labels every one of these "Demo candidate". Evidence uses the same shape and reason style as the
 * engine's real output, so matching scores them exactly like a real profile.
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

const build = (specs: Spec[]): Record<string, EvidenceItem[]> => {
  const out: Record<string, EvidenceItem[]> = {};
  for (const [skill, tier, repo, ...reasons] of specs) (out[skill] ??= []).push({ skill, tier, source: 'repo', repo, reasons });
  return out;
};

const TESTS = '2 test files in `tests/`';
const CI = 'CI in `.github/workflows/`';

export const SEED_CANDIDATES: SeedCandidate[] = [
  {
    id: 'avery',
    name: 'Avery Lin',
    headline: 'Agent infrastructure: durable workflows, tracing',
    evidence: build([
      ['agents', 'shipped', 'agent-ledger', '`pyproject.toml` lists langgraph · 38 source files', '11 files in `agents/`', '14 test files in `tests/`', CI],
      ['distributed', 'shipped', 'agent-ledger', '`pyproject.toml` lists temporalio · 38 source files', '14 test files in `tests/`', CI],
      ['observability', 'shipped', 'agent-ledger', '`pyproject.toml` lists opentelemetry-sdk · 38 source files', CI],
      ['llm', 'shipped', 'agent-ledger', '`pyproject.toml` lists anthropic · 38 source files', CI],
      ['evals', 'demonstrated', 'trace-evals', '6 files in `evals/`'],
      ['python', 'shipped', 'agent-ledger', '38 .py files', '14 test files in `tests/`', CI],
      ['typescript', 'demonstrated', 'ledger-console', '`package.json` lists typescript · 22 source files', '22 .ts/.tsx files'],
      ['postgres', 'shipped', 'agent-ledger', '`pyproject.toml` lists asyncpg · 38 source files', CI],
      ['docker', 'shipped', 'agent-ledger', '2 files `Dockerfile`, `compose.yml`', CI],
      ['kubernetes', 'demonstrated', 'agent-ledger', '3 files in `deploy/k8s/`'],
      ['testing', 'shipped', 'agent-ledger', '`pyproject.toml` lists pytest · 38 source files', '14 files in `tests/`', CI],
      ['ci-cd', 'shipped', 'agent-ledger', '2 workflows in `.github/workflows/`', '14 test files in `tests/`'],
    ]),
  },
  {
    id: 'sam',
    name: 'Sam Okafor',
    headline: 'Full-stack product engineer, TypeScript',
    evidence: build([
      ['typescript', 'shipped', 'shiftboard', '`package.json` lists typescript · 64 source files', '64 .ts/.tsx files', CI, 'live at shiftboard.example'],
      ['react', 'shipped', 'shiftboard', '`package.json` lists react, react-dom · 64 source files', CI],
      ['nextjs', 'shipped', 'shiftboard', '`package.json` lists next · 64 source files', CI, 'live at shiftboard.example'],
      ['node', 'shipped', 'shiftboard-api', '`package.json` lists fastify · 30 source files', TESTS, CI],
      ['postgres', 'shipped', 'shiftboard-api', '`package.json` lists pg · 30 source files', CI],
      ['testing', 'shipped', 'shiftboard', '`package.json` lists vitest · 64 source files', '18 files in `src/__tests__/`', CI],
      ['ci-cd', 'shipped', 'shiftboard', '1 workflow in `.github/workflows/`', '18 test files in `src/__tests__/`'],
      ['llm', 'demonstrated', 'shiftboard-api', '`package.json` lists openai · 30 source files'],
      ['aws', 'demonstrated', 'shiftboard-api', '`package.json` lists @aws-sdk/client-s3 · 30 source files'],
      ['docker', 'described', 'shiftboard-api', 'README: “Run the API and Postgres with Docker Compose.”'],
      ['agents', 'described', 'shiftboard', 'README: “An agent drafts next week’s schedule for a manager to approve.”'],
    ]),
  },
  {
    id: 'priya',
    name: 'Priya Natarajan',
    headline: 'ML engineer: ranking, retrieval, recommendations',
    evidence: build([
      ['search-ranking', 'shipped', 'two-tower-recs', '`pyproject.toml` lists implicit · 27 source files', '9 test files in `tests/`', CI],
      ['ml', 'shipped', 'two-tower-recs', '`pyproject.toml` lists scikit-learn, lightgbm · 27 source files', CI],
      ['deep-learning', 'shipped', 'two-tower-recs', '`pyproject.toml` lists torch · 27 source files', CI],
      ['rag', 'demonstrated', 'paper-search', '`requirements.txt` lists faiss-cpu, sentence-transformers · 12 source files'],
      ['data-pipelines', 'shipped', 'two-tower-recs', '5 files in `pipelines/`', CI],
      ['python', 'shipped', 'two-tower-recs', '27 .py files', '9 test files in `tests/`', CI],
      ['sql', 'shipped', 'two-tower-recs', '`pyproject.toml` lists duckdb · 27 source files', CI],
      ['gcp', 'demonstrated', 'two-tower-recs', '`pyproject.toml` lists google-cloud-bigquery · 27 source files'],
      ['fine-tuning', 'demonstrated', 'paper-search', '`requirements.txt` lists peft · 12 source files'],
      ['llm', 'demonstrated', 'paper-search', '`requirements.txt` lists litellm · 12 source files'],
      ['evals', 'described', 'paper-search', 'README: “Retrieval quality is scored against 200 hand-labelled LLM queries.”'],
    ]),
  },
  {
    id: 'mateo',
    name: 'Mateo Ruiz',
    headline: 'Data engineer: pipelines and warehouses',
    evidence: build([
      ['data-pipelines', 'shipped', 'freight-etl', '`pyproject.toml` lists dagster · 41 source files', '12 files in `pipelines/`', CI],
      ['python', 'shipped', 'freight-etl', '41 .py files', '10 test files in `tests/`', CI],
      ['sql', 'shipped', 'freight-etl', '23 .sql files', CI],
      ['postgres', 'shipped', 'freight-etl', '`pyproject.toml` lists psycopg · 41 source files', CI],
      ['aws', 'shipped', 'freight-etl', '`pyproject.toml` lists boto3 · 41 source files', CI],
      ['docker', 'shipped', 'freight-etl', '2 files `Dockerfile`, `docker-compose.yml`', CI],
      ['distributed', 'demonstrated', 'freight-stream', '`requirements.txt` lists confluent-kafka · 9 source files'],
      ['testing', 'demonstrated', 'freight-etl', '`pyproject.toml` lists pytest · 41 source files', '10 files in `tests/`'],
      ['ci-cd', 'demonstrated', 'freight-etl', '1 workflow in `.github/workflows/`'],
      ['llm', 'mentioned', 'freight-etl', 'tagged `llm`'],
    ]),
  },
  {
    id: 'jordan',
    name: 'Jordan Kim',
    headline: 'New-grad generalist: coursework and hackathons',
    evidence: build([
      ['python', 'demonstrated', 'campus-eats', '14 .py files'],
      ['javascript', 'demonstrated', 'campus-eats-web', '9 .js/.jsx files'],
      ['react', 'demonstrated', 'campus-eats-web', '`package.json` lists react · 9 source files'],
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
    evidence: build([
      ['testing', 'shipped', 'checkout-e2e', '`package.json` lists @playwright/test · 48 source files', '48 files in `tests/`', CI],
      ['browser-automation', 'shipped', 'checkout-e2e', '`package.json` lists @playwright/test · 48 source files', CI],
      ['typescript', 'shipped', 'checkout-e2e', '`package.json` lists typescript · 48 source files', '48 .ts files', CI],
      ['ci-cd', 'shipped', 'checkout-e2e', '3 workflows in `.github/workflows/`', '48 test files in `tests/`'],
      ['evals', 'demonstrated', 'llm-regression-kit', '7 files in `evals/`'],
      ['llm', 'demonstrated', 'llm-regression-kit', '`requirements.txt` lists openai · 11 source files'],
      ['python', 'demonstrated', 'llm-regression-kit', '11 .py files'],
      ['docker', 'demonstrated', 'checkout-e2e', '1 file `Dockerfile`'],
      ['observability', 'described', 'llm-regression-kit', 'README: “Each run exports traces so failures can be replayed.”'],
    ]),
  },
];
