# Skill Execution Plan — InsightForge Business Analytics Studio

This document is produced under Part 1 of the release brief. It is a living
record: skills are invoked as the corresponding phase is executed, not just
listed here in advance.

## Discovery process

1. Enumerated all skills surfaced to this session (built-in ECC bundle,
   `ui-ux-pro-max`, `frontend-design`, `dataviz`, `owasp-security`,
   `simplify`, `find-skills`, and ~250 other ECC topical skills).
2. Ran `npx skills find` (the `find-skills` skill) against nine query
   clusters: data analytics dashboards, D3 visualisation, CSV/Web Worker
   processing, time-series forecasting, sentiment analysis, WCAG
   accessibility, screen/video capture, commercial/Etsy packaging, and
   Playwright testing.
3. Applied the trust bar from `find-skills`: prefer 1K+ installs and a
   reputable source (`vercel-labs`, `anthropics`, `microsoft`-equivalent
   maintainers); treat sub-100-install or single-author repos with
   skepticism.

## Result: no external skill installed

Every external candidate returned by `npx skills find` was either low-install
(<1K), from an unverified individual/niche repo (trading bots, Roblox
analytics, PM-prompt packs), or a thin prompt wrapper rather than executable
guidance. None offered a decisive advantage over the already-installed,
higher-trust bundle below, which gives code-level (not just prompt-level)
guidance for every required topic. Per the brief ("only install from trusted
sources," "do not install unnecessary or untrusted skills"), nothing new was
added.

Candidates considered and rejected (representative, not exhaustive):

| Query | Top candidate | Installs | Why rejected |
|---|---|---|---|
| data analytics dashboard | `aradotso/data-skills@mm2-analytics-dashboard-roblox` | 1.7K | Domain mismatch (Roblox), not business analytics |
| D3 visualisation | `nexu-io/open-design@d3-visualization` | 1.7K | Unverified single-maintainer repo; `dataviz` skill already covers D3 form/color methodology |
| CSV / Web Workers | `clickhouse/agent-skills@clickhouse-js-node-coding` | 2K | Official source but wrong domain (ClickHouse DB, not used here — product has no backend) |
| Forecasting | `aj-geddes/useful-ai-prompts@time-series-analysis` | 517 | Below trust threshold, prompt-only |
| Sentiment analysis | `phuryn/pm-skills@sentiment-analysis` | 1.8K | PM-context prompt pack, not a lexicon/algorithm; brief requires a transparent in-browser method we own and can test |
| Accessibility | `mastepanoski/claude-skills@wcag-accessibility-audit` | 803 | Below 1K threshold; `ecc:accessibility` + `ecc:frontend-a11y` already installed and WCAG 2.2-current |
| Video capture | `github/awesome-copilot@screen-recording` | 73 | Below threshold |
| Etsy/commercial packaging | `mmcmedia/openclaw-agents@etsy-expert` | 133 | Below threshold; brief already fully specifies Etsy copy/schema requirements |
| Playwright testing | `manutej/luxor-claude-marketplace@playwright-visual-testing` | 924 | Below 1K threshold; using official Playwright package directly instead of a skill wrapper |

## Selected skills (installed, applied per phase)

| Skill | Why relevant | Where applied |
|---|---|---|
| `find-skills` | Required discovery step | Part 1 (this document) |
| `dataviz` | Chart-form heuristics, validated color/palette system, mark specs — directly governs every chart in the dashboard, product analysis, geo, forecast and report modules | Parts 7, 9, 10, 12, 15 (all charting) |
| `ui-ux-pro-max` (design, design-system, ui-styling) | Color palettes, font pairings, chart types, dashboard/UX guidelines across stacks; used to build the 3-theme design system | Part 18 (design system, 3 themes, 3 review passes) |
| `frontend-design` | General frontend craft/polish pass | Part 18 (visual/interaction review pass) |
| `owasp-security` (in place of "security-audit", which does not exist under that name; closest trusted equivalents) | OWASP Top 10, injection classes (formula injection, XSS, HTML injection) directly named in the brief | Part 19 (CSV/export/report security review) |
| `simplify` | Post-implementation cleanup for reuse/efficiency without changing behaviour | End of Part 3/Part 19, before final commit |
| `ecc:accessibility` + `ecc:frontend-a11y` | WCAG 2.2 AA semantics, ARIA, keyboard/focus patterns | Part 19 (accessibility requirements) |
| `ecc:react-patterns`, `ecc:react-performance`, `ecc:vite-patterns` | React/TS/Vite conventions and performance (Web Workers, large-file handling) for a static SPA | Part 4 (architecture), Part 6 (Data Quality Lab worker), Part 7 (dashboard perf) |
| `ecc:python-patterns`, `ecc:python-testing` | Pandas/NumPy idioms and pytest conventions for the Analyst Toolkit | Part 17 (Python Analyst Toolkit) |
| `ecc:tdd-workflow`, `verify` | Test-first discipline and end-to-end behavioural verification before marking work done | Parts 12 (forecast tests), 17 (Python tests), Part 5 pre-deploy check |
| `ecc:github-ops`, `ecc:deployment-patterns` | Repo creation, GitHub Pages deploy conventions | Part 20 |
| `ecc:marketing-campaign` | Etsy copy, social captions (Pinterest/Instagram/FB/LinkedIn/X), positioning consistency | Part 22 |
| `ecc:seo` | Meta tags / SEO target on the GitHub Pages demo | Part 20 (SEO 95+ target) |
| `code-review` / `ecc:code-reviewer` | Review after non-trivial implementation phases | After Parts 3, 4, 17 |

## Skills explicitly rejected as irrelevant

- `ecc:django-*`, `ecc:springboot-*`, `ecc:laravel-*`, `ecc:golang-*`,
  `ecc:rust-*`, database/ORM skills (`postgres-patterns`,
  `prisma-patterns`, `database-migrations`) — the brief mandates no backend,
  no database, no server-side processing.
- `ecc:data-scraper-agent` — brief explicitly forbids scraping Etsy or any
  external source; all data is user-uploaded or synthetic.
- `liquid-glass-design` — aesthetic directly contradicted by the brief
  ("avoid excessive gradients / glowing cards").
- `ecc:hexagonal-architecture` — architectural weight not justified for a
  static single-page analytics app (YAGNI).
- Blockchain/trading/scientific-domain skills (`defi-amm-security`,
  `prediction-market-*`, `scientific-*`) — no relevance to this product.

## Newly installed skills

None. See "Result: no external skill installed" above.
