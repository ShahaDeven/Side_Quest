/**
 * Builds a proof document on the server from public data only: the GitHub profile (or the bundled demo
 * profile) and the current role set. Shared by the create endpoint and the read-only preview page, so a
 * preview is exactly what the stored link would show.
 */
import briefsJson from '../data/briefs.json';
import demoProfileJson from '../data/demo-profile.json';
import optins from '../data/optins.json';
import type { BriefFile } from '../lib/briefs';
import { GitHubError, isValidLogin } from '../lib/github';
import { buildProof, fitProof, maxRoles, type ProofDoc, type ProofKind } from '../lib/proof';
import type { CandidateProfile } from '../lib/types';
import { getProfile } from './profile';
import { getRoleSet } from './roles';

const optedIn = new Set(optins.roles.map((r) => r.id));
const demoProfile = demoProfileJson as CandidateProfile;

export interface ProofRequest {
  login: string;
  demo: boolean;
  kind: ProofKind | null;
  roleIds: string[];
}

export type ProofBuild = { ok: true; doc: ProofDoc; requested: number } | { ok: false; status: number; code: string; message: string };

const fail = (status: number, code: string, message: string): ProofBuild => ({ ok: false, status, code, message });

/**
 * A role link must name exactly one role: it is rejected, not trimmed, so a client bug can never put other
 * companies on a page meant for one founder.
 */
export function validate({ login, demo, kind, roleIds }: ProofRequest): ProofBuild | null {
  if (!kind) return fail(400, 'invalid-kind', "kind must be 'role' or 'network'.");
  if (!demo && !isValidLogin(login)) return fail(400, 'invalid-login', 'A valid GitHub username is required.');
  if (roleIds.length === 0) return fail(400, 'no-roles', 'Pick at least one role.');
  if (kind === 'role' && roleIds.length !== 1) return fail(400, 'one-role', 'A role link covers exactly one role.');
  if (roleIds.length > maxRoles(kind)) return fail(400, 'too-many-roles', `A network link covers at most ${maxRoles(kind)} roles.`);
  return null;
}

/** Call `validate` first; this assumes a valid request. */
export async function buildProofFor(req: ProofRequest): Promise<ProofBuild> {
  let profile: CandidateProfile;
  try {
    profile = req.demo ? demoProfile : (await getProfile(req.login)).profile;
  } catch (e) {
    if (e instanceof GitHubError && e.kind === 'not-found') return fail(404, 'not-found', `No GitHub user called ${req.login}.`);
    if (e instanceof GitHubError && e.kind === 'rate-limited') return fail(429, 'rate-limited', 'GitHub is rate-limiting us right now. Try again shortly.');
    return fail(502, 'failed', 'Could not read GitHub right now.');
  }

  const { set } = await getRoleSet();
  const byId = new Map(set.roles.map((r) => [r.id, r]));
  const roles = req.roleIds.map((id) => byId.get(id)).filter((r) => r !== undefined);
  if (roles.length === 0) return fail(400, 'unknown-roles', 'None of those roles are open any more.');

  const doc = fitProof(buildProof(profile, roles, { kind: req.kind!, demo: req.demo, briefs: briefsJson as BriefFile, optedIn }));
  if (!doc) return fail(413, 'too-large', 'That proof is too large to store. Try fewer roles.');
  return { ok: true, doc, requested: req.roleIds.length };
}
