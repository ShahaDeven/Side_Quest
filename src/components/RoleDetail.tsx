import { forwardRef } from 'react';
import type { BriefEntry } from '../lib/briefs';
import type { GateReason } from '../lib/match';
import { SKILL_BY_ID } from '../lib/skills';
import type { CoveredRequirement, MatchResult, MissingRequirement, Requirement, Role } from '../lib/types';
import { Inline, StrengthMark, TierBadge } from './marks';
import { LockedState, SideQuestCard } from './SideQuest';

const JOIN_URL = 'https://speedrun-talent-network.com/join/';
const label = (id: string) => SKILL_BY_ID.get(id)?.label ?? id;

const SECTION_WORD: Record<Requirement['section'], string> = {
  requirements: 'listed as a requirement',
  role: 'part of the day-to-day',
  'nice-to-have': 'nice to have',
  other: 'mentioned in passing',
};

interface Props {
  role: Role;
  requirements: Requirement[];
  match: MatchResult | null;
  gate: { reason: GateReason; target: MissingRequirement | null } | null;
  brief: BriefEntry | null;
}

const RoleDetail = forwardRef<HTMLHeadingElement, Props>(function RoleDetail({ role, requirements, match, gate, brief }, headingRef) {
  return (
    <article aria-labelledby="role-title" className="min-w-0">
      <header className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-muted">
            {role.company}
            {role.location && <span>, {role.location}</span>}
          </p>
          <h2 id="role-title" ref={headingRef} tabIndex={-1} className="mt-1 text-3xl leading-tight font-extrabold tracking-tight outline-none sm:text-4xl">
            {role.title}
          </h2>
        </div>
        <a
          href={role.url}
          target="_blank"
          rel="noopener"
          className="shrink-0 text-sm font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
        >
          Open the role on speedrun ↗
        </a>
      </header>

      {match ? <Matched role={role} match={match} total={requirements.length} gate={gate} brief={brief} /> : <Unmatched requirements={requirements} />}

      <footer className="mt-10 flex flex-col gap-3 rounded-2xl bg-ink p-5 text-paper sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="max-w-md text-sm leading-relaxed">
          Founders in the speedrun network hire from one shared talent profile. Bring this proof with you.
        </p>
        <a href={JOIN_URL} target="_blank" rel="noopener" className="btn btn-md shrink-0 bg-paper text-ink hover:bg-surface">
          Bring this proof to your speedrun profile
        </a>
      </footer>
    </article>
  );
});
export default RoleDetail;

