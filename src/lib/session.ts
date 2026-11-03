/** URL ⇄ view state, so every view is a shareable link (`?demo=1`, `?user=octocat&role=6b385ffe&view=founder`). */
import type { Role } from './types';

export type View = 'candidate' | 'founder';

export interface UrlState {
  demo: boolean;
  user: string | null;
  /** Role id or its first 8 characters. */
  role: string | null;
  /** Detail tab, or null when the URL doesn't name one (the mode's default applies). */
  view?: View | null;
}

/** The demo opens on what the founder sees; a candidate's own read opens on their report. */
export const defaultView = (demo: boolean): View => (demo ? 'founder' : 'candidate');

export function readUrl(search: string): UrlState {
  const q = new URLSearchParams(search);
  const v = q.get('view');
  return {
    demo: q.get('demo') === '1',
    user: q.get('user')?.trim() || null,
    role: q.get('role')?.trim() || null,
    view: v === 'founder' || v === 'candidate' ? v : null,
  };
}

/** Writes the view only when it differs from the mode's default, so the canonical demo link stays `?demo=1`. */
export function writeUrl(s: UrlState): string {
  const q = new URLSearchParams();
  if (s.demo) q.set('demo', '1');
  else if (s.user) q.set('user', s.user);
  if (s.role) q.set('role', s.role.slice(0, 8));
  if (s.view && s.view !== defaultView(s.demo)) q.set('view', s.view);
  const str = q.toString();
  return str ? `?${str}` : '';
}

export const findRole = (roles: Role[], ref: string | null) =>
  ref ? (roles.find((r) => r.id === ref) ?? roles.find((r) => r.id.startsWith(ref)) ?? null) : null;
