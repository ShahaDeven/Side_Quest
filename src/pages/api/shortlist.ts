import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { MAX_SHORTLIST_PER_BOARD, isBoardId, isCandidateRef, isRoleId } from '../../lib/shortlist';

export const prerender = false;

/** GET ?board=&role= → { candidateRefs } for one demo founder board and role. */
export const GET: APIRoute = async ({ url }) => {
  const board = url.searchParams.get('board') ?? '';
  const role = url.searchParams.get('role') ?? '';
  if (!isBoardId(board) || !isRoleId(role)) return json(400, { error: 'invalid', message: 'Invalid board or role.' });

  const { results } = await env.DB.prepare('SELECT candidate_ref FROM shortlists WHERE board_id = ? AND role_id = ? ORDER BY created_at')
    .bind(board, role)
    .all<{ candidate_ref: string }>();
  return json(200, { candidateRefs: results.map((r) => r.candidate_ref) });
};

/** POST { board, roleId, candidateRef, shortlisted } → add or remove. Idempotent both ways. */
export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const board = String(body?.board ?? '');
  const roleId = String(body?.roleId ?? '');
  const ref = String(body?.candidateRef ?? '');
  const add = body?.shortlisted === true;
  if (!isBoardId(board) || !isRoleId(roleId) || !isCandidateRef(ref)) return json(400, { error: 'invalid', message: 'Invalid shortlist request.' });

  if (add) {
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM shortlists WHERE board_id = ?').bind(board).first<{ n: number }>();
    if ((count?.n ?? 0) >= MAX_SHORTLIST_PER_BOARD) return json(429, { error: 'full', message: 'This demo board is full.' });
    await env.DB.prepare('INSERT OR IGNORE INTO shortlists (board_id, role_id, candidate_ref) VALUES (?, ?, ?)').bind(board, roleId, ref).run();
  } else {
    await env.DB.prepare('DELETE FROM shortlists WHERE board_id = ? AND role_id = ? AND candidate_ref = ?').bind(board, roleId, ref).run();
  }
  return json(200, { shortlisted: add });
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
