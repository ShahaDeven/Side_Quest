---
target: the Side Quest app (src/pages/index.astro) and proof pages
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:D:\\Main_Python\\Projects\\Side_Quest\\src\\pages\\index.astro"
target_fingerprint: "sha256:b6e44dffc4572ccc981d23b6df61a0307f45b71de95e7471aa4b932a4e783558"
target_path: "D:\\Main_Python\\Projects\\Side_Quest\\src\\pages\\index.astro"
timestamp: 2026-11-02T23-23-02Z
slug: src-pages-index-astro
---
Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Desktop role list loads pre-scrolled and never says it is ranked |
| 2 | Match system / real world | 3 | "asks", tier words and "Coming next: customer (14)" need translating |
| 3 | User control and freedom | 3 | Founder view still sits under the candidate's profile bar |
| 4 | Consistency and standards | 2 | One count phrased four ways; three black primaries in a row; join CTA with no proof |
| 5 | Error prevention | 3 | Disabled empty submit, username normalisation, delete confirmation |
| 6 | Recognition over recall | 3 | Tier meanings tooltip-only or in a legend after the rows |
| 7 | Flexibility and efficiency | 2 | No grouping/sort; role list after the whole detail in tab order |
| 8 | Aesthetic and minimalist design | 2 | Boxed sections, seven identical pills, repeated pitch, 3,770px / 13,755px pages |
| 9 | Error recovery | 3 | Errors offer the demo; 404/deleted states explain and act |
| 10 | Help and documentation | 2 | No explanation of ranking ("4 of 4" above "8 of 9") or real vs simulated in one place |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict

Content layer authored (file-level evidence, mono only for paths, ink-weight tiers, ●◐○); shell category-default "AI startup on warm off-white". Avoid-list present: gradient text, near-black + purple/blue gradient headline (dark mode), rounded bordered boxes, Inter everywhere, pill badges; partly grey-on-grey. design-system.md still states "native feature of the speedrun site", contradicting the Brand Commitment.

Deterministic scan: static CLI clean (exit 0, nothing suppressed). Browser: 8 findings on 4 pages: gradient-text App.tsx:214 (3 pages); cream-palette global.css:43/206 (all pages; counted true under the new brief); nested-cards SideQuest.tsx:83 in :45; skipped-heading ProofView.tsx:56/68/131/160 (h1→h3, missed by the review); line-length ~86ch ProofView.tsx:40-44; stragglers briefs.json:371 via SideQuest.tsx:72 and FounderView.tsx:131-134 (width-dependent). Headless run: no user-visible overlay.

## Priority Issues

- [P1] Identity is the avoid-list (gradient text, cream ground, boxes/nested cards, Inter Tight, pills). Fix: replace the visual world; drop gradient; editorial pairing + mono trail; rules not cards; typographic tier marks; rewrite design-system.md Direction. Command: /impeccable shape → /impeccable typeset.
- [P1] Evidence isn't the star: quoted ask is text-xs muted and truncated mid-word (snippet() cuts on characters). Fix: ask → answer rows, quote as row headline, skill label to margin, word-boundary truncation, group rows by tier; same in founder view. Command: /impeccable typeset + /impeccable layout.
- [P1] Five-minute path spends the fold on the pitch: first evidence at y≈700 (1440×900), none on first mobile screen. Fix: result as headline on ?demo=1, one-line positioning dek, unboxed one-line profile bar, scope line below detail under lg. Command: /impeccable distill + /impeccable layout.
- [P2] Semantics and keyboard/mobile: proof page h1→h3; inactive tab aria-controls to missing panel; tooltip-only tier hints; no skip link, roles after detail in tab order; tap targets <44px; mono paths break mid-token. Command: /impeccable audit → /impeccable harden.
- [P2] Ending competes and points off-product: three black primaries; join-speedrun banner even without proof (affiliation-adjacent); no way to see a proof page without a DB write. Fix: one primary, preview the demo proof page, demote join to a text link with the unofficial note. Command: /impeccable clarify + /impeccable polish.

## Persona Red Flags

- 5-minute reviewer: positioning read twice before results; honest founder ranking hidden behind a muted tab; cannot preview a proof link; ends on a join banner.
- Jordan: 40%-grey primary looks broken; default role (speedrun PE) quotes "job hunting sux" from the company blurb as asks (false positive); "side quest" undefined.
- Sam: no skip link; list after every repo link; aria-controls dangling; no Home/End on tabs; focus on outline-none h2 without a visible cue.
- Casey: no evidence on first screen; 13,755px page; small tap targets.

## Minor Observations

Role list not labelled as ranked; ● reads as a bullet; duplicate Nexxa rows need location; founder view shows "(you)" and its row shifts ~14px; README emoji leak into quotes; same headline on every view; network proof link's identical ● marks; two width-dependent stragglers.

## Questions to Consider

- Why does each row open with Side Quest's taxonomy word instead of the founder's sentence?
- On ?demo=1, should the first line simply be the verdict?
- When 7 of 8 rows say Shipped, should the UI mark only what differs?
- Should the reviewer land on What the founder sees first?
