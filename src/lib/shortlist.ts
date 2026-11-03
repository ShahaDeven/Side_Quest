/**
 * Demo founder shortlist (PLAN.md Step 1.6). Pure validation shared by the browser and the Worker.
 * A board is one visitor's demo founder: a random id kept in localStorage, never tied to a person.
 */
import { isValidLogin } from './github';
import { isProofId, randomString } from './proof';

export const MAX_SHORTLIST_PER_BOARD = 200;

/** Same alphabet and length as proof ids: unguessable, unambiguous. */
export const isBoardId = isProofId;
export const newBoardId = () => randomString(10);

/** `seed:<id>` for a demo candidate, `gh:<login>` for a real GitHub candidate. */
export function isCandidateRef(ref: string): boolean {
  if (ref.startsWith('seed:')) return /^seed:[a-z0-9-]{1,32}$/.test(ref);
  if (ref.startsWith('gh:')) return isValidLogin(ref.slice(3));
  return false;
}

export const seedRef = (id: string) => `seed:${id}`;
export const githubRef = (login: string) => `gh:${login.toLowerCase()}`;

/** speedrun job ids are UUIDs (8-4-4-4-12 hex). */
export const isRoleId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
