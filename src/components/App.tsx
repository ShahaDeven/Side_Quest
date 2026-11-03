import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import briefsJson from '../data/briefs.json';
import optins from '../data/optins.json';
import { pickBrief, type BriefFile } from '../lib/briefs';
import { resumeEvidence, withResume } from '../lib/evidence';
import { loadDemoProfile, loadProfile } from '../lib/load-profile';
import { loadRoles, type LoadedRoles } from '../lib/load-roles';
import { compareMatches, extractRequirements, matchRole, sideQuestGate } from '../lib/match';
import { defaultView, findRole, readUrl, writeUrl, type View } from '../lib/session';
import type { MatchResult } from '../lib/types';
import FounderView from './FounderView';
import ProofBar, { type ProfileState } from './ProofBar';
import RoleDetail from './RoleDetail';
import RoleList from './RoleList';
import ScopeBar from './ScopeBar';
import ShareProof from './ShareProof';

const briefs = briefsJson as BriefFile;
/** The demo's official opt-ins. The founder view's toggle overrides these for the current visit only. */
const demoOptIns = new Set(optins.roles.map((r) => r.id));

const TABS: { id: View; label: string }[] = [
  { id: 'founder', label: 'What the founder sees' },
  { id: 'candidate', label: 'Candidate report' },
];

