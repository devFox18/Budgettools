# BudgetTools Automation Agents

## Purpose
Automated agents help keep the BudgetTools experience polished while letting contributors ship changes quickly. Each agent focuses on a quality pillar—visual consistency, accessibility, copy, SEO, performance, and form behaviour—so reviewers can concentrate on product decisions instead of regressions.

## Agents Overview

### UI Consistency Agent
- **Runs:** on every pull request.
- **What it checks:** spacing scale, typography tokens, component states, and banned classes (e.g., legacy dark-mode selectors).
- **Output:** PR review comments with before/after snippets and a checklist of mismatched tokens.
- **Config:** `.agent-rules/ui.json` and design tokens in `assets/css/style.css`.
- **Checklist before merging:**
  - No `dark:` or `.theme-toggle` classes.
  - Section padding aligns with the 4/8/12/16/24/32 spacing scale.
  - Buttons and cards use the shared variables defined in `assets/css/style.css`.

### Accessibility Agent
- **Runs:** GitHub Actions on every PR and nightly schedule.
- **What it checks:** Lighthouse + AXE scans for color contrast, missing labels, focus traps, and ARIA misuse. Reports include file/line references.
- **Config:** `.github/workflows/accessibility.yml`, thresholds in `.agent-rules/a11y.json`.
- **Actionable cues:** Fix failing nodes, attach screenshots for visual updates, and re-run the workflow locally with `npm run lint:a11y`.

### Content QA Agent
- **Runs:** pull requests and nightly.
- **What it checks:** spelling, grammar, placeholder copy (`Lorem ipsum`, `TODO`), and product terminology (e.g., enforcing “BudgetTools”).
- **Config:** `.agent-rules/content.yml` with custom dictionary entries.
- **Author tips:** Run `npm run lint:content` before committing copy-heavy changes.

### SEO & Meta Agent
- **Runs:** PRs and nightly.
- **What it checks:** `<title>`, meta descriptions, Open Graph/Twitter tags, canonical links, and presence of schema.org metadata where required.
- **Config:** `.github/workflows/seo.yml` with page allowlists and thresholds.
- **Checklist:**
  - One canonical URL per page.
  - Titles ≤ 60 characters when possible.
  - Descriptions filled and unique.

### Performance Agent
- **Runs:** PRs (blocking) and nightly (reporting only).
- **What it checks:** bundle size budgets, unused CSS, image dimensions, and CLS/LCP timings via Lighthouse CI.
- **Config:** `.github/workflows/performance.yml`, budgets in `performance-budget.json`.
- **If it fails:** review the artifact report, optimise assets (compression, code-splitting), or update the budget with justification.

### Forms & Validation Agent
- **Runs:** PRs touching forms and nightly.
- **What it checks:** required labels, visible error messaging, keyboard navigation, and accessible descriptions—particularly on the Savings Goal calculator.
- **Config:** `.agent-rules/forms.json` plus scripted journeys in `tests/forms/`.
- **Contributor checklist:**
  - Every input has an associated `<label>`.
  - Error states announce via `aria-live` regions.
  - Tab order matches the visual layout.

## How They Run
- **Pre-commit (optional):** run `npm run lint` to trigger local UI/content/form lint rules before pushing.
- **GitHub Actions:** all agents run on pull requests. Failing checks block merging unless explicitly overridden.
- **Nightly schedules:** rerun all agents at 02:00 UTC to catch regressions that slip in via infrastructure or dependency updates.

## Configuration & Updates
- Central configuration lives alongside workflows in `.github/workflows/` and rule files under `.agent-rules/`.
- Thresholds (contrast ratios, bundle sizes, typo dictionaries) are documented at the top of each config file.
- Update configs via pull request, noting rationale in the description. Include agent output links so reviewers can see before/after results.

## Contribution Guide
1. **Adding new rules:**
   - Extend the relevant config file under `.agent-rules/`.
   - Run the matching agent locally (see package scripts) and include logs in your PR.
2. **Interpreting reports:**
   - UI comments quote the offending CSS selector and expected token.
   - Accessibility reports attach Lighthouse/AXE JSON—focus on `severity: "error"` items first.
   - Content reports annotate the line; accept dictionary suggestions or rewrite copy.
3. **Creating a new agent:**
   - Place configuration in `.agent-rules/<agent>.json`.
   - Add a GitHub Action workflow or extend an existing composite action.
   - Document the agent here so contributors know what to expect.

Keep agent output actionable: link to files, include quick-fix suggestions, and avoid blocking unless the issue affects end users.
