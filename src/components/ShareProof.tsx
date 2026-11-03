import { useState } from 'react';
import { MAX_NETWORK_ROLES, type ProofKind } from '../lib/proof';

interface Created {
  url: string;
  deleteUrl: string;
  markdown: string;
  roles: number;
  requested: number;
}

type Result = { kind: 'idle' } | { kind: 'creating' } | { kind: 'done'; proof: Created } | { kind: 'error'; message: string };

interface Props {
  login: string;
  demo: boolean;
  roleId: string;
  company: string;
  /** Roles where the candidate's proof is strong, best first. */
  strongRoleIds: string[];
  usedResume: boolean;
}

/**
 * Two links for two audiences. The server recomputes the evidence from GitHub; this only says which roles.
 *  - role link:    this company's founder or a recruiter. One role; no other company is ever mentioned.
 *  - network link: the speedrun talent team. All strong roles, summarised.
 */
export default function ShareProof({ login, demo, roleId, company, strongRoleIds, usedResume }: Props) {
  const [results, setResults] = useState<Record<ProofKind, Result>>({ role: { kind: 'idle' }, network: { kind: 'idle' } });
  const networkIds = strongRoleIds.slice(0, MAX_NETWORK_ROLES);

  const create = async (kind: ProofKind) => {
    setResults((r) => ({ ...r, [kind]: { kind: 'creating' } }));
    const roleIds = kind === 'role' ? [roleId] : networkIds;
    let next: Result;
    try {
      const res = await fetch('/api/proof', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login, demo, kind, roleIds }),
      });
      const body = (await res.json().catch(() => null)) as (Partial<Created> & { message?: string }) | null;
      next = res.ok && body?.url ? { kind: 'done', proof: body as Created } : { kind: 'error', message: body?.message ?? 'Could not create the link.' };
    } catch {
      next = { kind: 'error', message: 'Could not reach the server. Check your connection and try again.' };
    }
    setResults((r) => ({ ...r, [kind]: next }));
  };

  // The preview builds the same page on the server from the same inputs, without saving anything.
  const who = demo ? 'demo=1' : `user=${encodeURIComponent(login)}`;
  const preview = (kind: ProofKind) => `/p/preview?kind=${kind}&${who}&roles=${(kind === 'role' ? [roleId] : networkIds).join(',')}`;

  return (
    <section aria-labelledby="share-heading" className="mt-10 border-t-2 border-ink pt-5">
      <h3 id="share-heading" className="report-head text-2xl">
        Send this report
      </h3>
      <p className="mt-1 max-w-prose text-reading text-slate">
        Each link is a page anyone can open without signing in. The evidence is read again from public GitHub when the link is
        created, so the page can't be edited to claim more.{usedResume && ' Your resume text is not included.'}
      </p>

      <div className="mt-5 grid gap-x-10 gap-y-8 md:grid-cols-2">
        <Option
          title={`Link for ${company}`}
          audience="For the founder or a recruiter. Shows this role only and never mentions other companies."
          action={`Create link for ${company}`}
          result={results.role}
          onCreate={() => create('role')}
          previewHref={preview('role')}
          primary
        />
        <Option
          title="Link for the speedrun talent team"
          audience={
            networkIds.length
              ? `Your ${networkIds.length} strong ${networkIds.length === 1 ? 'role' : 'roles'}, one line each, so they can see who to introduce you to.`
              : 'Available once at least one role shows strong evidence.'
          }
          action="Create talent-team link"
          result={results.network}
          onCreate={() => create('network')}
          previewHref={networkIds.length ? preview('network') : null}
          disabled={networkIds.length === 0}
        />
      </div>
    </section>
  );
}

function Option({
  title,
  audience,
  action,
  result,
  onCreate,
  previewHref,
  primary = false,
  disabled = false,
}: {
  title: string;
  audience: string;
  action: string;
  result: Result;
  onCreate: () => void;
  previewHref: string | null;
  primary?: boolean;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="min-w-0 border-t border-rule pt-3">
      <h4 className="font-semibold">{title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-slate">{audience}</p>

      {result.kind !== 'done' ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={onCreate}
              disabled={disabled || result.kind === 'creating'}
              className={`btn btn-md ${primary ? 'btn-primary' : 'btn-secondary'}`}
            >
              {result.kind === 'creating' ? 'Creating link…' : action}
            </button>
            {previewHref && (
              <a href={previewHref} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center text-sm font-semibold underline decoration-rule underline-offset-4 hover:decoration-ink">
                Preview the page first
                <span className="sr-only"> (opens in a new tab; nothing is saved)</span>
              </a>
            )}
          </div>
          {result.kind === 'error' && (
            <p role="alert" className="mt-2 text-sm">
              {result.message}
            </p>
          )}
        </>
      ) : (
        <div className="mt-3 space-y-3" role="status">
          {result.proof.roles < result.proof.requested && (
            <p className="text-sm">
              Includes {result.proof.roles} of {result.proof.requested} roles. The others have closed since this page loaded, or
              didn't fit.
            </p>
          )}
          <a href={result.proof.url} target="_blank" rel="noopener" className="field block truncate px-3 py-2 font-mono text-sm">
            {result.proof.url}
          </a>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copy('link', result.proof.url)} className="btn btn-sm btn-secondary">
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </button>
            <button type="button" onClick={() => copy('md', result.proof.markdown)} className="btn btn-sm btn-quiet">
              {copied === 'md' ? 'Copied' : 'Copy as Markdown'}
            </button>
          </div>
          <div className="border-t-2 border-ink pt-3 text-sm">
            <p className="font-semibold">Save the delete link now. It is shown only once.</p>
            <code className="mt-1 block break-all text-slate">{result.proof.deleteUrl}</code>
            <button type="button" onClick={() => copy('delete', result.proof.deleteUrl)} className="btn btn-sm btn-secondary mt-2">
              {copied === 'delete' ? 'Copied' : 'Copy delete link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
