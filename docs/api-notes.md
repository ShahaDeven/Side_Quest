# speedrun API notes (recon, 2026-11-02)

Base: `https://speedrun-talent-network.com/api/v1` · spec: `/api/v1/openapi.json` (OpenAPI 3.1, API v1.4.0).
Public, read-only, no auth. Responses are JSON, edge-cached 1–5 min. CORS: `Access-Control-Allow-Origin: *`,
methods `GET, OPTIONS`. Always pass `source=side-quest` (echoed back in the response).

Trimmed real responses: [samples/jobs-list.json](samples/jobs-list.json),
[samples/job-detail.json](samples/job-detail.json), [samples/company.json](samples/company.json).

## `GET /jobs` — search open roles

Query used: `?scope=speedrun&fn=engineering&page={n}&source=side-quest`

**Pagination:** `page` is **0-based**, 50 items per page, max 200. Response carries `total`, `page`,
`page_size`, `total_pages`. Loop `page = 0 … total_pages - 1`.
On 2026-11-02: `total 96`, `total_pages 2`, 96 unique ids fetched.

Response: `{ jobs[], total, page, page_size, total_pages, facets, scope, beyond_portfolio, source }`

Job list item fields: `id, title, company, company_slug, company_url, url, location, workplace_type,
employment_type, function, seniority, remote, comp_min, comp_max, comp_currency, comp_period, published_at,
stealth, cohort, tier`.

- `url` already carries `utm_source=<source>&utm_medium=agent`. Link to it as-is.
- `seniority` is often `null`; `published_at` is sometimes a date, sometimes a full timestamp.

Useful filters (all comma-separated unless noted):

| Param | Use |
|---|---|
| `fn` | function: engineering, research, product, design, sales, marketing, operations, other |
| `spec` | specialty slug, only meaningful with exactly one `fn` (e.g. `llm_application_agents`) |
| `ai=1` | only AI-native roles (40 of 96 engineering roles on 2026-11-02) |
| `sen`, `lvl`, `yoe`, `eng` | seniority / classified level / experience band / engagement |
| `loc`, `metro`, `wp`, `remote=1` | location filters |
| `q` | free text (title, company, location) |
| `sort` | `rel` \| `new` \| `comp` |

`facets` gives live counts for each filter. Ones we use:
- `facets.fn` (scope label + "coming next"): engineering 96, customer 14, marketing 12, design 12, product 9,
  sales 5, … Note: facet counts are for the whole speedrun scope, not just the `fn` filter.
- `facets.spec`: `llm_application_agents` 10, `ml_engineering` 8, `generalist` 12, `fullstack` 5, …
- `facets.aiRole`: 40.

## `GET /jobs/{id}` — job detail

`id` accepts the UUID, its first 8 hex chars, or the slug from a job URL.

**Response is wrapped:** `{ job: {...}, source }` (not a flat object).

`job` adds to the list fields: `status` (`open`), `description_text` (plain text, 300–8,500 chars),
`comp_summary` (display string), `apply` (`{ kind: "external", url }`, e.g. an Ashby link), and `labels`:

```json
{ "function": "engineering", "specialty": "LLM apps and agents", "seniority": "staff or principal",
  "min_experience": "unknown", "workplace": "onsite", "engagement": "full-time",
  "founding_role": false, "ai_native_role": true }
```

`labels.specialty` and `labels.ai_native_role` are handy for grouping roles in the UI.

## `GET /companies/{slug}` — company profile

Response: `{ company: {...}, source }`.

`company`: `slug, name, url, tier, cohort, open_roles, location, industries, blurb, logo, labels, jobs[]`.
`jobs[]` items are slimmer: `id, title, url, location, workplace_type, employment_type, comp_summary,
comp_min, comp_max, comp_period, published_at`.

We use `blurb` and `industries` for the brief prompt. **Don't use `logo`** (no company branding).

## Other endpoints (not used in Stage 1)
`/companies` (list), `/collections`, `/collections/{slug}`, `/stats/hiring`.

## Implications for the build
- `lib/speedrun.ts` must unwrap `job` / `company`, and loop pages until `total_pages`.
- Snapshot = 96 list items + 96 detail calls + one company call per distinct slug. Fine for a build script.
- **Ranking roles by proof strength needs every description**, so the browser must not make ~100 detail
  calls. The role list + descriptions come from one Worker endpoint (`/api/roles`) that builds the set and
  caches it in KV; fallback is the bundled snapshot. Proposed PLAN.md change for Step 1.1.
- "N engineering roles evaluated" = `total` from the list call, cross-checked against ids loaded.
