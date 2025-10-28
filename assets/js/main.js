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
    hydratePreloadedStyles();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
