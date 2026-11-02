import { useState, type ReactNode } from 'react';
import type { BriefEntry } from '../lib/briefs';
import type { GateReason } from '../lib/match';
import { SKILL_BY_ID } from '../lib/skills';

const skillLabel = (id: string) => SKILL_BY_ID.get(id)?.label ?? id;

/** `[LINK]` and `[FINDING]` are blanks the candidate fills in; make them look like blanks. */
function WithBlanks({ text }: { text: string }) {
  return text.split(/(\[(?:LINK|FINDING)\])/g).map((part, i) =>
    /^\[(LINK|FINDING)\]$/.test(part) ? (
      <mark key={i} className="rounded bg-blank px-1 font-mono text-code text-ink">
        {part === '[LINK]' ? 'your link' : 'your finding'}
      </mark>
    ) : (
      part
    ),
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-1.5 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function SideQuestCard({ entry }: { entry: BriefEntry }) {
  const b = entry.brief;
  const [copied, setCopied] = useState(false);
  const note = b.founder_note;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article id="side-quest" aria-labelledby="sq-title" className="edge-accent scroll-mt-6 rounded-2xl p-5 sm:p-7">
      <p className="text-sm text-muted">
        Side quest for <strong className="font-semibold text-ink">{skillLabel(entry.targetSkill)}</strong>. {entry.company} has
        opened this role to side quests <span className="whitespace-nowrap">(demo: simulated opt-in)</span>.
      </p>
      <h3 id="sq-title" className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
        {b.title}
      </h3>

      <p className="mt-4 max-w-prose leading-relaxed">{b.why_they_care}</p>
      <blockquote className="mt-3 border-l-2 border-ink pl-3 text-sm text-muted">
        From the job description: “{b.jd_quote}”
      </blockquote>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Section title="What to build in one day">
          <ul className="list-disc space-y-1.5 pl-4">
            {b.scope.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
        <div className="space-y-6">
          <Section title="Numbers to report">
            <ul className="list-disc space-y-1.5 pl-4">
              {b.numbers.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Section>
          <Section title="Done looks like">{b.done_looks_like}</Section>
        </div>
        <Section title="Stack">
          <p className="font-mono text-code leading-relaxed">{b.stack.join(', ')}</p>
        </Section>
        <Section title="Data">{b.data}</Section>
      </div>

      <div className="mt-7 rounded-xl border border-line bg-paper p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold">Note to the founder</h4>
          <button type="button" onClick={copy} className="btn btn-sm btn-secondary">
            {copied ? 'Copied' : 'Copy note'}
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed">
          <WithBlanks text={note} />
        </p>
        <span role="status" className="sr-only">
          {copied ? 'Note copied to clipboard' : ''}
        </span>
      </div>

      <details className="mt-5 text-sm">
        <summary className="cursor-pointer font-semibold">What could backfire</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 leading-relaxed">
          {b.risks.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>

      <p className="mt-5 text-xs text-muted">
        One day of work, built only on public information. It stays yours to share, even if this founder passes.
      </p>
    </article>
  );
}

const LOCKED: Record<Exclude<GateReason, 'unlocked'> | 'no-brief', { title: string; body: (company: string) => string }> = {
  'not-opted-in': {
    title: 'No side quest for this role',
    body: (c) => `${c} hasn't opened this role to side quests. Your existing proof above is the pitch: share it as it is.`,
  },
  'needs-stronger-proof': {
    title: 'Side quests unlock with strong proof',
    body: (c) =>
      `${c} invites side quests, but only from candidates whose existing work already covers most of the role. Strengthen the gaps above first; a side quest closes one gap, not five.`,
  },
  'nothing-missing': {
    title: 'Nothing left to prove',
    body: () => 'Your existing work covers everything we could read in this job description. Send your proof as it is.',
  },
  'no-brief': {
    title: 'No side quest written for this gap yet',
    body: (c) => `${c} invites side quests, but none targets your top gap yet. Briefs are reviewed by hand before they appear here.`,
  },
};

export function LockedState({ reason, company }: { reason: Exclude<GateReason, 'unlocked'> | 'no-brief'; company: string }) {
  const l = LOCKED[reason];
  return (
    <aside className="rounded-2xl border border-dashed border-line p-5 sm:p-6">
      <h3 className="font-semibold">{l.title}</h3>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">{l.body(company)}</p>
    </aside>
  );
}
