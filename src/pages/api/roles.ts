import type { APIRoute } from 'astro';
import { getRoleSet } from '../../server/roles';

export const prerender = false;

/** All roles for the MVP function, with descriptions. `x-roles-source` says which layer answered. */
export const GET: APIRoute = async () => {
  const { set, source } = await getRoleSet();
  return new Response(JSON.stringify(set), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'x-roles-source': source,
    },
  });
};
