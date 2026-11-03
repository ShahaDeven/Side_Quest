import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isProofId, sha256Hex } from '../../../lib/proof';

export const prerender = false;

/**
 * Delete a proof link with its one-time token. Accepts a plain HTML form post (works without JavaScript)
 * or JSON. Deleting is a POST on purpose: link previewers and prefetchers follow GET links.
 */
export const POST: APIRoute = async ({ request, redirect }) => {
  const isForm = (request.headers.get('content-type') ?? '').includes('form');
  const fields = isForm ? Object.fromEntries(await request.formData()) : ((await request.json().catch(() => ({}))) as Record<string, unknown>);
  const id = String(fields.id ?? '');
  const token = String(fields.token ?? '');
  if (!isProofId(id) || token.length < 16) return respond(isForm, 400, id, 'Invalid delete link.');

  const row = await env.DB.prepare('SELECT delete_token_hash FROM proofs WHERE id = ?').bind(id).first<{ delete_token_hash: string }>();
  if (!row) return isForm ? redirect(`/p/${id}?deleted=1`, 303) : respond(false, 404, id, 'Already deleted.');
  if (row.delete_token_hash !== (await sha256Hex(token))) return respond(isForm, 403, id, 'That delete link is not valid for this proof.');

  await env.DB.prepare('DELETE FROM proofs WHERE id = ?').bind(id).run();
  return isForm ? redirect(`/p/${id}?deleted=1`, 303) : respond(false, 200, id, 'Deleted.');
};

function respond(isForm: boolean, status: number, id: string, message: string) {
  if (isForm) {
    // Only a validated id may appear in markup; messages are fixed strings.
    const back = isProofId(id) ? ` <a href="/p/${id}">Back to the proof</a>` : ' <a href="/">Go to Side Quest</a>';
    return new Response(`<!doctype html><meta charset="utf-8"><title>Side Quest</title><p>${message}${back}</p>`, {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  return new Response(JSON.stringify({ message }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