function Matched({ role, match, total, gate, brief }: { role: Role; match: MatchResult; total: number; gate: Props['gate']; brief: BriefEntry | null }) {
  const n = match.covered.length;
  const unlocked = gate?.reason === 'unlocked' && brief;
  const lockedReason = gate && gate.reason !== 'unlocked' ? gate.reason : 'no-brief';

  return (
    <>
      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <StrengthMark strength={match.strength} withLabel />
        <p className="text-muted">
          {n} of {total} things this role asks for are backed by work you've demonstrated or shipped.
          {match.cappedBy === 'few-requirements' &&
            ` This description names only ${total} skill${total === 1 ? '' : 's'} we can read, too few to call the match strong.`}
          {match.cappedBy === 'few-core-covered' &&
            " Most of that is from the day-to-day or nice-to-haves; too little of the role's core requirements is shown to call it strong."}
        </p>
        {unlocked && (
          <a href="#side-quest" className="text-sm font-semibold underline underline-offset-4">
            Side quest unlocked for {label(brief.targetSkill)}
          </a>
        )}
      </div>

      <section aria-labelledby="proven" className="mt-8">
        <h3 id="proven" className="text-lg font-bold">
          What your work already shows
        </h3>
        {match.covered.length ? (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {match.covered.map((c) => (
              <EvidenceRow key={c.skill} item={c} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Nothing this role asks for is demonstrated in the repos we read yet.</p>
        )}
        <details className="mt-3 text-sm text-muted">
          <summary className="cursor-pointer">How evidence is graded</summary>
          <dl className="mt-2 grid gap-x-4 gap-y-2 sm:layout-defs">
            {(['shipped', 'demonstrated', 'described', 'mentioned'] as const).map((t) => (
              <div key={t} className="contents">
                <dt>
                  <TierBadge tier={t} />
                </dt>
                <dd className="self-center">{TIER_TEXT[t]}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      {match.missing.length > 0 && (
        <section aria-labelledby="missing" className="mt-8">
          <h3 id="missing" className="text-lg font-bold">
            Not shown yet
          </h3>
          <ul className="mt-3 space-y-3">
            {match.missing.map((m) => (
              <MissingRow key={m.skill} item={m} isTarget={!!unlocked && brief.targetSkill === m.skill} />
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8">{unlocked ? <SideQuestCard entry={brief} /> : <LockedState reason={lockedReason} company={role.company} />}</div>
    </>
  );
}

const TIER_TEXT = {
  shipped: 'Demonstrated, and the same repo has tests, CI or a live deploy.',
  demonstrated: 'A dependency file lists it and matching source files exist.',
  described: "The README talks about it. The code wasn't checked for it.",
  mentioned: 'Only a repo tag, the repo language or your resume names it.',
} as const;

function EvidenceRow({ item }: { item: CoveredRequirement }) {
  const e = item.evidence;
  return (
    <li className="grid gap-2 p-4 sm:layout-row sm:gap-5">
      <div className="flex items-start justify-between gap-2 sm:flex-col sm:justify-start">
        <span className="font-semibold">{label(item.skill)}</span>
        <TierBadge tier={e.tier} />
      </div>
      <div className="min-w-0 text-sm">
        {e.repo && (
          <a href={e.url} target="_blank" rel="noopener" className="font-mono font-semibold underline decoration-line underline-offset-4 hover:decoration-ink">
            {e.repo}
          </a>
        )}
        <ul className="mt-1 space-y-0.5 text-muted">
          {e.reasons.map((r) => (
            <li key={r} className="break-words">
              <Inline text={r} />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          The role asks: “{item.quote}”
        </p>
      </div>
    </li>
  );
}

function MissingRow({ item, isTarget }: { item: MissingRequirement; isTarget: boolean }) {
  const e = item.evidence;
  return (
    <li className={`rounded-xl border p-4 text-sm ${isTarget ? 'border-ink' : 'border-line'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">
          {label(item.skill)} <span className="font-normal text-muted">({SECTION_WORD[item.section]})</span>
        </span>
        {isTarget && <span className="text-xs font-semibold">The side quest below closes this</span>}
      </div>
      <p className="mt-1 text-muted">The role asks: “{item.quote}”</p>
      <p className="mt-1.5">
        {e ? (
          <>
            Closest evidence: <TierBadge tier={e.tier} /> in <span className="font-mono">{e.repo ?? 'your resume'}</span>, <Inline text={e.reasons[0]} />
          </>
        ) : (
          <span className="text-muted">No evidence in the repos we read.</span>
        )}
      </p>
    </li>
  );
}

function Unmatched({ requirements }: { requirements: Requirement[] }) {
  return (
    <section aria-labelledby="asks" className="mt-6">
      <h3 id="asks" className="text-lg font-bold">
        What this role asks for
      </h3>
      <p className="mt-1 text-sm text-muted">Read from the job description, heaviest first. Add your GitHub to see which of these your work already shows.</p>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
        {requirements.slice(0, 12).map((r) => (
          <li key={r.skill} className="grid gap-1 p-4 text-sm sm:layout-row sm:gap-5">
            <span className="font-semibold">
              {label(r.skill)}
              <span className="block text-xs font-normal text-muted">{SECTION_WORD[r.section]}</span>
            </span>
            <span className="text-muted">“{r.quote}”</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
