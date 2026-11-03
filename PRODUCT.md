# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary (decides what gets optimized): the speedrun reviewer evaluating Deven Shah's Product Engineer
(contractor) application** to the a16z speedrun talent team. They open one link (`/?demo=1`), have a few minutes,
and need to understand and believe the idea without signing in or being walked through it. Until the application
is decided, a choice that helps this reviewer wins over one that only helps real-world use.

The product itself serves three users, all inside the speedrun Talent Network:

- **Candidates** (job seekers): want founders to see what they have actually built, not another resume.
- **The speedrun talent team**: reviews candidate profiles and makes introductions; wants to know who to
  introduce to which founder.
- **Founders** at speedrun portfolio companies: hiring early teams; want evidence for *their* role.

## Product Purpose

Side Quest is an evidence layer for the existing speedrun Talent Network. It reads a candidate's public GitHub,
grades what the code actually shows for each live speedrun engineering role, and states the reason behind every
match. When a founder has opened a role to side quests and the candidate's existing proof is already strong, it
offers one small (≤ 1 day) project brief that would close the remaining gap.

Positioning line: *speedrun already connects founders with exceptional talent. Side Quest helps them see what
that talent can actually build.*

Success, now: the reviewer gets the idea and finds it credible within ~5 minutes, which supports Deven's
application. Success as a product (proposed, unmeasured): more qualified introductions per candidate, proof-link
signups, founder adoption of side quests.

## Positioning

- Proof comes from existing work first. Nothing is invented: every claim links to a repo, file or manifest.
- Side quests are **invited** (founder opt-in per role), **earned** (strong existing proof required) and
  **small** (one day, not a free take-home). This is the answer to "unsolicited AI-generated projects become
  the next spam".
- It strengthens speedrun's own network (profiles, talent-team review, introductions) rather than competing with it.

## Operating Context

- Evaluated as a job application: the reviewer arrives from one submitted link, in incognito, with no account.
- Data: speedrun's public, unauthenticated talent-network API (live roles; engineering only in Stage 1), and the
  candidate's public GitHub read on the server.
- Candidates share results as proof links: a **role link** for one company's founder or a recruiter, and a
  **network link** for the speedrun talent team.
- Founders see a ranked shortlist for one role in the "What the founder sees" view.

## Capabilities and Constraints

- **Built (Stage 1):** live role list with snapshot fallback; GitHub evidence engine with five levels (Mentioned,
  Described, Declared, Demonstrated, Shipped) that claim only what was checked: Demonstrated means code that was read
  uses the skill; tests and CI are notes, never a level; Shipped needs a GitHub release or deployment and is a bonus; per-role proof strength (Strong, Some, Thin) with
  explained caps; 13 hand-reviewed side-quest briefs for 4 demo opt-in roles; proof links (role and network) with
  one-time delete links; founder view with fictional demo candidates and a per-browser shortlist; opt-in toggle.
- **Planned:** Stage 1.7 polish and deploy on Cloudflare Workers; Stage 2 GitHub sign-in, saved profiles, side-quest
  submissions with automatic checks; Stage 3 live per-candidate briefs with spend caps. Roadmap items in PLAN.md
  are not to be presented as built.
- **Hard constraints:**
  - The reviewer path never requires sign-in.
  - The browser never sends evidence; the server recomputes it, so proof pages can't be forged.
  - Resume text never leaves the browser and can only ever count as "Mentioned".
  - A role link names exactly one company and never mentions others.
  - Scope is engineering roles only; the UI always states how many roles were evaluated, never full coverage.
  - Spend on model calls stays minimal (Haiku, hard `--max-usd` caps); no model calls from the browser.
- **Terminology:** "evidence of", never "verified" or "proven". Tiers and strength labels as named above.
  "Side quest", "proof link", "role link", "network link", "What the founder sees".
- **Undecided:** whether the network link lists roles with open side quests first.

## Brand Commitments

- Name: **Side Quest**. It is an **unofficial concept built for Deven's application**, on speedrun's public API.
  It is not affiliated with or endorsed by a16z or speedrun, and must never imply otherwise.
- No logos, colours or branding of speedrun portfolio companies beyond the names and links the API provides.
- Everything simulated is labelled demo: founder opt-ins, the founder board, the six seed candidates.
- Visual identity must be its own and not copied from any existing site, including speedrun's (Deven, 2026-11-02).
  He described the intended character as reviewing evidence: precise, credible, a little editorial, confident,
  with repo names, file paths and the role's quoted asks as the content that matters most.

## Evidence on Hand

- **Real:** Deven's public GitHub as the demo candidate (`src/data/demo-profile.json`, 9 repos read, 24 skills);
  live speedrun roles (`/api/roles`, snapshot in `src/data/jobs-snapshot.json`); 13 reviewed briefs
  (`src/data/briefs.json`); Deven's company-specific projects (storeroom-slip-validator for MiraFlores,
  discharge-safety-gate, the Hone promotion gate) as the origin story.
- **Simulated, and always labelled:** founder opt-ins (`src/data/optins.json`); six fictional demo candidates
  with illustrative repos and no links (`src/data/seed-candidates.ts`).
- **Absent, never to be fabricated:** real founder opt-ins, users, testimonials, adoption or reply-rate figures,
  speedrun endorsement. Impact metrics in PLAN.md §11 are proposals, not results.

## Product Principles

1. **Evidence over claims.** Every statement traces to a source a reviewer can open. A false positive is a bug,
   not a rounding error.
2. **Honest even when it costs the demo.** The engine is not tuned to make the demo candidate win; for Sekai a
   fictional candidate ranks above Deven, and that stays.
3. **Invited, earned, small.** Side quests only where a founder opted in, only for strong proof, only one day of work.
4. **One audience per artifact.** A founder sees their role only; the talent team sees the network view.
5. **The five-minute path is the product.** `/?demo=1` shows a finished result with zero clicks; everything else
   is reachable from there.

## Accessibility & Inclusion

WCAG 2.x AA contrast for all text, and 3:1 for control boundaries and the focus ring; full keyboard operation
(including the tabs and the opt-in switch); `prefers-reduced-motion` and `prefers-color-scheme` respected.
Contrast figures are recorded in `docs/design-system.md`.
