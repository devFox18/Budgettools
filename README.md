# BudgetTools

BudgetTools is a static HTML, CSS, and JavaScript website. It does not use
Next.js and needs no build step.

## Deploying to Vercel

Import `devFox18/Budgettools` into Vercel with these settings:

- Framework Preset: **Other**
- Root Directory: `./`
- Build Command: leave empty
- Output Directory: leave empty
- Production Branch: `main`

The included `vercel.json` makes clean URLs work and adds basic security
headers. If Vercel shows the default Next.js starter page, the Vercel project
is connected to the wrong repository, branch, or root directory. Correct the
Git settings above and redeploy once without the build cache.

Simple and powerful financial tools – Budget Calculator, Savings Tracker, and more.

## Design System
- Light-first interface using shared tokens in [`assets/css/style.css`](assets/css/style.css)
- Consistent typography scale and spacing via CSS custom properties
- Buttons, cards, and form controls share polished focus/hover states

## Tools
- [Budget Calculator](tools/budget-calculator/index.html)
- [Savings Goal Calculator](tools/savings-goal-calculator/index.html)
- More static resources under the `tools/` directory

## Development
This is a static site. To work locally, serve the project root with any static web server:

```bash
npx http-server .
```

Preload links are hydrated by [`assets/js/main.js`](assets/js/main.js); no build step is required.
