import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import briefsJson from '../data/briefs.json';
import optins from '../data/optins.json';
import { pickBrief, type BriefFile } from '../lib/briefs';
import { resumeEvidence, withResume } from '../lib/evidence';
import { loadDemoProfile, loadProfile } from '../lib/load-profile';
import { loadRoles, type LoadedRoles } from '../lib/load-roles';
import { compareMatches, extractRequirements, matchRole, sideQuestGate } from '../lib/match';
import { findRole, readUrl, writeUrl } from '../lib/session';
import type { MatchResult } from '../lib/types';
import ProofBar, { type ProfileState } from './ProofBar';
import RoleDetail from './RoleDetail';
import RoleList from './RoleList';
import ScopeBar from './ScopeBar';

const briefs = briefsJson as BriefFile;
const optedIn = new Set(optins.roles.map((r) => r.id));

export default function App() {
  const [loaded, setLoaded] = useState<LoadedRoles | null>(null);
  const [profile, setProfile] = useState<ProfileState>({ kind: 'none' });
  const [resume, setResume] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const detailRegion = useRef<HTMLDivElement>(null);
  const listScroller = useRef<HTMLDivElement>(null);

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

  // Default selection: best match when there is one, else the newest role.
  const selected = roles.find((r) => r.id === selectedId) ?? ordered[0] ?? null;
  const match = selected && matches ? matches.get(selected.id)! : null;
  const gate = match && selected ? sideQuestGate(match, optedIn.has(selected.id)) : null;
  const brief = gate?.reason === 'unlocked' && selected && match ? pickBrief(briefs, selected.id, match.missing) : null;

  // --- URL sync --------------------------------------------------------------------------------

  useEffect(() => {
    if (!loaded) return;
    const demo = profile.kind === 'ready' && profile.demo;
    const user = profile.kind === 'ready' && !profile.demo ? profile.profile.login : profile.kind === 'error' || profile.kind === 'loading' ? profile.login : null;
    const next = writeUrl({ demo, user, role: selectedId });
    if (next !== window.location.search) history.replaceState(null, '', `${window.location.pathname}${next}`);
  }, [loaded, profile, selectedId]);

  // Keep the selected role visible in the desktop list (its own scroll area). On narrow screens the list
  // isn't a scroll container, so nothing moves and the page stays on the detail.
  const selectedRoleId = selected?.id;
  useEffect(() => {
    const box = listScroller.current;
    if (!box || !selectedRoleId || box.scrollHeight <= box.clientHeight) return;
    const item = box.querySelector<HTMLElement>(`[data-role="${selectedRoleId}"]`);
    if (!item) return;
    const top = item.offsetTop;
    if (top < box.scrollTop || top + item.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top - box.clientHeight / 3;
  }, [selectedRoleId, ordered]);

  const select = (id: string) => {
    setSelectedId(id);
    // Move focus to the detail so keyboard and screen-reader users land on what changed; on narrow
    // screens the detail sits above the list, so bring it into view.
    requestAnimationFrame(() => {
      detailHeading.current?.focus({ preventScroll: true });
      detailRegion.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  const isDemo = profile.kind === 'ready' && profile.demo;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
      <Header compact={profile.kind !== 'none'} />

      {isDemo && (
        <p className="mt-4 max-w-3xl text-sm text-muted">
          Demo: Deven Shah's real public GitHub, matched against live speedrun roles. Founder opt-ins to side quests are simulated.
        </p>
      )}

      <div className="mt-6">
        <ProofBar state={profile} resume={resume} onRead={readGitHub} onDemo={openDemo} onResume={setResume} />
      </div>

      <div className="mt-8" aria-busy={!loaded}>
        {loaded ? (
          <>
            <ScopeBar set={loaded.set} via={loaded.via} />
            <div className="grid gap-8 lg:layout-shell lg:gap-10">
              <div ref={detailRegion} className="order-1 scroll-mt-4 lg:order-2">
                {selected && (
                  <RoleDetail ref={detailHeading} role={selected} requirements={requirements.get(selected.id) ?? []} match={match} gate={gate} brief={brief} />
                )}
              </div>
              <div
                ref={listScroller}
                className="relative order-2 lg:order-1 lg:sticky lg:top-6 lg:list-viewport lg:self-start lg:overflow-y-auto lg:pr-1"
              >
                <RoleList roles={ordered} matches={matches} optedIn={optedIn} selectedId={selected?.id ?? null} onSelect={select} />
              </div>
            </div>
          </>
        ) : (
          <Skeleton />
        )}
      </div>
    </main>
  );
}

function Header({ compact }: { compact: boolean }) {
  return (
    <header className="max-w-4xl">
      <p className="font-extrabold tracking-tight">
        Side Quest <span className="font-normal text-muted">for the speedrun Talent Network</span>
      </p>
      <h1
        className={`mt-3 font-extrabold tracking-tight ${compact ? 'text-xl leading-tight sm:text-3xl' : 'text-4xl leading-display sm:text-6xl'}`}
      >
        Speedrun already connects founders with exceptional talent.{' '}
        <span className="text-accent">Side Quest helps them see what that talent can actually build.</span>
      </h1>
    </header>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading speedrun roles" className="grid gap-8 lg:layout-shell">
      <div className="space-y-px">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse bg-surface" />
        ))}
      </div>
      <div className="space-y-4">
        <div className="h-10 w-2/3 animate-pulse rounded bg-surface" />
        <div className="h-40 animate-pulse rounded-xl bg-surface" />
      </div>
    </div>
  );
}
