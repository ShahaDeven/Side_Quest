/**
 * The requirement table: the core of every candidate report (app and proof pages).
 * Each row reads the founder's sentence → each skill it names, with its evidence level → the code that answers it. No hooks, so it renders on
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

/** Ellipses mark where a long line was cut; ignore them when matching two quotes of the same sentence. */
const bare = (q: string) => q.replace(/…/g, '').trim();

export interface RowGroup {
  /** The founder's sentence, shown once. When two skills quote different cuts of one line, the longer cut. */
  quote: string;
  rows: Row[];
}

/** One group per founder sentence: a line naming Python and TypeScript is one requirement with two skills. */
export function groupRows(rows: Row[]): RowGroup[] {
  const groups: RowGroup[] = [];
  for (const r of rows) {
    const q = bare(r.quote);
    const g = groups.find((x) => bare(x.quote).includes(q) || q.includes(bare(x.quote)));
    if (!g) groups.push({ quote: r.quote, rows: [r] });
    else {
      g.rows.push(r);
      if (q.length > bare(g.quote).length) g.quote = r.quote;
    }
  }
  return groups;
}

/** Distinct founder sentences behind a set of skills. */
export const requirementCount = (covered: CoveredRequirement[], missing: MissingRequirement[]) =>
  groupRows(reportRows(covered, missing)).length;

interface Props {
  covered: CoveredRequirement[];
  missing: MissingRequirement[];
  /** Skill id of the open requirement the side quest targets, if any. */
  openSkill?: string | null;
  /** Title of the side quest that closes the open requirement. */
  openTitle?: string | null;
  /** The level legend after the table. Off where one legend already sits on the page (expanded founder rows). */
  legend?: boolean;
}

export default function ReportTable({ covered, missing, openSkill = null, openTitle = null, legend = true }: Props) {
  const groups = groupRows(reportRows(covered, missing));
  return (
    <div className="mt-6">
      <table className="w-full border-collapse text-left md:table-fixed">
        <caption className="sr-only">
          The role's requirements in its own words, heaviest first, with the evidence for each skill they name
        </caption>
        <colgroup className="hidden md:table-column-group">
          <col className="w-12" />
          <col className="w-2/5" />
          <col className="w-52" />
          <col />
        </colgroup>
        <thead className="hidden md:table-header-group">
          <tr className="border-b border-ink">
            <th scope="col" className="field-label py-2.5 pr-3 font-semibold">Ref</th>
            <th scope="col" className="field-label py-2.5 pr-6 font-semibold">Requirement, in the role's words</th>
            <th scope="col" className="field-label py-2.5 pr-6 font-semibold">Skill and evidence level</th>
            <th scope="col" className="field-label py-2.5 font-semibold">Evidence in the code</th>
          </tr>
        </thead>
        {groups.map((g, gi) => {
          const groupOpen = g.rows.some((r) => r.skill === openSkill);
          const n = g.rows.length;
          return (
            <tbody key={g.rows[0].skill} className={groupOpen ? 'border-y-2 border-alert bg-open' : 'border-b border-rule'}>
              {g.rows.map((r, ri) => {
                const open = r.skill === openSkill;
                const e = r.evidence;
                const first = ri === 0;
                const last = ri === n - 1;
                // Skills inside one sentence sit close; the sentence's rule and padding frame the group.
                const cell = `md:align-top ${first ? 'md:pt-4' : 'md:pt-1'} ${last ? 'md:pb-4' : 'md:pb-1'}`;
                return (
                  <tr key={r.skill} id={`req-${r.skill}`} className={`ref-grid grid gap-x-3 gap-y-2 md:table-row ${first ? 'pt-4' : 'pt-3'} ${last ? 'pb-4' : ''}`}>
                    {first && (
                      <>
                        <td rowSpan={n} className={`report-head tnum text-lg md:py-4 md:pr-3 md:align-top ${groupOpen ? 'text-alert' : 'text-slate'}`}>
                          A{gi + 1}
                        </td>
                        <td rowSpan={n} className="md:py-4 md:pr-6 md:align-top">
                          <p className="text-base leading-snug font-medium">“{g.quote}”</p>
                        </td>
                      </>
                    )}
                    <td className={`col-start-2 md:col-auto md:pr-6 ${cell}`}>
                      <p className="mb-1 text-sm">
                        <span className="font-semibold">{label(r.skill)}</span>
                        <span className="text-slate">, {SECTION_WORD[r.section]}</span>
                      </p>
                      <EvidenceLevel tier={e?.tier ?? null} open={open} />
                    </td>
                    <td className={`col-start-2 min-w-0 md:col-auto ${cell}`}>
                      {open && (
                        <p className="mb-1.5 text-sm font-semibold text-alert">
                          Open requirement{openTitle ? `: the side quest “${openTitle}” closes it` : ''}
                        </p>
                      )}
                      {e && r.covered ? (
                        <Trail repo={e.repo} url={e.url} reasons={e.reasons} notes={e.notes} />
                      ) : e ? (
                        <div className="text-sm text-slate">
                          <p>Closest evidence:</p>
                          <Trail repo={e.repo ?? 'resume'} url={e.url} reasons={e.reasons.slice(0, 2)} notes={e.notes?.slice(0, 1)} />
                        </div>
                      ) : (
                        <p className="text-sm text-slate">No evidence in the repos read.</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>

      {legend && <LevelLegend />}
    </div>
  );
}

/** What each evidence level claims. One per page: the candidate report, the proof page, the founder view. */
export function LevelLegend() {
  return (
    <section aria-labelledby="levels-heading" className="mt-6 border-t border-rule pt-3">
      <h4 id="levels-heading" className="field-label">
        How to read the evidence level
      </h4>
      <p className="mt-1 max-w-prose text-sm text-slate">
        Each level claims only what was checked. Tests, CI and deploy links appear as notes beside the evidence and never raise
        a level. Demonstrated counts in full: most good work is never released or deployed.
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
        {[...LEVELS].reverse().map((l) => (
          <div key={l.tier}>
            <dt>
              <EvidenceLevel tier={l.tier} />
            </dt>
            <dd className="mt-0.5 text-slate">{l.meaning}</dd>
          </div>
        ))}
        <div>
          <dt>
            <EvidenceLevel tier={null} />
          </dt>
          <dd className="mt-0.5 text-slate">Nothing in the repos read answers it yet.</dd>
        </div>
      </dl>
    </section>
  );
}

function Trail({ repo, url, reasons, notes = [] }: { repo?: string; url?: string; reasons: string[]; notes?: string[] }) {
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
      {notes.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 border-l border-rule pl-2.5 text-sm leading-relaxed text-slate" aria-label="Notes, which don't change the level">
          {notes.map((n) => (
            <li key={n}>
              <Inline text={n} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
