import { describe, expect, it } from 'vitest';
import { defaultView, findRole, readUrl, writeUrl } from '../src/lib/session';
import type { Role } from '../src/lib/types';

describe('URL state', () => {
  it('round-trips the zero-click demo link', () => {
    const s = readUrl('?demo=1&role=6b385ffe');
    expect(s).toEqual({ demo: true, user: null, role: '6b385ffe', view: null });
    expect(writeUrl(s)).toBe('?demo=1&role=6b385ffe');
  });

  it('shortens role ids to 8 characters and prefers demo over user', () => {
    expect(writeUrl({ demo: false, user: 'octocat', role: '6b385ffe-8550-44cb-969e-5fae13d6f42a' })).toBe('?user=octocat&role=6b385ffe');
    expect(writeUrl({ demo: true, user: 'octocat', role: null })).toBe('?demo=1');
    expect(writeUrl({ demo: false, user: null, role: null })).toBe('');
  });

  it('treats blank params as absent', () => {
    expect(readUrl('?user=%20&role=')).toEqual({ demo: false, user: null, role: null, view: null });
  });

  it('opens the demo on the founder view and a real read on the candidate report', () => {
    expect(defaultView(true)).toBe('founder');
    expect(defaultView(false)).toBe('candidate');
  });

  it('writes the view only when it differs from the default', () => {
    expect(writeUrl({ demo: true, user: null, role: null, view: 'founder' })).toBe('?demo=1');
    expect(writeUrl({ demo: true, user: null, role: null, view: 'candidate' })).toBe('?demo=1&view=candidate');
    expect(writeUrl({ demo: false, user: 'octocat', role: null, view: 'founder' })).toBe('?user=octocat&view=founder');
    expect(writeUrl({ demo: false, user: 'octocat', role: null, view: 'candidate' })).toBe('?user=octocat');
    expect(readUrl('?demo=1&view=candidate').view).toBe('candidate');
    expect(readUrl('?view=admin').view).toBeNull();
  });
});

describe('findRole', () => {
  const roles = [{ id: '6b385ffe-8550-44cb-969e-5fae13d6f42a' }, { id: '01be0d6f-9fa8-49dd-96c5-1db935fe96a8' }] as Role[];
  it('finds by full id or 8-char prefix, and returns null otherwise', () => {
    expect(findRole(roles, '01be0d6f-9fa8-49dd-96c5-1db935fe96a8')?.id).toMatch(/^01be/);
    expect(findRole(roles, '6b385ffe')?.id).toMatch(/^6b38/);
    expect(findRole(roles, 'deadbeef')).toBeNull();
    expect(findRole(roles, null)).toBeNull();
  });
});
