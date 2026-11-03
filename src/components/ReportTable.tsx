/**
 * The requirement table: the core of every candidate report (app and proof pages).
 * Each row reads founder's words → evidence level → the code that answers it. No hooks, so it renders on
 * the server for proof pages too.
 */
import { SKILL_BY_ID } from '../lib/skills';
import type { CoveredRequirement, MissingRequirement, Requirement } from '../lib/types';
import { EvidenceLevel, Inline, LEVELS } from './marks';

const label = (id: string) => SKILL_BY_ID.get(id)?.label ?? id;

const SECTION_WORD: Record<Requirement['section'], string> = {
  requirements: 'requirement',
  role: 'day-to-day',
  'nice-to-have': 'nice to have',
  other: 'mentioned',
};
const SECTION_RANK: Record<Requirement['section'], number> = { requirements: 0, role: 1, 'nice-to-have': 2, other: 3 };

type Row = (CoveredRequirement | MissingRequirement) & { covered: boolean };

/** Founder's priority order: heaviest requirement first, explicit requirements before day-to-day on ties. */
export function reportRows(covered: CoveredRequirement[], missing: MissingRequirement[]): Row[] {
  return [...covered.map((c) => ({ ...c, covered: true })), ...missing.map((m) => ({ ...m, covered: false }))].sort(
    (a, b) => b.weight - a.weight || SECTION_RANK[a.section] - SECTION_RANK[b.section],
  );
}

interface Props {
  covered: CoveredRequirement[];
  missing: MissingRequirement[];
  /** Skill id of the open requirement the side quest targets, if any. */
  openSkill?: string | null;
  /** Title of the side quest that closes the open requirement. */
  openTitle?: string | null;
}

export default function ReportTable({ covered, missing, openSkill = null, openTitle = null }: Props) {
  const rows = reportRows(covered, missing);
  return (
    <div className="mt-6">
      <dl className="grid gap-x-6 gap-y-1.5 border-y border-rule py-3 text-sm sm:grid-cols-2 xl:grid-cols-4" aria-label="Evidence levels">
        {LEVELS.slice()
          .reverse()
          .map((l) => (
            <div key={l.tier} className="flex flex-col">
              <dt className="font-semibold">{l.label}</dt>
              <dd className="text-slate">{l.meaning}</dd>
            </div>
          ))}
      </dl>

      <table className="mt-2 w-full border-collapse text-left md:table-fixed">
        <caption className="sr-only">The role's requirements and the evidence for each, heaviest requirement first</caption>
        <colgroup className="hidden md:table-column-group">
          <col className="w-12" />
          <col className="w-2/5" />
          <col className="w-48" />
          <col />
        </colgroup>
        <thead className="hidden md:table-header-group">
          <tr className="border-b border-ink">
            <th scope="col" className="field-label py-2.5 pr-3 font-semibold">Ref</th>
            <th scope="col" className="field-label py-2.5 pr-6 font-semibold">Requirement, in the role's words</th>
            <th scope="col" className="field-label py-2.5 pr-6 font-semibold">Evidence level</th>
            <th scope="col" className="field-label py-2.5 font-semibold">Evidence in the code</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const open = r.skill === openSkill;
            const e = r.evidence;
            return (
              <tr
                key={r.skill}
                id={`req-${r.skill}`}
                className={`grid grid-cols-[2.5rem_1fr] gap-x-3 gap-y-2 border-b py-4 md:table-row md:py-0 ${open ? 'border-alert bg-open' : 'border-rule'}`}
              >
                <td className={`report-head tnum text-lg md:py-4 md:pr-3 md:align-top ${open ? 'text-alert' : 'text-slate'}`}>A{i + 1}</td>
                <td className="md:py-4 md:pr-6 md:align-top">
                  <p className="text-base leading-snug font-medium">“{r.quote}”</p>
                  <p className="mt-1 text-sm text-slate">
                    {label(r.skill)}, {SECTION_WORD[r.section]}
                  </p>
                </td>
                <td className="col-start-2 md:col-auto md:py-4 md:pr-6 md:align-top">
                  <EvidenceLevel tier={e?.tier ?? null} open={open} />
                </td>
                <td className="col-start-2 min-w-0 md:col-auto md:py-4 md:align-top">
                  {open && (
                    <p className="mb-1.5 text-sm font-semibold text-alert">
                      Open requirement{openTitle ? `: the side quest “${openTitle}” closes it` : ''}
                    </p>
                  )}
                  {e && r.covered ? (
                    <Trail repo={e.repo} url={e.url} reasons={e.reasons} />
                  ) : e ? (
                    <div className="text-sm text-slate">
                      <p>Closest evidence:</p>
                      <Trail repo={e.repo ?? 'resume'} url={e.url} reasons={e.reasons.slice(0, 1)} />
                    </div>
                  ) : (
                    <p className="text-sm text-slate">No evidence in the repos read.</p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Trail({ repo, url, reasons }: { repo?: string; url?: string; reasons: string[] }) {
  return (
    <div className="min-w-0">
      {repo &&
        (url ? (
          <a href={url} target="_blank" rel="noopener" className="font-mono text-sm font-semibold text-ink underline decoration-rule decoration-1 underline-offset-4 hover:decoration-ink">
            {repo}
          </a>
        ) : (
          <span className="font-mono text-sm font-semibold">{repo}</span>
        ))}
      <ul className="mt-1 space-y-0.5 text-sm leading-relaxed text-slate">
        {reasons.map((reason) => (
          <li key={reason}>
            <Inline text={reason} />
          </li>
        ))}
      </ul>
    </div>
  );
}
