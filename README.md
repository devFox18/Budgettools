# Budgettools

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
