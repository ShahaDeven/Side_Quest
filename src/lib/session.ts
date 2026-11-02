/** URL ⇄ view state, so every view is a shareable link (`?demo=1`, `?user=octocat&role=6b385ffe`). */
import type { Role } from './types';

export interface UrlState {
  demo: boolean;
  user: string | null;
  /** Role id or its first 8 characters. */
  role: string | null;
}

export function readUrl(search: string): UrlState {
  const q = new URLSearchParams(search);
  return {
    demo: q.get('demo') === '1',
    user: q.get('user')?.trim() || null,
    role: q.get('role')?.trim() || null,
  };
}

export function writeUrl(s: UrlState): string {
  const q = new URLSearchParams();
  if (s.demo) q.set('demo', '1');
  else if (s.user) q.set('user', s.user);
  if (s.role) q.set('role', s.role.slice(0, 8));
  const str = q.toString();
  return str ? `?${str}` : '';
}

export const findRole = (roles: Role[], ref: string | null) =>
  ref ? (roles.find((r) => r.id === ref) ?? roles.find((r) => r.id.startsWith(ref)) ?? null) : null;
