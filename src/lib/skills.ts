/**
 * Engineering skill taxonomy (~35 skills). PLAN.md §5.
 *
 * Each skill says how it shows up at each evidence level:
 *  - text (aliases / exact / patterns): JD requirements, README prose, repo topics, resume
 *  - languages: GitHub's repo `language` field (a Mentioned signal only)
 *  - packages: dependency names. Listed in a manifest = Declared; imported by a file that was read = Demonstrated
 *  - exts / paths: matching files exist = Declared. Languages reach Demonstrated only on a substantial body of
 *    the candidate's own code (evidence.ts); a file count alone never does
 *  - code: patterns in a read file that are the skill itself (SQL statements, a Dockerfile's FROM) = Demonstrated
 */

export type Category = 'language' | 'frontend' | 'backend' | 'infra' | 'ai' | 'practice';

export interface Skill {
  id: string;
  label: string;
  category: Category;
  /** Case-insensitive phrases, matched on word boundaries. */
  aliases: string[];
  /** Case-sensitive phrases, for words that are also ordinary English ("React", "Rust", "Swift"). */
  exact?: string[];
  /** Escape hatch for genuinely ambiguous names (Go). */
  patterns?: RegExp[];
  /** GitHub `language` values that count as a mention. */
  languages?: string[];
  /** npm / PyPI / Go / Cargo package names (lowercase; prefix match when ending in `*`). */
  packages?: string[];
  /** File extensions whose count can demonstrate the skill (`minFiles`, default 5). */
  exts?: string[];
  /** Paths that demonstrate the skill when at least `minFiles` (default 2) source files match. */
  paths?: RegExp[];
  minFiles?: number;
  /** Code that is the skill itself, found in a file that was read. `files` limits which files it counts in. */
  code?: CodePattern[];
  /**
   * False when importing a package isn't the skill: importing duckdb isn't writing SQL. Its packages then count
   * only as Declared, and Demonstrated needs `code` (SQL statements).
   */
  importsDemonstrate?: false;
}

export interface CodePattern {
  pattern: RegExp;
  files?: RegExp;
  /** Shown in the reason: "SQL statements in 3 files read". */
  label: string;
}

/** Words that make a generic term ("evaluation", "benchmark") specifically about LLM/agent work. Not "model": ML models are everywhere. */
const AI_CONTEXT = String.raw`\b(?:llms?|agents?|agentic|prompts?|genai|generative ai|language models?|chatbots?|rag|copilots?|ai)\b`;

