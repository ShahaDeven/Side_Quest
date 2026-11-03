import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { SEED_CANDIDATES } from '../data/seed-candidates';
import { pickBrief, type BriefFile } from '../lib/briefs';
import { boardId, fetchShortlist, saveShortlist } from '../lib/load-shortlist';
import { compareMatches, matchRole, tierBreakdown } from '../lib/match';
import { githubRef, seedRef } from '../lib/shortlist';
import { SKILL_BY_ID } from '../lib/skills';
import type { CandidateProfile, EvidenceItem, MatchResult, Requirement, Role, Tier } from '../lib/types';
import { Breakdown, EvidenceLevel, Inline, levelLabel, strengthLabel } from './marks';
import ReportTable, { LevelLegend } from './ReportTable';

const label = (id: string) => SKILL_BY_ID.get(id)?.label ?? id;
const TIER_RANK: Record<Tier, number> = { mentioned: 0, described: 1, declared: 2, demonstrated: 3, shipped: 4 };

interface Props {
  role: Role;
  requirements: Requirement[];
  optedIn: boolean;
  onToggleOptIn: (next: boolean) => void;
  /** The real candidate being viewed, if any (live read or the demo profile). */
  you: { profile: CandidateProfile; evidence: Record<string, EvidenceItem[]> } | null;
  briefs: BriefFile;
}

interface Row {
  ref: string;
  name: string;
  sub: string;
  real: boolean;
  profileUrl: string | null;
  match: MatchResult;
}

