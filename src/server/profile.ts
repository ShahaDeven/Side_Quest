/** Worker-only: a candidate's evidence profile, from the versioned KV cache or a fresh GitHub read. */
import { env } from 'cloudflare:workers';
import { EVIDENCE_VERSION, buildProfile } from '../lib/evidence';
import { fetchProfileFacts } from '../lib/github';
import type { CandidateProfile } from '../lib/types';

const CACHE_TTL_S = 6 * 60 * 60;
const cacheKey = (login: string) => `gh:v${EVIDENCE_VERSION}:${login.toLowerCase()}`;

/** Throws GitHubError (not-found / rate-limited / failed) for the caller to map to a response. */
export async function getProfile(login: string): Promise<{ profile: CandidateProfile; source: 'cache' | 'live' }> {
  const cached = await env.CACHE.get<CandidateProfile>(cacheKey(login), 'json').catch(() => null);
  if (cached) return { profile: cached, source: 'cache' };

  const facts = await fetchProfileFacts(login, { token: env.GITHUB_TOKEN || undefined });
  const profile = buildProfile(facts.user, facts.repos, facts.reposConsidered);
  await env.CACHE.put(cacheKey(login), JSON.stringify(profile), { expirationTtl: CACHE_TTL_S }).catch((e) =>
    console.warn('github: KV put failed', e),
  );
  return { profile, source: 'live' };
}
