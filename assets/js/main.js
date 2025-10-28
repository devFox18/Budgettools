(() => {
  const STORAGE_KEY = 'budgettools-theme';
  const root = document.documentElement;
  const hasLocalStorage = (() => {
    try {
      const key = '__bt-check__';
      window.localStorage.setItem(key, key);
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  })();

  const getStoredTheme = () => {
    if (!hasLocalStorage) return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  };

  const getSystemTheme = () => (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  const updateThemeMeta = (theme) => {
    const lightMeta = document.querySelector('meta[name="theme-color"][data-mode="light"]');
    const darkMeta = document.querySelector('meta[name="theme-color"][data-mode="dark"]');
    if (lightMeta) {
      lightMeta.setAttribute('content', '#f6f8fb');
    }
    if (darkMeta) {
      darkMeta.setAttribute('content', theme === 'dark' ? '#111827' : '#0b1220');
    }
    const fallbackMeta = document.querySelector('meta[name="theme-color"]:not([data-mode])');
    if (fallbackMeta) {
      fallbackMeta.setAttribute('content', theme === 'dark' ? '#111827' : '#f6f8fb');
    }
  };

  const updateToggleUi = (theme) => {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    const isDark = theme === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    const icon = toggle.querySelector('.theme-toggle__icon');
    const label = toggle.querySelector('.theme-toggle__label');
    if (icon) {
      icon.textContent = isDark ? '☀️' : '🌙';
    }
    if (label) {
      label.textContent = isDark ? 'Lichte modus' : 'Donkere modus';
    }
  };

  const applyTheme = (theme, { persist = true } = {}) => {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    root.setAttribute('data-theme', nextTheme);
    if (document.body) {
      document.body.classList.toggle('dark-mode', nextTheme === 'dark');
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.toggle('dark-mode', nextTheme === 'dark');
      }, { once: true });
    }
    if (persist && hasLocalStorage) {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    }
    updateToggleUi(nextTheme);
    updateThemeMeta(nextTheme);
  };

  const resolveInitialTheme = () => getStoredTheme() ?? getSystemTheme();

  const handleThemeToggle = () => {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  };

  const listenToSystemChanges = () => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', (event) => {
      const stored = getStoredTheme();
      if (stored) return;
      applyTheme(event.matches ? 'dark' : 'light', { persist: false });
    });
  };

  const fillCurrentYear = () => {
    const year = new Date().getFullYear();
    document.querySelectorAll('[data-year]').forEach((node) => {
      node.textContent = year;
    });
  };

  const enhanceOptInForm = () => {
    const form = document.querySelector('[data-optin-form]');
    if (!form) return;
    const success = form.querySelector('[data-optin-success]');
    const fieldsWrapper = form.querySelector('[data-optin-fields]');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const emailField = form.querySelector('input[type="email"]');
      if (emailField && !emailField.value) {
        emailField.focus();
        emailField.setAttribute('aria-invalid', 'true');
        return;
      }
      if (emailField) {
        emailField.removeAttribute('aria-invalid');
      }
      if (fieldsWrapper) {
        fieldsWrapper.setAttribute('data-enhanced', 'hidden');
      }
      if (success) {
        success.setAttribute('data-enhanced', 'visible');
        success.removeAttribute('hidden');
      }
    });
  };

  const enhanceAffiliateButtons = () => {
    document.querySelectorAll('[data-affiliate-button]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.getAttribute('data-href');
        if (!target) return;
        window.open(target, '_blank', 'noopener');
      });
    });
  };

  const initCheckoutButtons = () => {
    document.querySelectorAll('[data-checkout-button]').forEach((button) => {
      button.addEventListener('click', () => {
        const url = button.getAttribute('data-url');
        if (!url) return;
        window.open(url, '_blank', 'noopener');
      });
    });
  };

  const hydratePreloadedStyles = () => {
    const links = document.querySelectorAll('link[data-preload-style]');
    links.forEach((link) => {
      const convert = () => {
        link.rel = 'stylesheet';
        link.removeAttribute('data-preload-style');
      };
      link.addEventListener('load', convert, { once: true });
      link.addEventListener('error', convert, { once: true });
      requestAnimationFrame(convert);
    });
  };

  const init = () => {
    document.documentElement.classList.remove('no-js');
    applyTheme(resolveInitialTheme(), { persist: false });
    handleThemeToggle();
    listenToSystemChanges();
    fillCurrentYear();
    enhanceOptInForm();
    enhanceAffiliateButtons();
    initCheckoutButtons();
    hydratePreloadedStyles();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
