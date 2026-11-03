import { forwardRef, type ReactNode } from 'react';
import type { BriefEntry } from '../lib/briefs';
import { tierBreakdown, type GateReason } from '../lib/match';
import type { MatchResult, MissingRequirement, Requirement, Role } from '../lib/types';
import { Breakdown, ExternalIcon, strengthLabel } from './marks';
import ReportTable from './ReportTable';
import { LockedState, SideQuestCard } from './SideQuest';
import { SKILL_BY_ID } from '../lib/skills';

const JOIN_URL = 'https://speedrun-talent-network.com/join/';
const label = (id: string) => SKILL_BY_ID.get(id)?.label ?? id;

export type DetailView = 'candidate' | 'founder';

interface Props {
  role: Role;
  requirements: Requirement[];
  match: MatchResult | null;
  gate: { reason: GateReason; target: MissingRequirement | null } | null;
  brief: BriefEntry | null;
  view: DetailView;
  /** Whether the role is open to side quests (the demo's simulated founder setting). */
  optedIn: boolean;
  /** The share panel, placed after the evidence. */
  children?: ReactNode;
  /** The founder view's content. */
  founder: ReactNode;
}

/** One role as an assessment report: the field row, then either the candidate's evidence or the founder's view. */
const RoleDetail = forwardRef<HTMLHeadingElement, Props>(function RoleDetail(
  { role, requirements, match, gate, brief, view, optedIn, children, founder },
  headingRef,
) {
  return (
    <article aria-labelledby="role-title" className="min-w-0 bg-sheet px-5 pt-6 pb-8 sm:px-8">
      <header>
        <h2 id="role-title" ref={headingRef} tabIndex={-1} className="report-head text-4xl leading-none sm:text-5xl">
          {role.title}
        </h2>
        <dl className="mt-5 grid grid-cols-2 border-y border-ink sm:grid-cols-4">
          <Field term="Company">{role.company}</Field>
          <Field term="Location">{role.location ?? 'Not stated'}</Field>
          {view === 'founder' ? (
            <Field term="Side quests">{optedIn ? 'Open (simulated)' : 'Closed'}</Field>
          ) : (
            <Field term="Evidence">{match ? strengthLabel(match.strength) : 'No profile read yet'}</Field>
          )}
          <Field term="Posting">
            <a href={role.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap underline decoration-rule underline-offset-4 hover:decoration-ink">
              Open on speedrun <ExternalIcon />
              <span className="sr-only">(opens speedrun in a new tab)</span>
            </a>
          </Field>
        </dl>
      </header>

      <div id="role-panel" role="tabpanel" aria-labelledby={`tab-${view}`}>
        {view === 'founder' ? (
          founder
        ) : match ? (
          <Candidate role={role} match={match} total={requirements.length} gate={gate} brief={brief}>
            {children}
          </Candidate>
        ) : (
          <Asks requirements={requirements} />
        )}
      </div>
    </article>
  );
});
export default RoleDetail;

function Field({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="border-rule py-2.5 pr-4 not-first:sm:border-l not-first:sm:pl-4 [&:nth-child(n+3)]:border-t [&:nth-child(n+3)]:sm:border-t-0">
      <dt className="field-label">{term}</dt>
      <dd className="mt-0.5 text-base font-semibold">{children}</dd>
    </div>
  );
}

function Candidate({
  role,
  match,
  total,
  gate,
  brief,
  children,
}: {
  role: Role;
  match: MatchResult;
  total: number;
  gate: Props['gate'];
  brief: BriefEntry | null;
  children?: ReactNode;
}) {
  const unlocked = gate?.reason === 'unlocked' && brief;
  const lockedReason = gate && gate.reason !== 'unlocked' ? gate.reason : 'no-brief';
  const n = match.covered.length;

  return (
    <>
      <div className="mt-5 flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <p className="text-lg">
          <span className="tnum font-semibold">
            {n} of {total} requirements
          </span>{' '}
          shown in the code.
          {match.cappedBy === 'few-requirements' && (
            <span className="text-slate"> This description names only {total} skills Side Quest can read, too few to call the evidence strong.</span>
          )}
          {match.cappedBy === 'few-core-covered' && (
            <span className="text-slate"> Most of it answers day-to-day items, not the core requirements, so it isn't called strong.</span>
          )}
        </p>
        <Breakdown b={tierBreakdown(match)} className="text-sm text-slate" />
      </div>
      {unlocked && (
        <p className="mt-2 text-sm">
          <a href="#side-quest" className="font-semibold text-alert underline underline-offset-4">
            One open requirement, {label(brief.targetSkill)}, has a one-day side quest
          </a>
        </p>
      )}

      <ReportTable covered={match.covered} missing={match.missing} openSkill={unlocked ? brief.targetSkill : null} openTitle={unlocked ? brief.brief.title : null} />

      <div className="mt-10">{unlocked ? <SideQuestCard entry={brief} /> : <LockedState reason={lockedReason} company={role.company} />}</div>

      {children}

      <p className="mt-10 border-t border-rule pt-4 text-sm text-slate">
        Side Quest is an unofficial concept built on speedrun's public API, not affiliated with a16z.{' '}
        <a href={JOIN_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
          The speedrun Talent Network <ExternalIcon />
        </a>{' '}
        is where founders hire from one shared profile.
      </p>
    </>
  );
}

/** No profile yet: what the role asks for, read from the job description. */
function Asks({ requirements }: { requirements: Requirement[] }) {
  return (
    <section aria-labelledby="asks" className="mt-6">
      <h3 id="asks" className="report-head text-2xl">
        What this role requires
      </h3>
      {requirements.length === 0 ? (
        <p className="mt-1 max-w-prose text-reading text-slate">
          Side Quest found no engineering skills it can read in this description, so there is nothing to check code against. The
          posting on speedrun has the full text.
        </p>
      ) : (
        <p className="mt-1 max-w-prose text-reading text-slate">
          Read from the job description, heaviest first. Read a GitHub profile to see which of these the code already answers.
        </p>
      )}
      <ol className={requirements.length ? 'mt-4 border-t border-ink' : 'hidden'}>
        {requirements.slice(0, 12).map((r, i) => (
          <li key={r.skill} className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-b border-rule py-3.5 md:grid-cols-[2.5rem_1fr_14rem]">
            <span className="report-head tnum text-lg text-slate">A{i + 1}</span>
            <p className="text-base leading-snug font-medium">“{r.quote}”</p>
            <p className="col-start-2 text-sm text-slate md:col-start-3 md:text-right">{label(r.skill)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
