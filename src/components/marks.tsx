import type { ReactNode } from 'react';
import type { Strength, Tier } from '../lib/types';

/** Evidence reasons carry `backticked` paths and packages; render those as code, everything else as text. */
export function Inline({ text }: { text: string }): ReactNode {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part,
  );
}

const TIER: Record<Tier, { label: string; className: string; hint: string }> = {
  shipped: {
    label: 'Shipped',
    className: 'bg-ink text-paper border-ink',
    hint: 'Demonstrated, and the same repo has tests, CI or a live deploy',
  },
  demonstrated: {
    label: 'Demonstrated',
    className: 'border-ink text-ink',
    hint: 'A dependency manifest lists it and matching source files exist',
  },
  described: {
    label: 'Described',
    className: 'border-dashed border-muted text-muted',
    hint: 'The README talks about it; the code was not checked for it',
  },
  mentioned: {
    label: 'Mentioned',
    className: 'border-transparent text-muted',
    hint: 'Only a repo tag, language or resume line names it',
  },
};

export const tierHint = (t: Tier) => TIER[t].hint;

/** Evidence strength as ink weight: solid → outline → dashed → bare text. */
export function TierBadge({ tier }: { tier: Tier }) {
  const t = TIER[tier];
  return (
    <span title={t.hint} className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${t.className}`}>
      {t.label}
    </span>
  );
}

const STRENGTH: Record<Strength, { glyph: string; label: string }> = {
  strong: { glyph: '●', label: 'Strong proof' },
  some: { glyph: '◐', label: 'Some proof' },
  thin: { glyph: '○', label: 'Thin proof' },
};

export const strengthLabel = (s: Strength) => STRENGTH[s].label;

export function StrengthMark({ strength, withLabel = false }: { strength: Strength; withLabel?: boolean }) {
  const s = STRENGTH[strength];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
      <span aria-hidden className="text-base leading-none">{s.glyph}</span>
      <span className={withLabel ? 'font-semibold' : 'sr-only'}>{s.label}</span>
    </span>
  );
}
