/**
 * Public proof page body. Rendered on the server with no hydration: plain HTML for whoever receives the link.
 * Reuses the app's requirement table so the two never drift apart.
 *
 *   role link    → one company: the company in the headline, every requirement with its evidence, the side quest.
 *                  No other company is ever mentioned.
 *   network link → the talent team: an index of roles, each opening to its full requirement table.
 */
import type { ReactNode } from 'react';
import { tierBreakdown } from '../lib/match';
import { proofKind, readUnderLooserRules, roleSummary, sideQuestOf, type ProofDoc, type ProofRole } from '../lib/proof';
import { SKILL_BY_ID } from '../lib/skills';
import { Breakdown, ExternalIcon, strengthLabel } from './marks';
import ReportTable from './ReportTable';

const label = (id: string) => SKILL_BY_ID.get(id)?.label ?? id;
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export default function ProofView({ doc }: { doc: ProofDoc }) {
  return proofKind(doc) === 'role' ? <RoleLink doc={doc} /> : <NetworkLink doc={doc} />;
}

function Candidate({ doc }: { doc: ProofDoc }) {
  const c = doc.candidate;
  return (
    <div className="flex items-center gap-3">
      {c.avatarUrl && <img src={c.avatarUrl} alt="" width={44} height={44} className="size-11 border border-rule" />}
      <p className="min-w-0 text-slate">
        <span className="font-semibold text-ink">{c.name ?? c.login}</span>{' '}
        <a href={c.profileUrl} className="font-mono text-sm text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
          github.com/{c.login}
        </a>
        <span className="tnum block text-sm">
          {c.reposRead} public repos read on {fmt(c.evidenceFetchedAt)}
          {c.demo && ', the demo profile'}
        </span>
      </p>
    </div>
  );
}

/** Links stored before the stricter levels keep their evidence, and say what the labels meant then. */
function OlderRules({ doc }: { doc: ProofDoc }) {
  if (!readUnderLooserRules(doc)) return null;
  return (
    <p role="note" className="mt-4 max-w-prose border-y border-ink py-2.5 text-reading">
      <span className="font-semibold">Read under earlier, looser rules.</span>{' '}
      <span className="text-slate">
        When this link was made, Demonstrated meant a dependency file listed the skill, and Shipped meant the repo also had
        tests, CI or a deploy link. Today those count as Declared, with tests and CI as notes. A new link reads the code again
        under the current rules.
      </span>
    </p>
  );
}

const HowRead = () => (
  <p className="mt-4 max-w-prose text-reading text-slate">
    Side Quest read these public repos: their file lists, READMEs and dependency files, a sample of their source files,
    and GitHub's own release and deployment records. Each level claims only what was checked, and every line links to its
    source. Anyone can create this page for any public GitHub account, so it shows evidence of the work, not who sent the link.
  </p>
);

function Posting({ url }: { url: string }) {
  return (
    <a href={url} className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap underline decoration-rule underline-offset-4 hover:decoration-ink">
      Open on speedrun <ExternalIcon />
    </a>
  );
}

