/** Browser-side: this visitor's demo founder board (localStorage) and its shortlist calls. */
import { isBoardId, newBoardId } from './shortlist';

const KEY = 'sq-founder-board';

export function boardId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && isBoardId(existing)) return existing;
    const fresh = newBoardId();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Storage blocked (private mode on some browsers): a per-page board still works, it just won't persist.
    return newBoardId();
  }
}

export async function fetchShortlist(board: string, roleId: string): Promise<string[] | null> {
  try {
    const res = await fetch(`/api/shortlist?board=${board}&role=${roleId}`);
    if (!res.ok) return null;
    return ((await res.json()) as { candidateRefs: string[] }).candidateRefs;
  } catch {
    return null;
  }
}

export async function saveShortlist(board: string, roleId: string, candidateRef: string, shortlisted: boolean): Promise<boolean> {
  try {
    const res = await fetch('/api/shortlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ board, roleId, candidateRef, shortlisted }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
