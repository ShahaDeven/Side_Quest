import type { APIRoute } from 'astro';
import { GitHubError, isValidLogin } from '../../../lib/github';
import { getProfile } from '../../../server/profile';

export const prerender = false;

/** Evidence profile for a GitHub user. Raw files and READMEs never leave the Worker. */
export const GET: APIRoute = async ({ params }) => {
  const login = params.user ?? '';
  if (!isValidLogin(login)) return error(400, 'invalid-login', 'That is not a valid GitHub username.');

  try {
    const { profile, source } = await getProfile(login);
    return new Response(JSON.stringify(profile), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, max-age=300', 'x-profile-source': source },
    });
  } catch (e) {
    if (e instanceof GitHubError && e.kind === 'not-found') return error(404, 'not-found', `No GitHub user called ${login}.`);
    if (e instanceof GitHubError && e.kind === 'rate-limited')
      return error(429, 'rate-limited', 'GitHub is rate-limiting us right now. Try the demo profile, or again shortly.', e.resetAt);
    console.error('github: profile failed', e);
    return error(502, 'failed', 'Could not read GitHub right now.');
  }
};

function error(status: number, code: string, message: string, resetAt: string | null = null) {
  return new Response(JSON.stringify({ error: code, message, resetAt }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
