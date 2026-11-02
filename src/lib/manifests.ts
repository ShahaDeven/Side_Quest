/**
 * Dependency manifests → package names. Deliberately small parsers: we only need names, not versions,
 * and a wrong edge case costs one missed Demonstrated signal, never a false one.
 */

export type Ecosystem = 'npm' | 'pypi' | 'go' | 'cargo';

export interface Manifest {
  path: string;
  ecosystem: Ecosystem;
  deps: string[];
}

/** Source extensions that count as "matching source files" for each ecosystem's packages. */
export const ECOSYSTEM_EXTS: Record<Ecosystem, string[]> = {
  npm: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.astro', '.vue', '.svelte'],
  pypi: ['.py', '.ipynb'],
  go: ['.go'],
  cargo: ['.rs'],
};

/** Manifest file names we read, best first within an ecosystem. */
export function manifestKind(path: string): Ecosystem | null {
  const base = path.split('/').pop()!.toLowerCase();
  if (base === 'package.json') return 'npm';
  if (base === 'pyproject.toml' || /^requirements[\w.-]*\.txt$/.test(base)) return 'pypi';
  if (base === 'go.mod') return 'go';
  if (base === 'cargo.toml') return 'cargo';
  return null;
}

export function parseManifest(path: string, text: string): Manifest | null {
  const ecosystem = manifestKind(path);
  if (!ecosystem) return null;
  const base = path.split('/').pop()!.toLowerCase();
  const deps =
    base === 'package.json' ? parsePackageJson(text)
    : base === 'pyproject.toml' ? parsePyproject(text)
    : ecosystem === 'pypi' ? parseRequirements(text)
    : ecosystem === 'go' ? parseGoMod(text)
    : parseCargo(text);
  return { path, ecosystem, deps: [...new Set(deps)] };
}

export function parsePackageJson(text: string): string[] {
  try {
    const pkg = JSON.parse(text) as Record<string, unknown>;
    return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].flatMap((k) =>
      pkg[k] && typeof pkg[k] === 'object' ? Object.keys(pkg[k] as object) : [],
    );
  } catch {
    return [];
  }
}

/** `name[extra]>=1.0 ; python_version<"3.12"` → `name`. */
const requirementName = (spec: string) => spec.trim().match(/^([A-Za-z0-9][A-Za-z0-9._-]*)/)?.[1] ?? null;

export function parseRequirements(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+#.*$/, '').trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('-') && !/^(git\+|https?:)/.test(l))
    .flatMap((l) => requirementName(l) ?? []);
}

/** PEP 621 `dependencies` / optional-dependencies / dependency-groups, and Poetry tables. */
export function parsePyproject(text: string): string[] {
  const out: string[] = [];
  let table = '';
  let inArray = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    const header = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (header && !inArray) {
      table = header[1].trim();
      continue;
    }

    if (inArray) {
      for (const m of line.matchAll(/["']([^"']+)["']/g)) {
        const n = requirementName(m[1]);
        if (n) out.push(n);
      }
      if (line.includes(']')) inArray = false;
      continue;
    }

    const kv = line.match(/^\s*([\w.-]+)\s*=\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;

    const poetryDeps = /^tool\.poetry\.(group\.[\w-]+\.)?(dev-)?dependencies$/.test(table);
    if (poetryDeps) {
      if (key.toLowerCase() !== 'python') out.push(key);
      continue;
    }

    const arrayTable = table === 'project.optional-dependencies' || table === 'dependency-groups';
    if (value.trimStart().startsWith('[') && (key.endsWith('dependencies') || arrayTable)) {
      for (const m of value.matchAll(/["']([^"']+)["']/g)) {
        const n = requirementName(m[1]);
        if (n) out.push(n);
      }
      inArray = !value.includes(']');
    }
  }
  return out;
}

export function parseGoMod(text: string): string[] {
  const out: string[] = [];
  let block = false;
  for (const line of text.split(/\r?\n/).map((l) => l.trim())) {
    if (line.startsWith('require (')) block = true;
    else if (block && line === ')') block = false;
    else if (block && line) out.push(line.split(/\s+/)[0]);
    else if (line.startsWith('require ')) out.push(line.split(/\s+/)[1]);
  }
  return out.filter(Boolean);
}

export function parseCargo(text: string): string[] {
  const out: string[] = [];
  let deps = false;
  for (const line of text.split(/\r?\n/)) {
    const header = line.match(/^\s*\[([^\]]+)\]/);
    if (header) {
      deps = /(^|\.)(dev-|build-)?dependencies$/.test(header[1].trim());
      continue;
    }
    const kv = deps && line.match(/^\s*([\w-]+)\s*=/);
    if (kv) out.push(kv[1]);
  }
  return out;
}
