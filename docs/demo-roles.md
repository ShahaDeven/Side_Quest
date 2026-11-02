# Demo roles (Step 1.0, 2026-11-02)

Chosen by scanning all 96 speedrun engineering roles against the themes in `ShahaDeven`'s public repos, then
reading each shortlisted description. Evidence listed here is from repo topics/descriptions only; Step 1.2's
evidence engine decides the real tiers.

These roles become the opted-in roles in `src/data/optins.json` (labelled **demo** in the UI: the founders
have not actually opted in).

## Confirmed

| Role | id | Why it's a demo role |
|---|---|---|
| **Sekai, AI Agent Engineer (Coding Agent)**, San Francisco. **`?demo=1` default.** | `6b385ffe-8550-44cb-969e-5fae13d6f42a` | JD names LangGraph, eval harnesses, regression testing, failure taxonomies, retry/repair loops, model cost/latency. Evidence: Market_Pulse, discharge-safety-gate, SQL-Forge, Project_interface. Likely gap: TypeScript + real-time systems. |
| **Darwin, Member of Technical Staff**, Palo Alto | `01be0d6f-9fa8-49dd-96c5-1db935fe96a8` | Agent evaluations, sandboxed tests, MCP, web agents. Evidence: discharge-safety-gate, Project_interface, Market_Pulse (MCP), AI_SQL_Agent. Likely gap: search/ranking. Staff-level role. |
| **Nexxa.ai, Senior SDET, QA - AI Systems**, SF Bay area (hybrid) | `21e899e9-9a45-4d34-838b-3b69256a27d7` | Eval harnesses, regression suites, CI quality gates, simulators/sandboxes for agents: discharge-safety-gate, Hone promotion gate, Meeting_Insight_Trust. Senior/Staff, 3–5 yrs. |
| **Tenera, Founding Member of Technical Staff**, San Francisco (onsite) | `3166d525-4ecd-47af-b0b1-e38b43a8d0c3` | "Harness loop: evals, tests, quality gates", simulated users (≈ discharge-safety-gate's synthetic patient calls), orchestrating coding agents. Gap: TypeScript/React/Next.js frontend. |

## Considered, not opted in (still ranked in the role list)

| Role | id | Tie to existing projects | Catch |
|---|---|---|---|
| Aghanim, Founding ML Engineer, Post-Training, Belgrade (onsite) | `49418a32-baf4-4176-9540-9cb6962d3936` | SFT/LoRA/DPO, TRL, vLLM, Qwen, Langfuse, LLM-judge evaluators, model routing: near 1:1 with SQL-Forge | Belgrade onsite; staff/principal |
| Clair Health, Machine Learning Engineer, Menlo Park (onsite) | `59cf6703-814d-2ba5-1f78-4e42c5765ef8` | Grounded AI agent, voice, evals + guardrails for a health product: discharge-safety-gate, Meeting_Insight_Trust (Whisper) | Core of the role is biosignal/wearable ML |
| Omi Health, Founding Engineer, NYC (hybrid) | `1f08b7a4-0abf-478e-a3f7-b3463930aa04` | Evals in CI, retrieval quality as a metric, multi-agent in production, Python/FastAPI | Founding generalist; iOS/React bonus |

## Skipped
- **Dex** (Senior Product Engineer): an AI recruiter, so it overlaps the speedrun talent team's own space.
- **Forgepoint** (Senior / Staff SWE): TypeScript end-to-end, 5+ yrs; proof would rate Some, not Strong.
- **General Magic** (AI/ML Engineer): strong match but Toronto onsite 5 days/week.
