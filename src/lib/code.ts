/**
 * Reading real source code, so "Demonstrated" means the code uses a skill, not that a manifest lists it.
 *
 *   pickSamples  which files to read from a repo's tree (small, authored, likely to use its dependencies)
 *   importsOf    module names a file imports, per language
 *   usesSkill    does a read file import one of the skill's packages, or contain its code pattern?
 *
 * Pure: no fetching. `github.ts` reads the chosen files (one GraphQL request for every repo).
 */
import { SKILLS, normalizePackage, packageMatches, type Skill } from './skills';

export interface SourceFile {
  path: string;
  text: string;
}

const VENDORED = /(^|\/)(node_modules|vendor|dist|build|out|\.venv|venv|env|site-packages|__pycache__|\.next|\.astro|coverage|third_party|\.git)\//;
export const isVendored = (path: string) => VENDORED.test(path);

/** Files bigger than this are mostly generated or data; imports sit at the top anyway. */
export const MAX_SAMPLE_BYTES = 24_000;
const MIN_SAMPLE_BYTES = 80;
/** Per repo: source files, test files, and config artefacts (Dockerfile, workflow, k8s manifest, .sql). */
export const SAMPLE_SOURCES = 8;
export const SAMPLE_TESTS = 2;
export const SAMPLE_ARTEFACTS = 3;

const SOURCE_EXT = /\.(py|ts|tsx|js|jsx|mjs|cjs|go|rs)$/;
const TEST_PATH = /(^|\/)(tests?|__tests__|spec)\/|(^|\/)test_[^/]+\.py$|_test\.(py|go)$|\.(test|spec)\.[jt]sx?$/;
const ARTEFACT = /(^|\/)Dockerfile[^/]*$|(^|\/)(docker-)?compose\.ya?ml$|^\.github\/workflows\/[^/]+\.ya?ml$|(^|\/)(k8s|kubernetes|helm)\/[^/]+\.ya?ml$|\.sql$/;
const NOT_CODE = /(^|\/)(migrations?|fixtures?|mocks?|examples?|docs?|scripts?\/generated)\/|\.d\.ts$|\.min\.js$|(^|\/)(setup|conftest|__init__)\.py$|\.config\.[cm]?[jt]s$/;
/** Entry points: where a framework is wired up (a FastMCP server, a FastAPI app), so its import is there. */
const ENTRY = /(^|\/)(main|app|server|index|cli|__main__)\.\w+$/;
/** Names that usually hold the work: entry points and the folders skills live in. */
const LIKELY = /(^|\/)(main|app|server|index|cli|agent|graph|pipeline|worker|api|routes?|model|train|eval\w*|retriev\w*|rag|tools?)[^/]*\.\w+$|(^|\/)(src|app|lib|agents?|evals?|rag|api|server|pipelines?)\//;

export const isTestPath = (p: string) => TEST_PATH.test(p);

/** Every skill's folder patterns (evals/, agents/, mcp…), except Testing's: tests have their own quota. */
const SKILL_GROUPS = SKILLS.filter((s) => s.id !== 'testing' && s.paths?.length).map((s) => s.paths!);
const SKILL_PATHS = SKILL_GROUPS.flat();

/**
 * Up to SAMPLE_SOURCES authored source files (entry points and skill folders first, then the larger ones),
 * SAMPLE_TESTS test files and SAMPLE_ARTEFACTS config artefacts. Sizes come from the git tree.
 */
export function pickSamples(paths: string[], sizes: Record<string, number>): string[] {
  const fits = (p: string) => {
    const s = sizes[p] ?? 0;
    return s >= MIN_SAMPLE_BYTES && s <= MAX_SAMPLE_BYTES && !isVendored(p);
  };
  // Files in a skill's own folder (agents/, evals/, mcp_servers/…) first: they are where a declared dependency
  // would be used. Then entry points, then size. Shallow paths break ties.
  const score = (p: string) =>
    (SKILL_PATHS.some((re) => re.test(p)) ? 4_000_000 : 0) +
    (ENTRY.test(p) ? 2_000_000 : 0) +
    (LIKELY.test(p) ? 1_000_000 : 0) +
    (sizes[p] ?? 0) -
    p.split('/').length * 500;
  // At most 2 files per folder on the first pass, so one busy directory can't use up the whole sample.
  const best = (list: string[], n: number) => {
    const ranked = [...list].sort((a, b) => score(b) - score(a) || a.localeCompare(b));
    const perDir = new Map<string, number>();
    const picked: string[] = [];
    for (const p of ranked) {
      const dir = p.slice(0, p.lastIndexOf('/') + 1);
      if (picked.length < n && (perDir.get(dir) ?? 0) < 2) {
        picked.push(p);
        perDir.set(dir, (perDir.get(dir) ?? 0) + 1);
      }
    }
    for (const p of ranked) if (picked.length < n && !picked.includes(p)) picked.push(p);
    return picked;
  };

  const code = paths.filter((p) => SOURCE_EXT.test(p) && fits(p) && !NOT_CODE.test(p));
  const authored = code.filter((p) => !isTestPath(p));
  // Coverage first: the best file from each skill folder present (mcp_servers/, evals/, agents/…), so a declared
  // dependency is looked for where it would be used. Then the best of the rest.
  const sources: string[] = [];
  for (const group of SKILL_GROUPS) {
    if (sources.length >= SAMPLE_SOURCES) break;
    const top = best(authored.filter((p) => group.some((re) => re.test(p)) && !sources.includes(p)), 1)[0];
    if (top) sources.push(top);
  }
  for (const p of best(authored.filter((p) => !sources.includes(p)), SAMPLE_SOURCES)) if (sources.length < SAMPLE_SOURCES) sources.push(p);
  const tests = best(code.filter(isTestPath), SAMPLE_TESTS);
  const artefacts = paths.filter((p) => ARTEFACT.test(p) && fits(p)).slice(0, SAMPLE_ARTEFACTS);
  return [...sources, ...tests, ...artefacts];
}

