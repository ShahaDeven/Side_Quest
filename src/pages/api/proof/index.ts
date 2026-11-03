import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import {
  PROOFS_PER_IP_PER_DAY,
  ipBucket,
  newDeleteToken,
  newProofId,
  proofToMarkdown,
  sha256Hex,
  type ProofKind,
} from '../../../lib/proof';
import { buildProofFor, validate } from '../../../server/proof';

export const prerender = false;

interface CreateBody {
  login?: unknown;
  demo?: unknown;
  kind?: unknown;
  roleIds?: unknown;
}

/**
 * Create a proof link. Body: { login, demo?, kind: 'role' | 'network', roleIds[] }.
 * The server recomputes all evidence itself; nothing evidential is accepted from the client.
 */
export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => null)) as CreateBody | null;
  const demo = body?.demo === true;
  const login = typeof body?.login === 'string' ? body.login.trim() : '';
  const kind: ProofKind | null = body?.kind === 'role' || body?.kind === 'network' ? body.kind : null;
  const roleIds = Array.isArray(body?.roleIds) ? [...new Set(body.roleIds.filter((x): x is string => typeof x === 'string'))] : [];
  const invalid = validate({ login, demo, kind, roleIds });
  if (invalid && !invalid.ok) return error(invalid.status, invalid.code, invalid.message);

  // 20 per IP per day. The bucket is a daily hash of the IP; raw IPs are never stored. Local dev shares one
  // "IP" for every test, so it gets a high limit (production behaviour was verified: 20 × 201, then 429).
  const limit = import.meta.env.DEV ? 1000 : PROOFS_PER_IP_PER_DAY;
  const day = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  const rlKey = `rl:proof:${day}:${await ipBucket(ip, day)}`;
  const used = Number((await env.CACHE.get(rlKey).catch(() => null)) ?? 0);
  if (used >= limit) return error(429, 'rate-limited', `You've created ${limit} proof links today. Try again tomorrow.`);

  const built = await buildProofFor({ login, demo, kind, roleIds });
  if (!built.ok) return error(built.status, built.code, built.message);
  const doc = built.doc;

  const token = newDeleteToken();
  const tokenHash = await sha256Hex(token);
  const json = JSON.stringify(doc);

  // 31^10 ids make collisions vanishingly rare; retry once anyway rather than fail on a UNIQUE error.
  let id = '';
  for (let attempt = 0; attempt < 2 && !id; attempt++) {
    const candidate = newProofId();
    try {
      await env.DB.prepare('INSERT INTO proofs (id, user_id, evidence_json, delete_token_hash) VALUES (?, NULL, ?, ?)')
        .bind(candidate, json, tokenHash)
        .run();
      id = candidate;
    } catch (e) {
      if (attempt === 1) {
        console.error('proof: insert failed', e);
        return error(500, 'failed', 'Could not save the proof link.');
      }
    }
  }

  await env.CACHE.put(rlKey, String(used + 1), { expirationTtl: 2 * 86_400 }).catch(() => {});

  const origin = new URL(request.url).origin;
  const url = `${origin}/p/${id}`;
  return new Response(
    JSON.stringify({ id, kind, url, deleteUrl: `${url}?delete=${token}`, markdown: proofToMarkdown(doc, url), roles: doc.roles.length, requested: roleIds.length }),
    { status: 201, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } },
  );
};

function error(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