/** What a founder sees for one role: candidates ranked by evidence for THIS role, each with its traceable best evidence. */
export default function FounderView({ role, requirements, optedIn, onToggleOptIn, you, briefs }: Props) {
  const rows = useMemo<Row[]>(() => {
    const seeds: Row[] = SEED_CANDIDATES.map((s) => ({
      ref: seedRef(s.id),
      name: s.name,
      sub: s.headline,
      real: false,
      profileUrl: null,
      match: matchRole(role, s.evidence, requirements),
    }));
    const real: Row[] = you
      ? [
          {
            ref: githubRef(you.profile.login),
            name: you.profile.name ?? you.profile.login,
            sub: `github.com/${you.profile.login}`,
            real: true,
            profileUrl: you.profile.profileUrl,
            match: matchRole(role, you.evidence, requirements),
          },
        ]
      : [];
    return [...real, ...seeds].sort((a, b) => compareMatches(a.match, b.match));
  }, [role, requirements, you]);

  // Shortlist: this browser's demo founder board, saved to D1.
  const [board] = useState(() => (typeof window === 'undefined' ? '' : boardId()));
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setShortlisted(new Set());
    if (board) fetchShortlist(board, role.id).then((refs) => live && refs && setShortlisted(new Set(refs)));
    return () => {
      live = false;
    };
  }, [board, role.id]);

  const toggle = async (ref: string) => {
    const next = !shortlisted.has(ref);
    const apply = (on: boolean) =>
      setShortlisted((s) => {
        const copy = new Set(s);
        if (on) copy.add(ref);
        else copy.delete(ref);
        return copy;
      });
    apply(next);
    setError(null);
    if (!(await saveShortlist(board, role.id, ref, next))) {
      apply(!next);
      setError('Could not save the shortlist. Try again.');
    }
  };

  const strong = rows.filter((r) => r.match.strength === 'strong').length;

  return (
    <section aria-labelledby="founder-heading" className="mt-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <h3 id="founder-heading" className="report-head text-2xl">
          Candidates, ranked by evidence for this role
        </h3>
        <p className="tnum text-sm text-slate">
          {rows.length} candidates, {strong} with strong evidence
          {shortlisted.size > 0 && `, ${shortlisted.size} shortlisted`}
        </p>
      </div>
      <p className="mt-1 max-w-prose text-reading text-slate">
        Each row is what the candidate's public code shows against {role.company}'s own requirements, with the file it comes from.
        Candidates are ordered by strength of evidence, then by how much of the role the code shows, with skills from the title and
        the requirements list counting most. That is why core skills are listed on each row.
      </p>

      <div className="mt-4 flex items-start gap-3 border-y border-rule py-3">
        <button
          type="button"
          role="switch"
          aria-checked={optedIn}
          aria-labelledby="optin-label"
          aria-describedby="optin-note"
          onClick={() => onToggleOptIn(!optedIn)}
          className="grid min-h-11 shrink-0 place-items-center"
        >
          <span aria-hidden className={`relative block h-6 w-11 border transition-colors ${optedIn ? 'border-ink bg-ink' : 'border-field bg-sheet'}`}>
            <span className={`absolute top-0.75 block size-4 transition-all ${optedIn ? 'left-5.75 bg-sheet' : 'left-0.75 bg-field'}`} />
          </span>
        </button>
        <span className="pt-2.5">
          <span id="optin-label" className="font-semibold">
            Open this role to side quests
          </span>
          <span id="optin-note" className="block text-sm text-slate">
            Simulated founder setting. It lasts for this visit; proof links keep the demo's original settings.
          </span>
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold">
          {error}
        </p>
      )}

      <table className="mt-2 w-full border-collapse text-left lg:table-fixed">
        <caption className="sr-only">Candidates for {role.title} at {role.company}, ranked by evidence in their code</caption>
        <colgroup className="hidden lg:table-column-group">
          <col className="w-12" />
          <col className="w-64" />
          <col />
          <col className="w-44" />
        </colgroup>
        <thead className="hidden lg:table-header-group">
          <tr className="border-b border-ink">
            <th scope="col" className="field-label py-2.5 pr-3 font-semibold">Rank</th>
            <th scope="col" className="field-label py-2.5 pr-5 font-semibold">Candidate</th>
            <th scope="col" className="field-label py-2.5 pr-5 font-semibold">Strongest evidence for this role</th>
            <th scope="col" className="field-label py-2.5 font-semibold">Side quest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <CandidateRow
              key={row.ref}
              rank={i + 1}
              row={row}
              total={requirements.length}
              optedIn={optedIn}
              role={role}
              briefs={briefs}
              shortlisted={shortlisted.has(row.ref)}
              onToggle={() => toggle(row.ref)}
            />
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-sm text-slate">
        Six of these candidates are fictional demo profiles with illustrative repos. Real candidates would appear here once they
        share their evidence with speedrun.
      </p>
      <LevelLegend />
    </section>
  );
}