// --- imports -----------------------------------------------------------------------------------

const PY_FROM = /^[ \t]*from[ \t]+([A-Za-z_][\w.]*)[ \t]+import\b/gm;
const PY_IMPORT = /^[ \t]*import[ \t]+([A-Za-z_][\w., \t]*)/gm;
const JS_IMPORT = /(?:\bimport\s[^'"`;]*?\bfrom\s*|\bimport\s*\(\s*|\brequire\(\s*|\bimport\s+|\bexport\s[^'"`;]*?\bfrom\s*)['"]([^'"]+)['"]/g;
const GO_SINGLE = /^\s*import\s+(?:[\w.]+\s+)?"([^"]+)"/gm;
const GO_BLOCK = /^\s*import\s*\(([\s\S]*?)\)/gm;
const RS_USE = /^\s*(?:pub\s+)?(?:use|extern\s+crate)\s+([A-Za-z_]\w*)/gm;

/** Module names a file imports. Python gives every dotted prefix ("google", "google.cloud", "google.cloud.bigquery"). */
export function importsOf(file: SourceFile): string[] {
  const { path, text } = file;
  const out = new Set<string>();
  const add = (m: string) => m && out.add(m);
  if (/\.py$/.test(path)) {
    const prefixes = (mod: string) => mod.split('.').map((_, i, a) => a.slice(0, i + 1).join('.'));
    for (const m of text.matchAll(PY_FROM)) if (!m[1].startsWith('.')) prefixes(m[1]).forEach(add);
    for (const m of text.matchAll(PY_IMPORT))
      for (const part of m[1].split(',')) prefixes(part.trim().split(/\s+/)[0]).forEach(add);
  } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path)) {
    for (const m of text.matchAll(JS_IMPORT)) {
      const spec = m[1];
      if (spec.startsWith('.') || spec.startsWith('/')) continue;
      const parts = spec.replace(/^node:/, '').split('/');
      add(spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
    }
  } else if (/\.go$/.test(path)) {
    for (const m of text.matchAll(GO_SINGLE)) add(m[1]);
    for (const m of text.matchAll(GO_BLOCK)) for (const q of m[1].matchAll(/"([^"]+)"/g)) add(q[1]);
  } else if (/\.rs$/.test(path)) {
    for (const m of text.matchAll(RS_USE)) add(m[1]);
  }
  return [...out];
}

/** Import names that differ from the published package name. */
const IMPORT_ALIASES: Record<string, string> = {
  airflow: 'apache-airflow',
  dbt: 'dbt-core',
  faiss: 'faiss-cpu',
  kafka: 'kafka-python',
  phoenix: 'arize-phoenix',
  autogen: 'pyautogen',
  sklearn: 'scikit-learn',
  cv2: 'opencv-python',
  whisper: 'openai-whisper',
  speech_recognition: 'speechrecognition',
  pyannote: 'pyannote.audio',
  segment_anything: 'segment-anything',
  pinecone: 'pinecone',
};

/** Does an imported module name satisfy one of the skill's package patterns? */
export function importMatches(skill: Skill, module: string): boolean {
  if (!skill.packages?.length) return false;
  const top = module.split('.')[0];
  const names = [module, normalizePackage(module), IMPORT_ALIASES[top], IMPORT_ALIASES[module]].filter(Boolean) as string[];
  return names.some((n) => packageMatches(skill, n));
}

export interface CodeUse {
  /** Files that import one of the skill's packages, or contain its code pattern. */
  files: string[];
  /** What was found: the packages imported, or "SQL statements". */
  what: string[];
}

/** How `files` use `skill`. Code patterns only count in files of the kind the pattern is about. */
export function usesSkill(skill: Skill, files: SourceFile[]): CodeUse {
  const hit = new Set<string>();
  const what = new Set<string>();
  for (const f of files) {
    for (const mod of importsOf(f)) {
      if (skill.importsDemonstrate !== false && importMatches(skill, mod)) {
        hit.add(f.path);
        what.add(mod.split('.')[0]);
      }
    }
    for (const cp of skill.code ?? []) {
      if ((!cp.files || cp.files.test(f.path)) && cp.pattern.test(f.text)) {
        hit.add(f.path);
        what.add(cp.label);
      }
    }
  }
  return { files: [...hit], what: [...what] };
}

/** Skills a set of files demonstrates, for quick checks in scripts and tests. */
export const skillsUsed = (files: SourceFile[], skills: Skill[] = SKILLS) => skills.filter((s) => usesSkill(s, files).files.length).map((s) => s.id);
