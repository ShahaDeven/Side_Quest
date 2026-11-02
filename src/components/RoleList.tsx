import { useMemo, useState } from 'react';
import type { MatchResult, Role } from '../lib/types';
import { StrengthMark } from './marks';

interface Props {
  roles: Role[];
  matches: Map<string, MatchResult> | null;
  optedIn: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Ranked by proof strength when a profile is loaded, newest first otherwise. */
export default function RoleList({ roles, matches, optedIn, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? roles.filter((r) => `${r.company} ${r.title} ${r.location ?? ''} ${r.specialty ?? ''}`.toLowerCase().includes(q))
      : roles;
    return filtered; // already ordered by the parent
  }, [roles, query]);

  return (
    <nav aria-label="Roles" className="flex min-h-0 flex-col">
      <label htmlFor="role-search" className="sr-only">
        Filter roles
      </label>
      <input
        id="role-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by company, title or city"
        className="field sticky top-0 z-10 mb-3 w-full px-3 py-2 text-sm"
      />
      {shown.length === 0 ? (
        <p className="py-6 text-sm text-muted">No roles match “{query}”. Clear the filter to see all {roles.length}.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {shown.map((r) => {
            const m = matches?.get(r.id);
            const selected = r.id === selectedId;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  data-role={r.id}
                  onClick={() => onSelect(r.id)}
                  aria-current={selected ? 'true' : undefined}
                  className={`grid w-full layout-mark gap-x-2 px-2 py-3 text-left transition-colors ${
                    selected ? 'bg-surface' : 'hover:bg-wash'
                  }`}
                >
                  <span className="pt-0.5">{m && <StrengthMark strength={m.strength} />}</span>
                  <span className="min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm text-muted">{r.company}</span>
                      {optedIn.has(r.id) && <span className="shrink-0 text-xs text-muted">side quests open</span>}
                    </span>
                    <span className={`block truncate font-semibold ${selected ? 'underline decoration-2 underline-offset-4' : ''}`}>{r.title}</span>
                    {m && (
                      <span className="block text-xs text-muted">
                        Shows {m.covered.length} of {m.covered.length + m.missing.length} asks
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