function CandidateRow({
  rank,
  row,
  total,
  optedIn,
  role,
  briefs,
  shortlisted,
  onToggle,
}: {
  rank: number;
  row: Row;
  total: number;
  optedIn: boolean;
  role: Role;
  briefs: BriefFile;
  shortlisted: boolean;
  onToggle: () => void;
}) {
  const m = row.match;
  const best = [...m.covered].sort((a, b) => TIER_RANK[b.evidence.tier] - TIER_RANK[a.evidence.tier] || b.weight - a.weight)[0];
  const brief = optedIn && m.strength === 'strong' ? pickBrief(briefs, role.id, m.missing) : null;
  // Core = skills from the description's explicit requirements list.
  const core = {
    shown: m.covered.filter((c) => c.section === 'requirements').length,
    total: [...m.covered, ...m.missing].filter((c) => c.section === 'requirements').length,
  };
  const open = brief ? m.missing.find((x) => x.skill === brief.targetSkill) : (m.missing.find((x) => x.section !== 'other') ?? m.missing[0]);
  const dialog = useRef<HTMLDialogElement>(null);
  const [inspecting, setInspecting] = useState(false);
  const titleId = useId();
  const show = () => {
    dialog.current?.showModal();
    setInspecting(true);
  };

  return (
    <tr className="ref-grid grid gap-x-3 gap-y-3 border-b border-rule py-5 lg:table-row lg:py-0">
      <td className="report-head tnum text-lg text-slate lg:py-5 lg:pr-3 lg:align-top">{rank}</td>
      <td className="min-w-0 lg:py-5 lg:pr-5 lg:align-top">
        <p className="font-semibold">{row.name}</p>
        <p className="text-sm text-slate">
          {row.profileUrl ? (
            <a href={row.profileUrl} target="_blank" rel="noopener" className="font-mono text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
              {row.sub}
            </a>
          ) : (
            row.sub
          )}
        </p>
        <p className="field-label mt-1">{row.real ? 'Real public GitHub' : 'Demo candidate, fictional'}</p>
        <p className="mt-3 text-sm">
          <span className="font-semibold">{strengthLabel(m.strength)}</span>
          <span className="tnum text-slate">
            , {m.covered.length} of {total} skills
          </span>
        </p>
        {core.total > 0 && (
          <p className="tnum text-sm">
            Core skills shown: {core.shown} of {core.total}
          </p>
        )}
        <Breakdown b={tierBreakdown(m)} className="block text-sm text-slate" />
      </td>
      <td className="col-start-2 min-w-0 text-sm lg:col-auto lg:py-5 lg:pr-5 lg:align-top">
        {best ? (
          <>
            <EvidenceLevel tier={best.evidence.tier} />
            <p className="mt-1.5 text-base leading-snug font-medium">“{best.quote}”</p>
            <p className="mt-1.5">
              <span className="font-mono font-semibold">{best.evidence.repo}</span>
            </p>
            <p className="text-slate">
              <Inline text={best.evidence.reasons[0]} />
            </p>
          </>
        ) : (
          <p className="text-slate">Nothing this role asks for is shown in the code yet.</p>
        )}
        {open && (
          <p className={`mt-3 ${brief ? 'font-semibold text-alert' : 'text-slate'}`}>
            {brief ? 'Open requirement' : 'Not yet shown'}: {label(open.skill)}
          </p>
        )}
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={show}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline decoration-rule underline-offset-4 hover:decoration-ink"
        >
          Inspect all {total} skills
        </button>
        <dialog
          ref={dialog}
          aria-labelledby={titleId}
          onClose={() => setInspecting(false)}
          // A click on the backdrop lands on the dialog element itself, not its content: close.
          onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
          className="dialog-sheet bg-sheet p-0 text-ink"
        >
          {inspecting && (
            <div className="flex min-h-0 flex-1 flex-col">
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-ink px-5 pt-5 pb-4 sm:px-7">
                <div className="min-w-0">
                  <p className="field-label">
                    {role.company}, {role.title}
                  </p>
                  <h3 id={titleId} className="report-head mt-1 text-3xl leading-none">
                    {row.name}
                  </h3>
                  <p className="mt-1.5 text-sm">
                    <span className="font-semibold">{strengthLabel(m.strength)}</span>
                    <span className="tnum text-slate">
                      , {m.covered.length} of {total} skills{core.total > 0 && `, core ${core.shown} of ${core.total}`}.{' '}
                      {row.real ? 'Real public GitHub.' : 'Demo candidate, fictional.'}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggle}
                    aria-pressed={shortlisted}
                    aria-label={`Shortlist ${row.name}`}
                    className={`btn btn-sm ${shortlisted ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {shortlisted ? 'Shortlisted' : 'Shortlist'}
                  </button>
                  <button type="button" onClick={() => dialog.current?.close()} className="btn btn-sm btn-quiet" autoFocus>
                    Close
                  </button>
                </div>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-7 sm:px-7">
                <CandidateDetail name={row.name} match={m} brief={brief} optedIn={optedIn} />
              </div>
            </div>
          )}
        </dialog>
      </td>
      <td className="col-start-2 text-sm lg:col-auto lg:py-5 lg:align-top">
        <p className="text-slate">
          {!optedIn ? (
            'Side quests closed for this role'
          ) : brief ? (
            <>
              Can take <span className="font-semibold text-ink">“{brief.brief.title}”</span>
            </>
          ) : m.strength === 'strong' ? (
            'Eligible; no side quest written for this requirement yet'
          ) : (
            'Not eligible yet: evidence isn’t strong'
          )}
        </p>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={shortlisted}
          aria-label={`Shortlist ${row.name}`}
          className={`btn btn-sm mt-3 w-32 ${shortlisted ? 'btn-primary' : 'btn-secondary'}`}
        >
          {shortlisted ? 'Shortlisted' : 'Shortlist'}
        </button>
      </td>
    </tr>
  );
}

/**
 * Everything a founder needs to judge one candidate without leaving the shortlist: every requirement with its
 * level and repository, the weakest part of the evidence, and what the side quest would test.
 */
function CandidateDetail({
  name,
  match: m,
  brief,
  optedIn,
}: {
  name: string;
  match: MatchResult;
  brief: ReturnType<typeof pickBrief>;
  optedIn: boolean;
}) {
  // The weakest part: the heaviest requirement the code doesn't show (core requirements first). If everything is
  // shown, the covered requirement with the lowest level.
  const SECTION_RANK = { requirements: 0, role: 1, 'nice-to-have': 2, other: 3 } as const;
  const gap = [...m.missing].sort((a, b) => b.weight - a.weight || SECTION_RANK[a.section] - SECTION_RANK[b.section])[0];
  const thinnest = [...m.covered].sort((a, b) => TIER_RANK[a.evidence.tier] - TIER_RANK[b.evidence.tier] || a.weight - b.weight)[0];

  return (
    <section aria-label={`All evidence for ${name}`} className="pt-5">
      <div className="grid gap-x-10 gap-y-4 md:grid-cols-2">
        <div>
          <h4 className="field-label">Weakest part of the evidence</h4>
          {gap ? (
            <p className="mt-1 text-reading">
              <span className="font-semibold">{label(gap.skill)}</span>
              {gap.section === 'requirements' && <span className="text-slate">, a core requirement,</span>}{' '}
              {gap.evidence ? (
                <>
                  is only <span className="font-semibold">{levelLabel(gap.evidence.tier)}</span>
                  {gap.evidence.repo && (
                    <>
                      {' '}
                      in <span className="font-mono">{gap.evidence.repo}</span>
                    </>
                  )}
                  : <Inline text={gap.evidence.reasons[0]} />
                </>
              ) : (
                'has no evidence in the repos read.'
              )}
            </p>
          ) : thinnest ? (
            <p className="mt-1 text-reading">
              Every skill this role names is shown in the code. The least supported is{' '}
              <span className="font-semibold">{label(thinnest.skill)}</span>, {levelLabel(thinnest.evidence.tier)}:{' '}
              <Inline text={thinnest.evidence.reasons[0]} />
            </p>
          ) : (
            <p className="mt-1 text-reading text-slate">No evidence for this role yet.</p>
          )}
        </div>
        <div>
          <h4 className="field-label">What the side quest would test</h4>
          {brief ? (
            <div className="mt-1 text-reading">
              <p>
                <span className="font-semibold text-alert">{label(brief.targetSkill)}</span>, the open requirement, through{' '}
                <span className="font-semibold">“{brief.brief.title}”</span>: {brief.brief.why_they_care}
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-slate">
                {brief.brief.scope.slice(0, 2).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-1 text-reading text-slate">
              {!optedIn
                ? 'Nothing: this role is closed to side quests.'
                : m.strength !== 'strong'
                  ? 'Nothing yet: side quests open only once existing evidence is strong, so a side quest closes one gap, not five.'
                  : 'Nothing yet: no reviewed side quest targets this candidate’s open requirement.'}
            </p>
          )}
        </div>
      </div>

      <h4 className="field-label mt-6">Every skill this role names, with the repository behind it</h4>
      <ReportTable covered={m.covered} missing={m.missing} openSkill={brief?.targetSkill ?? null} openTitle={brief?.brief.title ?? null} legend={false} />
    </section>
  );
}
