import type { RoleSet } from './types';

export interface LoadedRoles {
  set: RoleSet;
  /** `api` = our Worker answered (it may itself have served the snapshot); `bundled` = Worker unreachable. */
  via: 'api' | 'bundled';
}

/** Browser-side: ask the Worker, and fall back to the bundled snapshot so the page is never empty. */
export async function loadRoles(timeoutMs = 8000): Promise<LoadedRoles> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('/api/roles', { signal: ctrl.signal });
    if (res.ok) {
      const set = (await res.json()) as RoleSet;
      if (Array.isArray(set.roles) && set.roles.length > 0) return { set, via: 'api' };
    }
  } catch {
    // fall through to the bundled snapshot
  } finally {
    clearTimeout(timer);
  }
  // Separate chunk: only downloaded when the Worker is unavailable.
  const snapshot = await import('../data/jobs-snapshot.json');
  return { set: snapshot.default as RoleSet, via: 'bundled' };
}
