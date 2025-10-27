/**
 * Hulpfuncties om het thema te wisselen en voorkeuren op te slaan.
 * Alles is in het Nederlands toegelicht zodat duidelijk is wat er gebeurt.
 */
(() => {
  /**
   * Sleutel voor localStorage zodat we het thema kunnen onthouden.
   */
  const STORAGE_KEY = 'budgettools-theme';

  /**
   * Documentelement waarmee we het data-attribuut voor het thema zetten.
   */
  const root = document.documentElement;

  /**
   * Zoek de knop op waarmee gebruikers het thema kunnen veranderen.
   */
  const toggle = document.getElementById('themeToggle');

  /**
   * Geeft de eerder opgeslagen voorkeur of anders de systeemvoorkeur terug.
   */
  const readPreferredTheme = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  /**
   * Past het gekozen thema toe en werkt de knoptekst bij.
   */
  const applyTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    updateToggleButton(theme);
  };

  /**
   * Werkt de iconen en tekst van de knop bij zodat de gebruiker weet wat er gebeurt.
   */
  const updateToggleButton = (theme) => {
    if (!toggle) return;
    const icon = toggle.querySelector('.theme-toggle__icon');
    const label = toggle.querySelector('.theme-toggle__label');
    const isDark = theme === 'dark';

    if (icon) {
      icon.textContent = isDark ? '☀️' : '🌙';
    }
    if (label) {
      label.textContent = isDark ? 'Lichte modus' : 'Donkere modus';
    }
    toggle.setAttribute('aria-pressed', String(isDark));
  };

  /**
   * Wisselt het thema en bewaart de nieuwe keuze in localStorage.
   */
  const toggleTheme = () => {
    const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  /**
   * Startpunt zodra de DOM geladen is: initialiseer thema, knop en jaartal.
   */
  const init = () => {
    const initialTheme = readPreferredTheme();
    applyTheme(initialTheme);

    if (toggle) {
      toggle.addEventListener('click', toggleTheme);
    }

    fillCurrentYear();

    /**
     * Als de gebruiker geen voorkeur heeft opgeslagen, volgen we systeemwijzigingen.
     */
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== 'light' && stored !== 'dark') {
        applyTheme(event.matches ? 'dark' : 'light');
      }
    });
  };

  /**
   * Zoekt alle elementen met data-year en vult ze met het huidige jaar.
   */
  const fillCurrentYear = () => {
    const year = new Date().getFullYear();
    document.querySelectorAll('[data-year]').forEach((node) => {
      node.textContent = year;
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
