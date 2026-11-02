# Side Quest design system

Source of truth: [`src/styles/global.css`](../src/styles/global.css). This page explains it.
Rule for every component: **use semantic utilities and the component utilities below; never raw hex,
`[arbitrary]` values or `/opacity` tints.** If something is missing, add a token here first.

Direction: a native feature of the speedrun talent site. Warm off-white, true-black grotesk, the purple→blue
gradient in exactly one place (the side-quest card edge). Monospace only for literal code and data (repo
names, file paths, packages), so mono marks the proof trail. Evidence strength is shown by ink weight, not
traffic-light colour.

## Token layers

```
Primitives   --sq-stone-100, --sq-black, --sq-blue-600 …   raw values, no utilities generated
    ↓
Semantic     --paper, --ink, --muted, --field, --focus …   purpose; the only layer dark mode changes
    ↓        exposed via @theme inline → bg-paper, text-ink, border-line, border-field …
Component    --shell-list-width, --row-hover, --control-radius …   + @utility classes (btn, field, layout-*)
```

## Semantic colours

| Token | Use | Light | Dark | Contrast (WCAG) |
|---|---|---|---|---|
| `paper` | Page background | `#eae8e3` | `#0f0f11` | n/a |
| `surface` | Raised panels, selected row, side-quest fill | `#f4f3ef` | `#18181b` | n/a |
| `ink` | Text, solid controls, Shipped badge | `#000000` | `#f2f0eb` | 17.2 on paper / 16.8 dark |
| `muted` | Secondary text, placeholders | `#66645f` | `#9b988f` | 4.8 on paper / 6.6 dark (AA) |
| `line` | Decorative hairlines and dividers only | `#d5d2ca` | `#2c2c31` | 1.2 (decorative, exempt) |
| `field` | Input borders (identify a control) | `#85827a` | `#6b6963` | ≥ 3.1 / ≥ 3.2 (1.4.11) |
| `focus` | Focus ring | `#2563eb` | `#3b82f6` | 4.2 / 5.2 |
| `accent-from` → `accent-to` | Side-quest edge and headline accent only | `#8b5cf6` → `#3b82f6` | same | decorative |
| `wash` | Row hover tint | 60% `surface` | same rule | n/a |
| `blank` | `[LINK]` / `[FINDING]` blanks in the founder note | 10% `ink` | same rule | n/a |

Do not use `line` for anything a user must notice to operate (inputs, toggles): use `field`.

## Type

| Role | Utility | Notes |
|---|---|---|
| Display (landing hero) | `text-4xl sm:text-6xl font-extrabold tracking-tight leading-display` | `leading-display` = 1.05 |
| Display (compact hero, profile loaded) | `text-xl sm:text-3xl font-extrabold tracking-tight` | |
| Role title | `text-3xl sm:text-4xl font-extrabold tracking-tight` | |
| Side-quest title | `text-2xl sm:text-3xl font-extrabold tracking-tight` | |
| Section heading | `text-lg font-bold` | sentence case, no eyebrow labels |
| Body | `text-base`, long text `max-w-prose leading-relaxed` | keep lines under ~80 characters |
| Secondary | `text-sm text-muted` | |
| Code and data | `font-mono` + `text-code` (0.85em) | repos, paths, packages, stack lists only |

Families: Inter Tight Variable (`font-sans`), JetBrains Mono Variable (`font-mono`), both self-hosted.

## Layout

| Utility | Value | Where |
|---|---|---|
| `lg:layout-shell` | `--shell-list-width` (22rem) + fluid | Role list beside detail |
| `sm:layout-row` | `--row-label-width` (13rem) + fluid | Evidence rows, requirement rows |
| `layout-mark` | `--mark-col` (1.25rem) + fluid | Strength glyph + role text in list rows |
| `sm:layout-defs` | auto + fluid | "How evidence is graded" definitions |
| `lg:list-viewport` | `100dvh − 2 × --sticky-gap` | Sticky, scrollable role list |

Below `lg` the detail renders **before** the list, so a shared link shows the result first.

## Components and states

State priority (highest first): disabled → focus → hover → default. The focus ring is global
(`:focus-visible`, 2px `focus`, 2px offset) and must never be removed without a replacement.

### Button: `btn` + size + variant

Compose exactly one size and one variant: `btn btn-md btn-primary`. No two of these set the same property.

| Variant | Default | Hover | Disabled | Use |
|---|---|---|---|---|
| `btn-primary` | `ink` fill, `paper` text | fill mixes 18% toward `paper` | 40% opacity, not-allowed | The one main action in a group ("Read my GitHub") |
| `btn-secondary` | 1px `ink` border | `surface` fill | same | Alternative actions ("See the demo", "Copy note") |
| `btn-quiet` | 1px `line` border | `ink` border | same | Low-priority action next to a secondary one |

Sizes: `btn-md` (0.5rem × 1rem, 14px) for page controls; `btn-sm` (0.25rem × 0.75rem, 12px) inside cards.
Button text says what happens: "Read my GitHub", "Copy note" → "Copied".

### Field: `field`

Applied to the input itself, or to a wrapper around an input with a prefix ("github.com/").

| State | Look |
|---|---|
| Default | 1px `field` border, `paper` fill |
| Focus | `ink` border + focus ring (wrapper draws the ring via `:has(:focus-visible)`) |
| Placeholder | `muted` at full opacity (never fade it: 70% failed contrast at 2.8:1) |

### Role row (list)

| State | Look |
|---|---|
| Default | Company (muted), title (semibold), "Shows N of M asks" (xs, muted), strength glyph |
| Hover | `bg-wash` |
| Selected | `bg-surface`, title underlined (2px), `aria-current="true"` |
| Opted in | "side quests open" at the right, xs muted |

Selecting moves focus to the detail heading.

### Evidence tier badge

Ink weight, strongest to weakest. Never colour-coded.

| Tier | Style | Meaning |
|---|---|---|
| Shipped | solid `ink` pill, `paper` text | Demonstrated + tests, CI or a live deploy in the same repo |
| Demonstrated | 1px `ink` outline | Manifest lists it and matching source files exist |
| Described | 1px dashed `muted` outline, muted text | README talks about it |
| Mentioned | no border, muted text | Tag, repo language or resume only |

### Strength mark

● Strong · ◐ Some · ○ Thin, with a visually hidden label in lists and a visible label in the detail. When a
high score is capped (too few readable asks), the sentence after it says why.

### Side-quest card

The only element with the gradient: `edge-accent` (1.5px gradient border over `surface`), `rounded-2xl`.
Contains: target skill line, title, why, JD quote (2px `ink` left rule), scope / numbers / done / stack /
data, founder note panel (`paper` fill, `line` border) with `blank`-styled placeholders and a `btn-sm
btn-secondary` copy button, "What could backfire" disclosure.

### Locked state

Dashed `line` border, no fill, title + one muted paragraph that says why and what to do instead.

### Join CTA

`ink` block with `paper` text and an inverted `btn btn-md` (`paper` fill). Appears once, at the end of
every role detail.

## Motion

Transitions only on colour, background and border (`--duration-fast`, 150ms) in response to the user.
No entrance animations. `prefers-reduced-motion` reduces all durations to ~0.

## Checking compliance

- `grep -rnoE "(text|w|h|grid-cols|max-h|leading|top)-\[[^]]+\]|(bg|text|border)-[a-z]+/[0-9]+" src/components`
  must return nothing.
- The ui-ux-pro-max `validate-tokens.cjs` flags only `global.css`, where primitives are meant to live.
- Contrast numbers above were computed with the WCAG 2.x relative-luminance formula; recompute if a
  primitive changes.
