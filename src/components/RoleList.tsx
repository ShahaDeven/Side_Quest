import { useMemo, useState } from 'react';
import type { MatchResult, Role, Strength } from '../lib/types';
import { strengthLabel } from './marks';

interface Props {
  roles: Role[];
  matches: Map<string, MatchResult> | null;
  optedIn: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const GROUPS: Strength[] = ['strong', 'some', 'thin'];

/**
 * The role index: quiet, so the report stays the focus. Ranked by evidence in the code and grouped by its
 * strength when a profile is loaded; newest first otherwise. The parent passes roles already ordered.
 */
export default function RoleList({ roles, matches, optedIn, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? roles.filter((r) => `${r.company} ${r.title} ${r.location ?? ''} ${r.specialty ?? ''}`.toLowerCase().includes(q)) : roles;
  }, [roles, query]);

  // Same company and title listed twice (different cities): show the location so the two can be told apart.
  const duplicated = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of roles) seen.set(`${r.company}|${r.title}`, (seen.get(`${r.company}|${r.title}`) ?? 0) + 1);
    return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
  }, [roles]);

  const item = (r: Role) => {
    const m = matches?.get(r.id);
    const selected = r.id === selectedId;
    const showLocation = duplicated.has(`${r.company}|${r.title}`) && r.location;
    return (
      <li key={r.id}>
        <button
          type="button"
          data-role={r.id}
          onClick={() => onSelect(r.id)}
          aria-current={selected ? 'true' : undefined}
          className={`block min-h-11 w-full px-3 py-2.5 text-left transition-colors ${selected ? 'bg-sheet' : 'hover:bg-wash'}`}
        >
          <span className="flex items-baseline justify-between gap-2 text-sm text-slate">
            <span className="truncate">{r.company}</span>
            {optedIn.has(r.id) && <span className="shrink-0">side quests open</span>}
          </span>
          <span className={`block leading-snug font-semibold ${selected ? 'underline decoration-1 underline-offset-4' : ''}`}>{r.title}</span>
          {(m || showLocation) && (
            <span className="tnum block text-sm text-slate">
              {m && `${m.covered.length} of ${m.covered.length + m.missing.length} requirements shown`}
              {m && showLocation && ', '}
              {showLocation && r.location}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <nav aria-labelledby="roles-heading" className="flex min-h-0 flex-col">
      <div className="sticky top-0 z-10 bg-ground pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="roles-heading" className="report-head text-xl">
            Roles
          </h2>
          <p className="tnum text-sm text-slate">{matches ? `${roles.length}, ranked by evidence` : `${roles.length}, newest first`}</p>
        </div>
        <label htmlFor="role-search" className="sr-only">
          Filter roles
        </label>
        <input
          id="role-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by company, title or city"
          className="field mt-2 w-full px-3 text-sm"
        />
      </div>

      {shown.length === 0 ? (
        <p className="py-6 text-sm text-slate">
          No roles match “{query}”. Clear the filter to see all {roles.length}.
        </p>
      ) : matches ? (
        GROUPS.map((g) => {
          const list = shown.filter((r) => matches.get(r.id)?.strength === g);
          if (!list.length) return null;
          return (
            <section key={g} aria-labelledby={`group-${g}`} className="mb-4">
              <h3 id={`group-${g}`} className="field-label tnum flex justify-between border-b border-ink pb-1">
                <span>{strengthLabel(g)}</span>
                <span>{list.length}</span>
              </h3>
              <ul className="divide-y divide-rule">{list.map(item)}</ul>
            </section>
          );
        })
      ) : (
        <ul className="divide-y divide-rule border-t border-ink">{shown.map(item)}</ul>
      )}
    </nav>
  );
}
