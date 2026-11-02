import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import snapshotJson from '../../data/jobs-snapshot.json';
import { refreshRoleSet } from '../../lib/speedrun';
import type { RoleSet } from '../../lib/types';

export const prerender = false;

const snapshot = snapshotJson as RoleSet;
// Keyed to the bundled snapshot, so a new snapshot or deploy never serves a merge built on an older one.
const CACHE_KEY = `roles:${snapshot.fn}:${snapshot.fetchedAt}`;
const CACHE_TTL_S = 60 * 60; // 24 KV writes/day at most; the free plan allows 1,000

/**
 * All roles for the MVP function, with descriptions.
 * KV cache → live refresh on top of the bundled snapshot → the snapshot itself.
 * The `x-roles-source` header says which one answered.
 */
export const GET: APIRoute = async () => {
  const cached = await env.CACHE.get<RoleSet>(CACHE_KEY, 'json').catch(() => null);
  if (cached) return respond(cached, 'cache');

  try {
    const fresh = await refreshRoleSet(snapshot);
    await env.CACHE.put(CACHE_KEY, JSON.stringify(fresh), { expirationTtl: CACHE_TTL_S }).catch((e) =>
      console.warn('roles: KV put failed', e),
    );
    return respond(fresh, 'live');
  } catch (e) {
    console.error('roles: live refresh failed, serving snapshot', e);
    return respond(snapshot, 'snapshot');
  }
};

function respond(set: RoleSet, source: string) {
  return new Response(JSON.stringify(set), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'x-roles-source': source,
    },
  });
}
