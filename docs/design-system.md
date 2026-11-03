# Side Quest design system

**Direction: an engineering assessment report.** Each founder requirement, in the role's own words, is answered with
the files that show it. The interface refuses the dashboard card grid, match percentages and any athlete-style grading:
evidence is described per requirement, never scored per person.

- Direction contract: `.impeccable/surfaces/src-pages-index-astro.md`
- Tokens: `src/styles/global.css` (the only place raw values live)
- Product rules this design serves: `PRODUCT.md`

## Token layers

1. **Primitives** (`--sq-*`): raw colours and font stacks. No utilities are generated from them.
2. **Semantic**: purpose names. Dark mode (`prefers-color-scheme`) swaps only this layer.
3. **Component**: layout widths, control radius, touch size, as variables and small `@utility` classes.

## Semantic colours

| Token | Light | Dark | Use |
|---|---|---|---|
| `ground` | stock `#e8edf1` | `#0d1624` | the page, the role index |
| `sheet` | white | `#142033` | the report sheet, selected role |
| `ink` | navy `#14233c` | mist `#e6ecf2` | text, heavy rules, primary buttons |
| `slate` | `#55657a` | `#9dadc0` | secondary text (≥5:1) |
| `rule` | `#c5ced8` | `#2a3a52` | hairlines between rows (decorative) |
| `field` | `#7a8798` | `#5f7190` | control boundaries (≥3:1) |
| `alert` | red `#b3362a` | `#f07a6e` | **only** the open requirement and its side quest |
| `focus` | blue `#1f5fbf` | `#7fb0ff` | focus ring |
| `head`, `head-ink`, `head-muted` | navy band | | masthead |

Red is reserved. If something is red, it is the one requirement a side quest closes.

## Type

- **Barlow Condensed** (`report-head`, `field-label`): report headings (uppercase) and field labels. The landing
  headline uses it in sentence case (`font-report`).
- **Source Sans 3**: requirements, prose, controls. `text-reading` (15px / 1.6) for report prose.
- **JetBrains Mono**: only repo names, paths, packages and usernames. `Path` adds a break opportunity after each `/`.
- `tnum` on every count that sits in a column.

## Layout

- Navy masthead: wordmark, the unofficial note, and the two views of the selected role as tabs
  (*What the founder sees* / *Candidate report*). `?demo=1` opens on the founder view.
- Below it, a ruled strip says whose code is read. Then `layout-shell`: a quiet 19rem role index on the ground, and the
  report on a white sheet. Under `lg`, the index collapses behind an "All N roles" button above the report.
- Skip links: to the report, to the roles.

## Components

### Field row
A `dl` ruled top and bottom in ink: Company, Location, Evidence (or Side quests in the founder view), Posting.

### Requirement table (`ReportTable`)
Ref (A1…) | requirement in quotes, with skill and section | evidence level | evidence in the code (repo link, then
reasons with paths in mono). Heaviest requirement first. A visible legend defines the four levels above the table.
The open requirement row takes `bg-open`, a red rule and the side-quest title. On mobile each row becomes a two-column
grid.

### Evidence level (`EvidenceLevel`)
Five square cells filled to the level, always followed by the level in words. Not yet shown = five empty cells. It
describes one requirement's evidence, never the person. Each level claims only what was checked (`src/lib/types.ts`):

| Level | Means |
|---|---|
| Mentioned | A repo tag, the repo language, the description or a resume line names it |
| Described | The README talks about it |
| Declared | A dependency file lists it, or matching files exist; no file that was read shows it in use |
| Demonstrated | Files that were read use it (import it, or contain its own code: SQL statements, a Dockerfile's `FROM`). A language needs a substantial body of the candidate's own code |
| Shipped | Demonstrated, and GitHub records a release, a successful deployment or a Pages site |

Tests, CI, a declared deploy URL and ownership are **notes**, shown under the reasons with a hairline at the left.
They never raise a level. Shipped is a bonus: most good work is never deployed, and Demonstrated counts in full.

### Strength and breakdown
`Strong / Some / Thin evidence` is always read next to `Breakdown` ("Shipped 7 / Demonstrated 1 / …"), never alone.

### Founder view
A table of candidates ranked by evidence for this role: candidate (with "Real public GitHub" or "Demo candidate,
fictional"), strength and breakdown, the strongest evidence (requirement quote → repo → reason), the open requirement,
side-quest status and Shortlist. The simulated opt-in switch sits above it.

### Side quest
A ruled section opened by a 2px red rule: title, why the founder cares, parts with field labels, the note to the
founder with blanks, risks in a `details`.

### Send this report
One primary action (the link for this company), one secondary (the talent-team link), each with "Preview the page
first" (`/p/preview`, built on the server, never saved). Created links show copy actions and the one-time delete link.

### Buttons and fields
`btn` + `btn-md`/`btn-sm` + `btn-primary`/`btn-secondary`/`btn-quiet`. 2px corners, 44px minimum height at both sizes.
`field` for inputs: 3:1 boundary, ink on focus, focus ring via `:has(:focus-visible)`.

## Not in this system
Gradients, gradient text, glassy or glowing cards, pill badges, emoji or sparkle icons, Inter, rounded bordered boxes
around every section, grey-on-grey, sports or scouting vocabulary, percentages.

## Motion
Colour transitions on controls only (`--duration-fast`, 150ms). Reduced motion removes them.

## Checking compliance
`impeccable detect --json src/components src/pages src/layouts` should return `[]`. No arbitrary Tailwind values
outside grid track lists.