export default function App() {
  const [loaded, setLoaded] = useState<LoadedRoles | null>(null);
  const [profile, setProfile] = useState<ProfileState>({ kind: 'none' });
  const [resume, setResume] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>('candidate');
  const [listOpen, setListOpen] = useState(false);
  const [optInOverrides, setOptInOverrides] = useState<Map<string, boolean>>(new Map());
  const optedIn = useMemo(() => {
    const set = new Set(demoOptIns);
    for (const [id, on] of optInOverrides) {
      if (on) set.add(id);
      else set.delete(id);
    }
    return set;
  }, [optInOverrides]);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const report = useRef<HTMLDivElement>(null);

  // --- loading ---------------------------------------------------------------------------------

  const readGitHub = useCallback(async (login: string) => {
    setProfile({ kind: 'loading', login });
    const r = await loadProfile(login);
    setProfile(r.ok ? { kind: 'ready', profile: r.profile, demo: false } : { kind: 'error', login, message: r.message });
  }, []);

  const openDemo = useCallback(async () => {
    setProfile({ kind: 'ready', profile: await loadDemoProfile(), demo: true });
    setSelectedId((cur) => cur ?? optins.demoRoleId);
  }, []);

  useEffect(() => {
    const url = readUrl(window.location.search);
    setView(url.view ?? defaultView(url.demo));
    loadRoles().then((r) => {
      setLoaded(r);
      const role = findRole(r.set.roles, url.role);
      if (role) setSelectedId(role.id);
      else if (url.demo) setSelectedId(optins.demoRoleId);
    });
    if (url.demo) openDemo();
    else if (url.user) readGitHub(url.user);
  }, [openDemo, readGitHub]);

  // --- matching (all roles, recomputed only when evidence changes) ----------------------------

  const roles = loaded?.set.roles ?? [];
  const requirements = useMemo(() => new Map(roles.map((r) => [r.id, extractRequirements(r)])), [roles]);

  const evidence = useMemo(() => {
    if (profile.kind !== 'ready') return null;
    return resume.trim() ? withResume(profile.profile.evidence, resumeEvidence(resume)) : profile.profile.evidence;
  }, [profile, resume]);

  const matches = useMemo(() => {
    if (!evidence) return null;
    return new Map<string, MatchResult>(roles.map((r) => [r.id, matchRole(r, evidence, requirements.get(r.id))]));
  }, [roles, evidence, requirements]);

  const ordered = useMemo(() => {
    if (!matches) return [...roles].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
    return [...roles].sort((a, b) => compareMatches(matches.get(a.id)!, matches.get(b.id)!));
  }, [roles, matches]);

  const strongRoleIds = useMemo(
    () => (matches ? ordered.filter((r) => matches.get(r.id)?.strength === 'strong').map((r) => r.id) : []),
    [ordered, matches],
  );

  // Default selection: best match when there is one, else the newest role with requirements Side Quest can read.
  const selected =
    roles.find((r) => r.id === selectedId) ?? ordered.find((r) => (requirements.get(r.id)?.length ?? 0) > 0) ?? ordered[0] ?? null;
  const match = selected && matches ? matches.get(selected.id)! : null;
  const gate = match && selected ? sideQuestGate(match, optedIn.has(selected.id)) : null;
  const you = profile.kind === 'ready' && evidence ? { profile: profile.profile, evidence } : null;
  const brief = gate?.reason === 'unlocked' && selected && match ? pickBrief(briefs, selected.id, match.missing) : null;
  const isDemo = profile.kind === 'ready' && profile.demo;

  // --- URL sync --------------------------------------------------------------------------------

  useEffect(() => {
    if (!loaded) return;
    const user = profile.kind === 'ready' && !profile.demo ? profile.profile.login : profile.kind === 'error' || profile.kind === 'loading' ? profile.login : null;
    const next = writeUrl({ demo: isDemo, user, role: selectedId, view });
    if (next !== window.location.search) history.replaceState(null, '', `${window.location.pathname}${next}`);
  }, [loaded, profile, isDemo, selectedId, view]);

  const select = (id: string) => {
    setSelectedId(id);
    setListOpen(false);
    // Move focus to the report so keyboard and screen-reader users land on what changed.
    requestAnimationFrame(() => {
      detailHeading.current?.focus({ preventScroll: true });
      report.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  return (
    <>
      <SkipLinks />
      <Header view={view} onView={setView} showTabs={!!selected} />

      <main id="main" className="mx-auto max-w-7xl px-4 pb-16 sm:px-8">
        {profile.kind !== 'ready' && <Intro />}

        <ProofBar state={profile} resume={resume} onRead={readGitHub} onDemo={openDemo} onResume={setResume} />

        <div className="mt-4" aria-busy={!loaded}>
          {loaded ? (
            <>
              {/* On narrow screens the scope line follows the report, so the first screen reaches the evidence. */}
              <div className="hidden lg:block">
                <ScopeBar set={loaded.set} via={loaded.via} />
              </div>
              <div className="grid gap-6 lg:layout-shell lg:gap-8">
                <div id="roles" className="scroll-mt-4 lg:sticky lg:top-6 lg:list-viewport lg:self-start lg:overflow-y-auto lg:pr-1">
                  <button
                    type="button"
                    aria-expanded={listOpen}
                    aria-controls="role-index"
                    onClick={() => setListOpen((v) => !v)}
                    className="btn btn-md btn-secondary w-full justify-between lg:hidden"
                  >
                    <span>{listOpen ? 'Hide roles' : `All ${roles.length} roles${matches ? ', ranked by evidence' : ''}`}</span>
                    <span aria-hidden className="report-head">{listOpen ? '−' : '+'}</span>
                  </button>
                  <div id="role-index" className={`${listOpen ? 'block' : 'hidden'} mt-3 lg:mt-0 lg:block`}>
                    <RoleList roles={ordered} matches={matches} optedIn={optedIn} selectedId={selected?.id ?? null} onSelect={select} />
                  </div>
                </div>

                <div id="report" ref={report} className="min-w-0 scroll-mt-4">
                  {selected && (
                    <RoleDetail
                      ref={detailHeading}
                      role={selected}
                      requirements={requirements.get(selected.id) ?? []}
                      match={match}
                      gate={gate}
                      brief={brief}
                      view={view}
                      optedIn={optedIn.has(selected.id)}
                      founder={
                        <FounderView
                          role={selected}
                          requirements={requirements.get(selected.id) ?? []}
                          optedIn={optedIn.has(selected.id)}
                          onToggleOptIn={(on) => setOptInOverrides((m) => new Map(m).set(selected.id, on))}
                          you={you}
                          briefs={briefs}
                        />
                      }
                    >
                      {profile.kind === 'ready' && match && (
                        <ShareProof
                          key={`${profile.profile.login}:${selected.id}`}
                          login={profile.profile.login}
                          demo={profile.demo}
                          roleId={selected.id}
                          company={selected.company}
                          strongRoleIds={strongRoleIds}
                          usedResume={resume.trim().length > 0}
                        />
                      )}
                    </RoleDetail>
                  )}
                </div>
              </div>
              <div className="mt-6 lg:hidden">
                <ScopeBar set={loaded.set} via={loaded.via} />
              </div>
            </>
          ) : (
            <Skeleton />
          )}
        </div>
      </main>
    </>
  );
}

function SkipLinks() {
  const cls =
    'sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-sheet focus:px-4 focus:py-3 focus:font-semibold focus:text-ink';
  return (
    <>
      <a href="#report" className={cls}>
        Skip to the report
      </a>
      <a href="#roles" className={cls}>
        Skip to the roles
      </a>
    </>
  );
}

/** The navy band: wordmark, the unofficial note, and the two views of the selected role. */
function Header({ view, onView, showTabs }: { view: View; onView: (v: View) => void; showTabs: boolean }) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === view);
    const next =
      e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onView(TABS[next].id);
    tabs.current[next]?.focus();
  };

  return (
    <header className="bg-head text-head-ink">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pt-4 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div className="pb-1 md:pb-3.5">
          <a href="/" className="report-head text-2xl leading-none no-underline">
            Side Quest
          </a>
          <p className="text-sm text-head-muted">Unofficial concept: an evidence layer for the speedrun Talent Network</p>
        </div>
        {showTabs && (
          <div role="tablist" aria-label="View of this role" onKeyDown={onKey} className="-mb-px flex gap-6">
            {TABS.map((t, i) => {
              const active = t.id === view;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={active}
                  aria-controls="role-panel"
                  tabIndex={active ? 0 : -1}
                  onClick={() => onView(t.id)}
                  className={`report-head min-h-11 border-b-2 pb-2.5 text-lg tracking-wide transition-colors ${
                    active ? 'border-head-ink text-head-ink' : 'border-transparent text-head-muted hover:text-head-ink'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}

/** Shown until a profile is read: the positioning, in one heading and one line. */
function Intro() {
  return (
    <section aria-labelledby="intro" className="pt-8 pb-2">
      <h1 id="intro" className="max-w-4xl font-report text-4xl leading-display font-bold sm:text-5xl">
        Speedrun already connects founders with exceptional talent. Side Quest helps them see what that talent can actually build.
      </h1>
      <p className="mt-3 max-w-prose text-reading text-slate">
        It reads a public GitHub and answers each live engineering role's requirements with the files that show them. Every claim
        links to its source.
      </p>
    </section>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading speedrun roles" className="grid gap-8 lg:layout-shell">
      <div className="space-y-px">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse bg-sheet" />
        ))}
      </div>
      <div className="space-y-4 bg-sheet p-8">
        <div className="h-10 w-2/3 animate-pulse bg-ground" />
        <div className="h-40 animate-pulse bg-ground" />
      </div>
    </div>
  );
}
