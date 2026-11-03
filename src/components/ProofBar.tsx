import { useEffect, useState, type FormEvent } from 'react';
import type { CandidateProfile } from '../lib/types';

export type ProfileState =
  | { kind: 'none' }
  | { kind: 'loading'; login: string }
  | { kind: 'ready'; profile: CandidateProfile; demo: boolean }
  | { kind: 'error'; login: string; message: string };

interface Props {
  state: ProfileState;
  resume: string;
  onRead: (login: string) => void;
  onDemo: () => void;
  onResume: (text: string) => void;
}

/** Whose code is being read, and the controls to change it. A ruled strip of the report, not a card. */
export default function ProofBar({ state, resume, onRead, onDemo, onResume }: Props) {
  const [login, setLogin] = useState(state.kind === 'ready' && !state.demo ? state.profile.login : '');
  const [showResume, setShowResume] = useState(resume.length > 0);
  // Once a profile is loaded the form gets out of the way; it comes back on "Use a different GitHub".
  const [editing, setEditing] = useState(state.kind !== 'ready');
  useEffect(() => setEditing(state.kind !== 'ready'), [state]);
  const busy = state.kind === 'loading';
  const isDemo = state.kind === 'ready' && state.demo;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = login.trim().replace(/^@/, '').replace(/^https?:\/\/github\.com\//i, '').replace(/\/.*$/, '');
    if (v) onRead(v);
  };

  return (
    <section aria-label="Whose code is read" className="border-b border-ink py-3">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Who state={state} />

        <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <label htmlFor="gh-login" className="sr-only">
                GitHub username
              </label>
              <div className="field flex items-center">
                <span className="pl-3 font-mono text-sm text-slate" aria-hidden>
                  github.com/
                </span>
                <input
                  id="gh-login"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="username"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus={state.kind === 'ready'}
                  className="w-36 bg-transparent py-2 pr-3 font-mono text-sm outline-none"
                />
              </div>
              <button type="submit" disabled={busy || !login.trim()} className="btn btn-md btn-primary">
                {busy ? 'Reading…' : 'Read my GitHub'}
              </button>
              {!isDemo && (
                <button type="button" onClick={onDemo} className="btn btn-md btn-secondary">
                  See the demo
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEditing(true)} className="btn btn-md btn-secondary">
                {isDemo ? 'Use my GitHub instead' : 'Use a different GitHub'}
              </button>
              {!isDemo && (
                <button type="button" onClick={onDemo} className="btn btn-md btn-quiet">
                  See the demo
                </button>
              )}
            </>
          )}
          <button
            type="button"
            aria-expanded={showResume}
            aria-controls={showResume ? 'resume-box' : undefined}
            onClick={() => setShowResume((v) => !v)}
            className="min-h-11 px-2 text-sm text-slate underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink"
          >
            {showResume ? 'Hide resume text' : 'Add resume text'}
          </button>
        </form>
      </div>

      {state.kind === 'error' && (
        <p role="alert" className="mt-3 text-sm">
          <span className="font-semibold">{state.message}</span>{' '}
          <button type="button" onClick={onDemo} className="min-h-11 underline underline-offset-4">
            Open the demo profile instead
          </button>
        </p>
      )}

      {showResume && (
        <div id="resume-box" className="mt-4 max-w-3xl">
          <label htmlFor="resume" className="field-label">
            Resume text, optional
          </label>
          <textarea
            id="resume"
            value={resume}
            onChange={(e) => onResume(e.target.value)}
            rows={5}
            placeholder="Paste your resume. Skills found here count as mentioned, never as shown in code."
            className="field mt-1.5 w-full p-3 text-sm"
          />
          <p className="mt-1.5 text-sm text-slate">Resume text stays in this browser. It is never sent or saved.</p>
        </div>
      )}

      {editing && <p className="mt-3 text-sm text-slate">Only public repos are read. Results are cached for 6 hours to stay within GitHub's limits.</p>}
    </section>
  );
}

function Who({ state }: { state: ProfileState }) {
  if (state.kind === 'ready') {
    const p = state.profile;
    return (
      <div className="flex min-w-0 items-center gap-3">
        {p.avatarUrl && <img src={p.avatarUrl} alt="" width={40} height={40} className="size-10 border border-rule" />}
        <div className="min-w-0">
          <h1 className="truncate text-lg leading-snug font-semibold">
            <span className="sr-only">Evidence report for </span>
            {p.name ?? p.login}{' '}
            <a href={p.profileUrl} target="_blank" rel="noopener" className="font-mono text-sm font-normal text-slate underline decoration-rule underline-offset-4 hover:text-ink">
              github.com/{p.login}
            </a>
          </h1>
          <p className="tnum text-sm text-slate">
            {p.repos.length} of {p.reposConsidered} public repos read in depth
            {state.demo &&
              `, captured ${new Date(p.fetchedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}. Demo: a real public GitHub; founder opt-ins are simulated`}
          </p>
        </div>
      </div>
    );
  }
  if (state.kind === 'loading')
    return (
      <p role="status" className="text-sm">
        Reading <span className="font-mono">github.com/{state.login}</span>: repos, READMEs and dependency files…
      </p>
    );
  return (
    <div>
      <p className="font-semibold">Start with a GitHub profile</p>
      <p className="text-sm text-slate">Each role's requirements are checked against what the public repos actually contain.</p>
    </div>
  );
}
