import { Fragment, type ReactNode } from 'react';
import type { TierBreakdown } from '../lib/match';
import type { Strength, Tier } from '../lib/types';

/**
 * Evidence reasons carry `backticked` paths and packages; render those as code, everything else as text.
 * Paths get a break opportunity after each "/" so they wrap at a segment, never mid-token.
 */
export function Inline({ text }: { text: string }): ReactNode {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') ? <Path key={i} value={part.slice(1, -1)} /> : part,
  );
}

export function Path({ value }: { value: string }) {
  const segments = value.split('/');
  return (
    <code>
      {segments.map((s, i) => (
        <Fragment key={i}>
          {s}
          {i < segments.length - 1 && (
            <>
              /<wbr />
            </>
          )}
        </Fragment>
      ))}
    </code>
  );
}

// --- evidence level ----------------------------------------------------------------------------

export const LEVELS: { tier: Tier; label: string; meaning: string }[] = [
  { tier: 'mentioned', label: 'Mentioned', meaning: 'A repo tag, the repo language or a resume line names it.' },
  { tier: 'described', label: 'Described', meaning: 'The README talks about it.' },
  { tier: 'declared', label: 'Declared', meaning: 'A dependency file lists it, or matching files exist. No file read shows it in use.' },
  {
    tier: 'demonstrated',
    label: 'Demonstrated',
    meaning: "Files that were read use it: they import it or contain its code. For a language, a substantial body of the candidate's own code.",
  },
  {
    tier: 'shipped',
    label: 'Shipped',
    meaning: 'Demonstrated, and GitHub records a release, a successful deployment or a Pages site. A bonus: most good work is never deployed.',
  },
];

const levelIndex = (tier: Tier | null) => (tier ? LEVELS.findIndex((l) => l.tier === tier) : -1);
export const levelLabel = (tier: Tier | null) => (tier ? LEVELS[levelIndex(tier)].label : 'Not yet shown');

/**
 * How far the code shows one requirement: five ruled cells filled to the level, and the level in words.
 * It describes the evidence for this requirement, never the person.
 */
export function EvidenceLevel({ tier, open = false }: { tier: Tier | null; open?: boolean }) {
  const filled = levelIndex(tier) + 1;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span aria-hidden className="flex gap-1">
        {LEVELS.map((l, i) => (
          <span
            key={l.tier}
            className={`h-2.5 w-3 border ${open ? 'border-alert' : 'border-ink'} ${i < filled ? (open ? 'bg-alert' : 'bg-ink') : ''}`}
          />
        ))}
      </span>
      <span className={`text-sm font-semibold ${open ? 'text-alert' : tier ? 'text-ink' : 'text-slate'}`}>{levelLabel(tier)}</span>
    </span>
  );
}

// --- strength + breakdown ----------------------------------------------------------------------

const STRENGTH: Record<Strength, string> = { strong: 'Strong evidence', some: 'Some evidence', thin: 'Thin evidence' };
export const strengthLabel = (s: Strength) => STRENGTH[s];

/** The strength is always read next to its breakdown, never as a single score. */
export function Breakdown({ b, className = '' }: { b: TierBreakdown; className?: string }) {
  const parts = [
    ['Shipped', b.shipped],
    ['Demonstrated', b.demonstrated],
    ['Declared', b.declared],
    ['Described', b.described],
    ['Mentioned', b.mentioned],
    ['Not yet shown', b.none],
  ].filter(([, n]) => (n as number) > 0) as [string, number][];
  return (
    <span className={`tnum ${className}`}>
      {parts.map(([label, n], i) => (
        <Fragment key={label}>
          {i > 0 && <span className="text-field"> / </span>}
          <span className="whitespace-nowrap">
            {label} {n}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

/** Links that leave Side Quest. An authored icon, not a Unicode arrow. */
export function ExternalIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" className="shrink-0">
      <path d="M6 3h7v7M13 3 5.5 10.5M11 9.5V13H3V5h3.5" strokeLinecap="square" />
    </svg>
  );
}