export const SKILLS: Skill[] = [
  // --- languages ---
  { id: 'python', label: 'Python', category: 'language', aliases: ['python'], languages: ['Python', 'Jupyter Notebook'], exts: ['.py', '.ipynb'] },
  { id: 'typescript', label: 'TypeScript', category: 'language', aliases: ['typescript'], exact: ['TS'], languages: ['TypeScript'], packages: ['typescript'], exts: ['.ts', '.tsx'] },
  { id: 'javascript', label: 'JavaScript', category: 'language', aliases: ['javascript', 'es6'], exact: ['JS'], languages: ['JavaScript'], exts: ['.js', '.jsx', '.mjs'] },
  {
    id: 'go', label: 'Go', category: 'language', aliases: ['golang'],
    // "Go" only when it reads as the language: "Go, Rust", "(Go)", "Go services", "in Go".
    patterns: [/(?<![A-Za-z-])Go(?=\s*(?:[,/)]|and\b|or\b|services?\b|backend\b|microservices\b|developers?\b|engineers?\b|experience\b|code\b))/, /\b(?:in|with|using|write|writing)\s+Go\b(?!-)/],
    languages: ['Go'], exts: ['.go'],
  },
  { id: 'rust', label: 'Rust', category: 'language', aliases: [], exact: ['Rust'], languages: ['Rust'], exts: ['.rs'] },
  { id: 'java', label: 'Java', category: 'language', aliases: [], exact: ['Java'], languages: ['Java'], exts: ['.java'] },
  { id: 'cpp', label: 'C++', category: 'language', aliases: ['c++'], languages: ['C++', 'Cuda'], exts: ['.cpp', '.cc', '.hpp', '.cu'] },
  { id: 'sql', label: 'SQL', category: 'language', aliases: ['sql', 'text-to-sql', 'mysql', 'sqlite'], packages: ['duckdb', 'sqlglot', 'sqlalchemy', 'sqlite3'], exts: ['.sql'], minFiles: 2, importsDemonstrate: false,
    // Upper-case keywords only: "select the best one from…" in a docstring is prose, not a query.
    code: [{ pattern: /\bSELECT\b[\s\S]{1,300}?\bFROM\b|\bINSERT\s+INTO\b|\bCREATE\s+(?:TABLE|VIEW|INDEX)\b|\bUPDATE\s+\w+\s+SET\b/, label: 'SQL statements' }],
  },
  { id: 'ios', label: 'iOS / Swift', category: 'language', aliases: ['ios', 'swiftui', 'uikit', 'xcode'], exact: ['Swift'], languages: ['Swift'], exts: ['.swift'] },
  { id: 'android', label: 'Android / Kotlin', category: 'language', aliases: ['android', 'kotlin', 'jetpack compose'], languages: ['Kotlin'], exts: ['.kt'] },

  // --- frontend ---
  { id: 'react', label: 'React', category: 'frontend', aliases: ['react.js', 'reactjs', 'react native'], exact: ['React'], packages: ['react', 'react-dom', 'react-native'] },
  { id: 'nextjs', label: 'Next.js', category: 'frontend', aliases: ['next.js', 'nextjs'], packages: ['next'] },

  // --- backend ---
  { id: 'node', label: 'Node.js backend', category: 'backend', aliases: ['node.js', 'nodejs', 'express.js', 'nestjs', 'fastify'], exact: ['Node', 'Express'], packages: ['express', 'fastify', 'hono', '@nestjs/core', 'koa'] },
  { id: 'python-backend', label: 'Python APIs (FastAPI/Django/Flask)', category: 'backend', aliases: ['fastapi', 'django', 'flask'], packages: ['fastapi', 'django', 'flask', 'starlette', 'litestar'] },
  { id: 'postgres', label: 'PostgreSQL', category: 'backend', aliases: ['postgresql', 'postgres', 'supabase'], packages: ['psycopg', 'psycopg2', 'psycopg2-binary', 'asyncpg', 'pg', 'postgres', 'supabase', '@supabase/supabase-js'] },
  {
    id: 'distributed', label: 'Distributed systems & queues', category: 'backend',
    // Not bare "queue(s)": it is also a verb ("…and queues the reply for approval").
    aliases: ['distributed systems', 'distributed system', 'message queue', 'message queues', 'job queue', 'job queues', 'task queue', 'task queues', 'kafka', 'rabbitmq', 'celery', 'event-driven', 'pub/sub', 'real-time systems'],
    exact: ['Temporal'],
    packages: ['celery', 'kafka-python', 'confluent-kafka', 'aiokafka', 'kafkajs', 'pika', 'rq', 'dramatiq', 'temporalio', '@temporalio/*', 'bullmq', 'ray'],
  },

  // --- infra & practice ---
  { id: 'docker', label: 'Docker', category: 'infra', aliases: ['docker', 'containers', 'containerization', 'containerized'], paths: [/(^|\/)Dockerfile[^/]*$/, /(^|\/)(docker-)?compose\.ya?ml$/], minFiles: 1,
    code: [
      { pattern: /^\s*FROM\s+\S+/m, files: /(^|\/)Dockerfile[^/]*$/, label: 'a Dockerfile that builds an image' },
      { pattern: /^services:\s*$/m, files: /(^|\/)(docker-)?compose\.ya?ml$/, label: 'a compose file defining services' },
    ],
  },
  // Not a bare `charts/` folder: that is usually plots. A Helm chart has a Chart.yaml.
  { id: 'kubernetes', label: 'Kubernetes', category: 'infra', aliases: ['kubernetes', 'k8s', 'helm', 'eks', 'gke'], packages: ['kubernetes'], paths: [/(^|\/)(k8s|kubernetes|helm)\/[^/]+\.ya?ml$/, /(^|\/)Chart\.ya?ml$/, /(^|\/)kustomization\.ya?ml$/], minFiles: 1,
    code: [{ pattern: /^kind:\s*(?:Deployment|Service|StatefulSet|DaemonSet|Job|CronJob|Ingress|ConfigMap)\b/m, files: /\.ya?ml$/, label: 'Kubernetes manifests' }],
  },
  { id: 'aws', label: 'AWS', category: 'infra', aliases: ['aws', 'amazon web services', 's3', 'ec2', 'ecs', 'dynamodb'], exact: ['Lambda'], packages: ['boto3', 'aws-cdk-lib', '@aws-sdk/*', 'aws-cdk'] },
  { id: 'gcp', label: 'Google Cloud', category: 'infra', aliases: ['gcp', 'google cloud', 'bigquery', 'cloud run', 'vertex ai'], packages: ['google-cloud-*', '@google-cloud/*'] },
  { id: 'ci-cd', label: 'CI/CD', category: 'practice', aliases: ['ci/cd', 'continuous integration', 'github actions', 'deployment pipelines'], exact: ['CI'], paths: [/^\.github\/workflows\/[^/]+\.ya?ml$/, /^\.gitlab-ci\.yml$/, /^\.circleci\//], minFiles: 1,
    code: [{ pattern: /^jobs:\s*$[\s\S]*?^\s+steps:/m, files: /^\.github\/workflows\//, label: 'a workflow that runs jobs' }],
  },
  {
    id: 'testing', label: 'Testing & QA', category: 'practice',
    aliases: ['testing', 'unit tests', 'integration tests', 'end-to-end tests', 'e2e tests', 'test automation', 'test suites', 'test frameworks', 'regression testing', 'tdd', 'pytest', 'jest'],
    exact: ['QA'],
    packages: ['pytest', 'vitest', 'jest', 'mocha', 'hypothesis', '@playwright/test'],
    paths: [/(^|\/)(tests?|__tests__|spec)\/.+\.\w+$/, /(^|\/)test_[^/]+\.py$/, /_test\.(py|go)$/, /\.(test|spec)\.[jt]sx?$/], minFiles: 3,
    code: [
      {
        pattern: /^\s*(?:async\s+)?def\s+test_\w+|\b(?:it|test|describe)\(\s*['"`]|#\[test\]|\bfunc\s+Test\w+\(/m,
        files: /(^|\/)(tests?|__tests__|spec)\/|(^|\/)test_[^/]+\.py$|_test\.(py|go)$|\.(test|spec)\.[jt]sx?$|\.rs$/,
        label: 'test cases',
      },
    ],
  },
  {
    id: 'observability', label: 'Observability', category: 'practice',
    aliases: ['observability', 'tracing', 'opentelemetry', 'langfuse', 'datadog', 'sentry', 'prometheus', 'grafana', 'alerting', 'monitoring'],
    // Production tracing/monitoring only. MLflow is experiment tracking, not observability.
    packages: ['langfuse', 'opentelemetry-*', '@opentelemetry/*', 'prometheus-client', 'sentry-sdk', '@sentry/*', 'ddtrace', 'langsmith', 'arize-phoenix', 'logfire'],
  },
  {
    id: 'data-pipelines', label: 'Data pipelines', category: 'infra',
    aliases: ['data pipeline', 'data pipelines', 'etl', 'elt', 'airflow', 'dbt', 'spark', 'dagster', 'prefect', 'data engineering', 'data infrastructure'],
    packages: ['apache-airflow', 'dbt-core', 'prefect', 'dagster', 'pyspark', 'polars'],
    paths: [/(^|\/)(pipelines?|etl|ingest\w*)\/[^/]+\.(py|ts|sql)$/],
  },

  // --- AI / ML ---
  {
    id: 'llm', label: 'LLM applications', category: 'ai',
    aliases: ['llm', 'llms', 'large language model', 'large language models', 'language models', 'foundation models', 'frontier models', 'prompt engineering', 'gpt', 'claude', 'generative ai', 'genai'],
    packages: ['anthropic', '@anthropic-ai/sdk', 'openai', 'litellm', 'langchain', 'langchain-*', '@langchain/*', 'google-genai', 'google-generativeai', 'groq', 'mistralai', 'ollama', 'vllm', 'instructor', 'dspy', 'dspy-ai'],
  },
  {
    id: 'agents', label: 'AI agents', category: 'ai',
    aliases: ['agent', 'agents', 'agentic', 'multi-agent', 'ai agents', 'tool use', 'tool calling', 'function calling', 'langgraph', 'crewai', 'autogen', 'pydanticai', 'pydantic ai'],
    packages: ['langgraph', '@langchain/langgraph', 'crewai', 'autogen-agentchat', 'pyautogen', 'pydantic-ai', 'openai-agents', 'google-adk', 'smolagents', 'ai', '@mastra/core', 'browser-use'],
    paths: [/(^|\/)agents?\/[^/]+\.(py|ts)$/, /(^|\/)[^/]*agent[^/]*\.(py|ts)$/],
  },
  {
    id: 'evals', label: 'LLM evaluation', category: 'ai',
    // "evaluation" and "benchmark" are everyday words in ML/recsys/analytics JDs ("online/offline evaluation"
    // of a recommender is not LLM evals). They count only with an LLM/agent/AI word nearby in the same sentence.
    aliases: ['eval', 'evals', 'eval harness', 'eval harnesses', 'llm-as-a-judge', 'llm judge', 'llm-judge', 'quality gates', 'failure taxonomies', 'regression suites'],
    patterns: [
      new RegExp(`${AI_CONTEXT}[^.\\n]{0,60}?\\b(?:evaluations?|benchmark(?:s|ing)?)\\b`, 'i'),
      new RegExp(`\\b(?:evaluations?|benchmark(?:s|ing)?)\\b[^.\\n]{0,60}?${AI_CONTEXT}`, 'i'),
    ],
    packages: ['ragas', 'deepeval', 'promptfoo', 'inspect-ai', 'langsmith', 'braintrust', 'lm-eval', 'openai-evals'],
    paths: [/(^|\/)(evals?|evaluation|evaluations|benchmarks?)\/[^/]+\.(py|ts|json|jsonl|yaml)$/, /(^|\/)(eval|evaluate|benchmark)[^/]*\.(py|ts)$/],
    // A hand-written harness imports no eval library. A function that scores, grades or judges outputs, in an
    // evals file, is the harness itself.
    code: [
      {
        pattern: /^\s*(?:async\s+)?(?:def|function|export\s+(?:async\s+)?function|const)\s+\w*(?:score|grade|judge|metric|evaluate|rubric)\w*/im,
        files: /(^|\/)(evals?|evaluation|evaluations|benchmarks?)\/[^/]+\.(py|ts)$|(^|\/)(eval|evaluate|benchmark)[^/]*\.(py|ts)$/,
        label: 'scoring functions',
      },
    ],
  },
  {
    id: 'rag', label: 'RAG & retrieval', category: 'ai',
    aliases: ['rag', 'retrieval', 'retrieval-augmented', 'retrieval augmented generation', 'vector database', 'vector databases', 'vector search', 'embeddings', 'semantic search', 'pgvector', 'pinecone', 'weaviate', 'qdrant'],
    packages: ['chromadb', 'faiss-cpu', 'faiss-gpu', 'pgvector', 'qdrant-client', 'pinecone', 'pinecone-client', 'weaviate-client', 'llama-index', 'llama-index-*', 'lancedb', 'sentence-transformers', 'rank-bm25', '@pinecone-database/pinecone'],
    paths: [/(^|\/)(rag|retriev\w*|vectorstores?|embeddings?)(\/|\.py$|\.ts$)/],
  },
  {
    id: 'fine-tuning', label: 'Fine-tuning & post-training', category: 'ai',
    aliases: ['fine-tuning', 'fine-tune', 'finetuning', 'fine tuning', 'post-training', 'sft', 'dpo', 'rlhf', 'lora', 'qlora', 'distillation', 'grpo'],
    packages: ['trl', 'peft', 'unsloth', 'axolotl', 'deepspeed', 'bitsandbytes'],
    paths: [/(^|\/)[^/]*(sft|dpo|grpo|finetun\w*|fine_tun\w*|lora)[^/]*\.(py|ipynb|ya?ml)$/i],
  },
  { id: 'mcp', label: 'MCP (Model Context Protocol)', category: 'ai', aliases: ['mcp', 'model context protocol'], packages: ['mcp', 'fastmcp', '@modelcontextprotocol/sdk'], paths: [/(^|\/)[^/]*mcp[^/]*(\/|\.py$|\.ts$)/i] },
  {
    id: 'deep-learning', label: 'Deep learning (PyTorch etc.)', category: 'ai',
    aliases: ['pytorch', 'tensorflow', 'jax', 'deep learning', 'neural networks', 'neural network'],
    packages: ['torch', 'pytorch-lightning', 'lightning', 'tensorflow', 'keras', 'jax', 'flax'],
  },
  {
    id: 'ml', label: 'Machine learning & statistics', category: 'ai',
    aliases: ['machine learning', 'ml models', 'scikit-learn', 'xgboost', 'statistical modeling', 'forecasting', 'a/b testing', 'experimentation'],
    packages: ['scikit-learn', 'xgboost', 'lightgbm', 'catboost', 'statsmodels', 'scipy'],
  },
  {
    id: 'computer-vision', label: 'Computer vision', category: 'ai',
    aliases: ['computer vision', 'object detection', 'image segmentation', 'segmentation', 'opencv', 'yolo', 'vision models', 'vision-language', 'vlm', 'vlms'],
    exact: ['CV', 'SAM', 'CLIP'],
    packages: ['opencv-python', 'opencv-python-headless', 'ultralytics', 'torchvision', 'albumentations', 'segment-anything', 'timm'],
  },
  {
    id: 'speech', label: 'Voice & speech', category: 'ai',
    aliases: ['voice', 'speech', 'asr', 'tts', 'speech-to-text', 'text-to-speech', 'speech recognition', 'whisper', 'diarization', 'voice agents'],
    packages: ['openai-whisper', 'faster-whisper', 'whisperx', 'pyannote.audio', 'deepgram-sdk', 'elevenlabs', 'livekit-agents', 'pipecat-ai', 'speechrecognition'],
  },
  {
    id: 'browser-automation', label: 'Browser automation & computer use', category: 'ai',
    aliases: ['browser automation', 'web automation', 'playwright', 'selenium', 'puppeteer', 'computer use', 'computer-use', 'web agents', 'scraping', 'web scraping', 'crawling'],
    packages: ['playwright', '@playwright/test', 'playwright-core', 'selenium', 'puppeteer', 'pyppeteer', 'browser-use', '@browserbasehq/stagehand'],
  },
  {
    id: 'search-ranking', label: 'Search, ranking & recommendations', category: 'ai',
    aliases: ['search ranking', 'ranking', 'recommendations', 'recommendation systems', 'recommender', 'recommender systems', 'recsys', 'information retrieval', 'search relevance', 'elasticsearch', 'opensearch', 'bm25', 'learning to rank'],
    packages: ['elasticsearch', 'opensearch-py', 'meilisearch', 'typesense', 'rank-bm25', '@elastic/elasticsearch', 'implicit', 'lightfm'],
  },
];

export const SKILL_BY_ID: ReadonlyMap<string, Skill> = new Map(SKILLS.map((s) => [s.id, s]));

// --- text matching -----------------------------------------------------------------------------

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Word boundaries that treat `.`/`+`/`#`/`-` inside names ("node.js", "c++") as part of the word. */
const phrase = (p: string, flags: string) => new RegExp(`(?<![A-Za-z0-9])${escape(p)}(?![A-Za-z0-9+#])`, flags);

const compiled = new Map<string, RegExp[]>();

/** All regexes that recognise `skill` in prose. Cached. */
export function skillMatchers(skill: Skill): RegExp[] {
  let rs = compiled.get(skill.id);
  if (!rs) {
    rs = [
      ...skill.aliases.map((a) => phrase(a, 'i')),
      ...(skill.exact ?? []).map((a) => phrase(a, '')),
      ...(skill.patterns ?? []),
    ];
    compiled.set(skill.id, rs);
  }
  return rs;
}

/** Index of the first match of `skill` in `text`, or -1. */
export function findSkill(skill: Skill, text: string): number {
  let best = -1;
  for (const re of skillMatchers(skill)) {
    const m = re.exec(text);
    if (m && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}

/** Number of distinct places `skill` is named in `text` (capped, for "repeated" weighting). */
export function countSkill(skill: Skill, text: string, cap = 3): number {
  const hits = new Set<number>();
  for (const re of skillMatchers(skill)) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    for (const m of text.matchAll(g)) {
      hits.add(m.index);
      if (hits.size >= cap) return cap;
    }
  }
  return hits.size;
}

/** Repo topics are kebab-case ("llm-evaluation"); read them as phrases too. */
export const topicText = (topics: string[]) => topics.flatMap((t) => [t, t.replace(/-/g, ' ')]).join(' · ');

/** PEP 503-style: `pyannote.audio`, `pyannote_audio` and `Pyannote-Audio` are the same package. */
export const normalizePackage = (name: string) => name.trim().toLowerCase().replace(/[_.]+/g, '-');

/** Does a manifest dependency name satisfy one of the skill's package patterns? */
export function packageMatches(skill: Skill, dep: string): boolean {
  const d = normalizePackage(dep);
  return (skill.packages ?? []).some((raw) => {
    const p = normalizePackage(raw);
    return p.endsWith('*') ? d.startsWith(p.slice(0, -1)) : d === p;
  });
}
