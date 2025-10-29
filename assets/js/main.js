(() => {
  const root = document.documentElement;

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

  const initSiteNavigation = () => {
    const toggle = document.querySelector('[data-nav-toggle]');
    const nav = document.querySelector('[data-site-nav]');
    if (!toggle || !nav) return;

    const rootElement = document.documentElement;
    const mobileQuery = window.matchMedia('(min-width: 721px)');

    const isOpen = () => nav.getAttribute('data-open') === 'true';
    const isMobileViewport = () => !mobileQuery.matches;

    const openNav = () => {
      nav.setAttribute('data-open', 'true');
      toggle.setAttribute('aria-expanded', 'true');
      rootElement.classList.add('has-nav-open');
    };

    const closeNav = ({ shouldFocusToggle = false } = {}) => {
      if (!isOpen()) return;
      nav.removeAttribute('data-open');
      toggle.setAttribute('aria-expanded', 'false');
      rootElement.classList.remove('has-nav-open');
      if (shouldFocusToggle) {
        toggle.focus();
      }
    };

    toggle.addEventListener('click', () => {
      if (isOpen()) {
        closeNav();
      } else {
        openNav();
      }
    });

    nav.addEventListener('click', (event) => {
      if (!isMobileViewport()) return;
      const link = event.target.closest('.site-nav__link');
      if (link) {
        closeNav();
        return;
      }
      if (!event.target.closest('.site-nav__list')) {
        closeNav();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) {
        closeNav({ shouldFocusToggle: true });
      }
    });

    const handleBreakpointChange = (event) => {
      if (event.matches) {
        closeNav();
      }
    };

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', handleBreakpointChange);
    } else {
      mobileQuery.addListener(handleBreakpointChange);
    }
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
    root.classList.remove('no-js');
    fillCurrentYear();
    enhanceOptInForm();
    enhanceAffiliateButtons();
    initCheckoutButtons();
    initSiteNavigation();
    hydratePreloadedStyles();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