function Fields({ r, withRole }: { r: ProofRole; withRole: boolean }) {
  const cells: [string, ReactNode][] = [
    ...(withRole ? ([['Role', r.title]] as [string, ReactNode][]) : []),
    ['Location', r.location ?? 'Not stated'],
    ['Evidence', strengthLabel(r.strength)],
    ['Posting', <Posting url={r.url} />],
  ];
  return (
    <dl className={`grid grid-cols-2 border-y border-ink ${withRole ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
      {cells.map(([term, value], i) => (
        <div key={term} className={`border-rule py-2.5 pr-4 ${i > 0 ? 'sm:border-l sm:pl-4' : ''} ${i > 1 ? 'border-t sm:border-t-0' : ''}`}>
          <dt className="field-label">{term}</dt>
          <dd className="mt-0.5 font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// --- role link -----------------------------------------------------------------------------------

function RoleLink({ doc }: { doc: ProofDoc }) {
  const r = doc.roles[0];
  const who = doc.candidate.name ?? doc.candidate.login;
  return (
    <article aria-labelledby="proof-title" className="bg-sheet px-5 pt-6 pb-8 sm:px-8">
      <header>
        <Candidate doc={doc} />
        <h1 id="proof-title" className="report-head mt-6 text-4xl leading-none sm:text-5xl">
          {who}'s evidence for {r.company}
        </h1>
        <div className="mt-5">
          <Fields r={r} withRole />
        </div>
        <HowRead />
        <OlderRules doc={doc} />
      </header>
      <RoleBody r={r} level={2} />
    </article>
  );
}

// --- network link --------------------------------------------------------------------------------

function NetworkLink({ doc }: { doc: ProofDoc }) {
  const who = doc.candidate.name ?? doc.candidate.login;
  const n = doc.roles.length;
  return (
    <article aria-labelledby="proof-title" className="bg-sheet px-5 pt-6 pb-8 sm:px-8">
      <header>
        <Candidate doc={doc} />
        <h1 id="proof-title" className="report-head mt-6 text-4xl leading-none sm:text-5xl">
          {who}'s evidence across {n} speedrun {n === 1 ? 'role' : 'roles'}
        </h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed">
          For the speedrun talent team: the roles where {who}'s existing work already covers most of what the founder asks for.
          Open a role to see each requirement and the code behind it.
        </p>
        <HowRead />
        <OlderRules doc={doc} />
      </header>

      <h2 className="report-head mt-8 text-2xl">Roles</h2>
      <ol className="mt-2 border-t border-ink">
        {doc.roles.map((r, i) => {
          const sq = sideQuestOf(r);
          return (
            <li key={r.roleId} className="border-b border-rule">
              <details open={n === 1} className="group">
                <summary className="summary-plain grid min-h-11 cursor-pointer ref-grid gap-x-3 py-4 hover:bg-wash">
                  <span className="report-head tnum text-lg text-slate">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <span className="font-semibold">
                        {r.company}
                        <span className="font-normal text-slate">, {r.title}</span>
                      </span>
                      <span className="text-sm font-semibold underline decoration-rule underline-offset-4">
                        <span className="group-open:hidden">Show the evidence</span>
                        <span className="hidden group-open:inline">Hide the evidence</span>
                      </span>
                    </span>
                    <span className="tnum mt-0.5 block text-sm text-slate">
                      {strengthLabel(r.strength)}, {roleSummary(r)}
                      {sq && <span className="text-alert">. Side quest open for {label(sq.targetSkill)}</span>}
                    </span>
                  </span>
                </summary>
                <div className="pb-8 md:pl-13">
                  <Fields r={r} withRole={false} />
                  <RoleBody r={r} level={3} />
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

// --- shared --------------------------------------------------------------------------------------

function RoleBody({ r, level }: { r: ProofRole; level: 2 | 3 }) {
  const H = level === 2 ? 'h2' : 'h3';
  const Sub = level === 2 ? 'h3' : 'h4';
  const sq = sideQuestOf(r);
  return (
    <section aria-label={`${r.company}, ${r.title}: requirements and evidence`} className="mt-6">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <H className="text-lg">
          <span className="tnum font-semibold">{roleSummary(r)}.</span>
          {r.cappedBy === 'few-requirements' && <span className="font-normal text-slate"> The description names too few readable skills to call it strong.</span>}
          {r.cappedBy === 'few-core-covered' && <span className="font-normal text-slate"> Most of it answers day-to-day items, not the core requirements.</span>}
        </H>
        <Breakdown b={tierBreakdown(r)} className="text-sm text-slate" />
      </div>

      <ReportTable covered={r.covered} missing={r.missing} openSkill={sq?.targetSkill ?? null} openTitle={sq?.title ?? null} />

      {sq && (
        <section aria-label="Side quest" className="mt-8 border-t-2 border-alert pt-4">
          <p className="text-sm text-slate">
            Side quest for the open requirement, <strong className="font-semibold text-alert">{label(sq.targetSkill)}</strong>. Founder
            opt-in is simulated in this demo.
          </p>
          <Sub className="report-head mt-1 text-3xl leading-none">{sq.title}</Sub>
          <p className="mt-3 max-w-prose text-base leading-relaxed">{sq.why_they_care}</p>
          <p className="field-label mt-4">What to build in one day</p>
          <ul className="mt-1.5 list-disc space-y-1.5 pl-4 text-reading">
            {sq.scope.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
