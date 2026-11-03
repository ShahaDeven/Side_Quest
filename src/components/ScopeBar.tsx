import type { RoleSet } from '../lib/types';

const VISIBLE_NEXT = 4;

/** States exactly what was evaluated, and what isn't covered yet. Never implies full coverage. */
export default function ScopeBar({ set, via }: { set: RoleSet; via: 'api' | 'bundled' }) {
  const n = set.roles.length;
  const next = set.functionCounts.filter((c) => c.fn !== set.fn && c.n > 0).sort((a, b) => b.n - a.n);
  const shown = next.slice(0, VISIBLE_NEXT);
  const more = next.length - shown.length;

  return (
    <div className="mb-4 flex text-sm flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <p>
        <span className="font-semibold">
          {n} {humanize(set.fn)} roles evaluated
        </span>
        {set.total !== n && <span className="text-slate"> (speedrun lists {set.total})</span>}
        <span className="text-slate">, {freshness(set, via)}</span>
      </p>
      {shown.length > 0 && (
        <p className="text-sm text-slate">
          Coming next: {shown.map((c) => `${humanize(c.fn)} (${c.n})`).join(', ')}
          {more > 0 && ` and ${more} more`}
        </p>
      )}
    </div>
  );
}

function freshness(set: RoleSet, via: 'api' | 'bundled') {
  const when = new Date(set.fetchedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (via === 'bundled') return `from a saved snapshot (${when}) because live data is unavailable`;
  return set.source === 'live' ? 'live from speedrun' : `from a saved snapshot (${when})`;
}

/** "engineering" → "engineering", "business_development" → "business development". Lowercase: it sits mid-sentence. */
export function humanize(slug: string) {
  return slug.replace(/_/g, ' ');
}
