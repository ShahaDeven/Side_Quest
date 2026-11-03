/** Worker-only: the role set every route agrees on (KV cache → live refresh → bundled snapshot). */
import { env } from 'cloudflare:workers';
import snapshotJson from '../data/jobs-snapshot.json';
import { refreshRoleSet } from '../lib/speedrun';
import type { RoleSet } from '../lib/types';

export const snapshot = snapshotJson as RoleSet;

// Keyed to the bundled snapshot, so a new snapshot or deploy never serves a merge built on an older one.
const CACHE_KEY = `roles:${snapshot.fn}:${snapshot.fetchedAt}`;
const CACHE_TTL_S = 60 * 60; // ≤ 24 KV writes/day; the free plan allows 1,000

export type RoleSetSource = 'cache' | 'live' | 'snapshot';

export async function getRoleSet(): Promise<{ set: RoleSet; source: RoleSetSource }> {
  const cached = await env.CACHE.get<RoleSet>(CACHE_KEY, 'json').catch(() => null);
  if (cached) return { set: cached, source: 'cache' };

  try {
    const fresh = await refreshRoleSet(snapshot);
    await env.CACHE.put(CACHE_KEY, JSON.stringify(fresh), { expirationTtl: CACHE_TTL_S }).catch((e) =>
      console.warn('roles: KV put failed', e),
    );
    return { set: fresh, source: 'live' };
  } catch (e) {
    console.error('roles: live refresh failed, serving snapshot', e);
    return { set: snapshot, source: 'snapshot' };
  }
}
