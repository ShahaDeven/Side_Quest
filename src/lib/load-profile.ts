import { isValidLogin } from './github';
import type { CandidateProfile } from './types';

export type ProfileResult =
  | { ok: true; profile: CandidateProfile }
  | { ok: false; code: 'invalid-login' | 'not-found' | 'rate-limited' | 'failed' | 'offline'; message: string };

/** The demo candidate, captured at build time. Separate chunk: only fetched when the demo is shown. */
export async function loadDemoProfile(): Promise<CandidateProfile> {
  return (await import('../data/demo-profile.json')).default as CandidateProfile;
}

/** Browser-side: ask our Worker to read a GitHub profile. Never calls GitHub directly. */
export async function loadProfile(login: string, timeoutMs = 25_000): Promise<ProfileResult> {
  if (!isValidLogin(login)) return { ok: false, code: 'invalid-login', message: 'That is not a valid GitHub username.' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`/api/github/${encodeURIComponent(login)}`, { signal: ctrl.signal });
    const body = (await res.json().catch(() => null)) as (Partial<CandidateProfile> & { error?: string; message?: string }) | null;
    if (res.ok && body?.login) return { ok: true, profile: body as CandidateProfile };
    const known = ['invalid-login', 'not-found', 'rate-limited', 'failed'] as const;
    const code = known.find((k) => k === body?.error) ?? 'failed';
    return { ok: false, code, message: body?.message ?? 'Could not read GitHub right now.' };
  } catch {
    return { ok: false, code: 'offline', message: 'Could not reach the server. The demo profile still works offline.' };
  } finally {
    clearTimeout(timer);
  }
}
