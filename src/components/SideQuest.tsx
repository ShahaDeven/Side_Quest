import { useState, type ReactNode } from 'react';
import type { BriefEntry } from '../lib/briefs';
import type { GateReason } from '../lib/match';
import { SKILL_BY_ID } from '../lib/skills';

const skillLabel = (id: string) => SKILL_BY_ID.get(id)?.label ?? id;

/** `[LINK]` and `[FINDING]` are blanks the candidate fills in; make them look like blanks. */
function WithBlanks({ text }: { text: string }) {
  return text.split(/(\[(?:LINK|FINDING)\])/g).map((part, i) =>
    /^\[(LINK|FINDING)\]$/.test(part) ? (
      <mark key={i} className="bg-blank px-1 font-mono text-code text-ink">
        {part === '[LINK]' ? 'your link' : 'your finding'}
      </mark>
    ) : (
      part
    ),
  );
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-rule pt-3">
      <h4 className="field-label">{title}</h4>
      <div className="mt-1.5 text-reading leading-relaxed">{children}</div>
    </div>
  );
}

/** The one-day project that closes the open requirement. A ruled section of the report, opened by the red rule. */
export function SideQuestCard({ entry }: { entry: BriefEntry }) {
  const b = entry.brief;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(b.founder_note);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id="side-quest" aria-labelledby="sq-title" className="scroll-mt-6 border-t-2 border-alert bg-sheet px-5 pt-5 pb-6 sm:px-7">
      <p className="text-sm text-slate">
        Side quest for the open requirement, <strong className="font-semibold text-alert">{skillLabel(entry.targetSkill)}</strong>.{' '}
        {entry.company} has opened this role to side quests (simulated in this demo).
      </p>
      <h3 id="sq-title" className="report-head mt-2 text-3xl leading-none sm:text-4xl">
        {b.title}
      </h3>
      <p className="mt-3 max-w-prose text-base leading-relaxed">{b.why_they_care}</p>
      <p className="mt-2 max-w-prose text-sm text-slate">From the job description: “{b.jd_quote}”</p>

      <div className="mt-6 grid gap-x-10 gap-y-5 md:grid-cols-2">
        <Part title="What to build in one day">
          <ul className="list-disc space-y-1.5 pl-4">
            {b.scope.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Part>
        <div className="space-y-5">
          <Part title="Numbers to report">
            <ul className="list-disc space-y-1.5 pl-4">
              {b.numbers.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Part>
          <Part title="Done looks like">{b.done_looks_like}</Part>
        </div>
        <Part title="Stack">
          <p className="font-mono text-code">{b.stack.join(', ')}</p>
        </Part>
        <Part title="Data">{b.data}</Part>
      </div>

      <div className="mt-6 border-t border-ink pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="field-label">Note to the founder</h4>
          <button type="button" onClick={copy} className="btn btn-sm btn-secondary">
            {copied ? 'Copied' : 'Copy note'}
          </button>
        </div>
        <p className="mt-2 max-w-prose text-reading leading-relaxed">
          <WithBlanks text={b.founder_note} />
        </p>
        <span role="status" className="sr-only">
          {copied ? 'Note copied to clipboard' : ''}
        </span>
      </div>

      <details className="mt-5 border-t border-rule pt-3 text-reading">
        <summary className="field-label cursor-pointer py-2">What could backfire</summary>
        <ul className="mt-1 list-disc space-y-1.5 pl-4 leading-relaxed">
          {b.risks.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>

      <p className="mt-5 text-sm text-slate">One day of work, built only on public information. It stays yours to share, even if this founder passes.</p>
    </section>
  );
}

const LOCKED: Record<Exclude<GateReason, 'unlocked'> | 'no-brief', { title: string; body: (company: string) => string }> = {
  'not-opted-in': {
    title: 'No side quest for this role',
    body: (c) => `${c} hasn't opened this role to side quests. The evidence above is the case: share it as it is.`,
  },
  'needs-stronger-proof': {
    title: 'Side quests open with strong evidence',
    body: (c) =>
      `${c} invites side quests, but only from candidates whose existing work already covers most of the role. A side quest closes one open requirement, not five.`,
  },
  'nothing-missing': {
    title: 'No open requirements',
    body: () => 'The code already answers every requirement in this description that Side Quest can read. Send the report as it is.',
  },
  'no-brief': {
    title: 'No side quest written for this requirement yet',
    body: (c) => `${c} invites side quests, but none targets this candidate's open requirement yet. Briefs are reviewed by hand before they appear.`,
  },
};

export function LockedState({ reason, company }: { reason: Exclude<GateReason, 'unlocked'> | 'no-brief'; company: string }) {
  const l = LOCKED[reason];
  return (
    <section aria-labelledby="locked-title" className="border-t border-dashed border-field pt-4">
      <h3 id="locked-title" className="report-head text-xl">
        {l.title}
      </h3>
      <p className="mt-1.5 max-w-prose text-reading leading-relaxed text-slate">{l.body(company)}</p>
    </section>
  );
}
