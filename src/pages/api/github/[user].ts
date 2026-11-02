import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { EVIDENCE_VERSION, buildProfile } from '../../../lib/evidence';
import { GitHubError, fetchProfileFacts, isValidLogin } from '../../../lib/github';
import type { CandidateProfile } from '../../../lib/types';

export const prerender = false;

const CACHE_TTL_S = 6 * 60 * 60;
const cacheKey = (login: string) => `gh:v${EVIDENCE_VERSION}:${login.toLowerCase()}`;

/** Evidence profile for a GitHub user. Raw files and READMEs never leave the Worker. */
export const GET: APIRoute = async ({ params }) => {
  const login = params.user ?? '';
  if (!isValidLogin(login)) return error(400, 'invalid-login', 'That is not a valid GitHub username.');

  const cached = await env.CACHE.get<CandidateProfile>(cacheKey(login), 'json').catch(() => null);
  if (cached) return json(cached, 'cache');

  try {
    const facts = await fetchProfileFacts(login, { token: env.GITHUB_TOKEN || undefined });
    const profile = buildProfile(facts.user, facts.repos, facts.reposConsidered);
    await env.CACHE.put(cacheKey(login), JSON.stringify(profile), { expirationTtl: CACHE_TTL_S }).catch((e) =>
      console.warn('github: KV put failed', e),
    );
    return json(profile, 'live');
  } catch (e) {
    if (e instanceof GitHubError && e.kind === 'not-found') return error(404, 'not-found', `No GitHub user called ${login}.`);
    if (e instanceof GitHubError && e.kind === 'rate-limited')
      return error(429, 'rate-limited', 'GitHub is rate-limiting us right now. Try the demo profile, or again shortly.', e.resetAt);
    console.error('github: profile failed', e);
    return error(502, 'failed', 'Could not read GitHub right now.');
  }
};

function json(body: unknown, source: string) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, max-age=300', 'x-profile-source': source },
  });
}

function error(status: number, code: string, message: string, resetAt: string | null = null) {
  return new Response(JSON.stringify({ error: code, message, resetAt }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
