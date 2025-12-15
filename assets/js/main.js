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

    nav.setAttribute('data-nav-no-transition', 'true');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        nav.removeAttribute('data-nav-no-transition');
      });
    });

    const rootElement = document.documentElement;
    const mobileQuery = window.matchMedia('(min-width: 721px)');

    const isOpen = () => nav.getAttribute('data-open') === 'true';
    const isMobileViewport = () => !mobileQuery.matches;

    const dropdownButtons = Array.from(nav.querySelectorAll('[data-nav-parent]'));
    const hoverTimers = new WeakMap();

    const getDropdownItem = (button) => button.closest('[data-nav-item]');
    const getDropdownMenu = (button) => {
      const item = getDropdownItem(button);
      return item ? item.querySelector('[data-nav-submenu]') : null;
    };
    const getMenuItems = (button) => {
      const menu = getDropdownMenu(button);
      if (!menu) return [];
      return Array.from(menu.querySelectorAll('a[href], button:not([disabled])'));
    };

    const isDropdownOpen = (button) => button.getAttribute('aria-expanded') === 'true';

    const cancelHoverTimer = (item) => {
      const timer = hoverTimers.get(item);
      if (typeof timer === 'number') {
        window.clearTimeout(timer);
        hoverTimers.delete(item);
      }
    };

    const closeDropdown = (button, { focusButton = false } = {}) => {
      const item = getDropdownItem(button);
      const menu = getDropdownMenu(button);
      if (item) {
        item.removeAttribute('data-open');
      }
      button.setAttribute('aria-expanded', 'false');
      if (menu) {
        menu.setAttribute('aria-hidden', 'true');
      }
      if (focusButton) {
        button.focus();
      }
    };

    const openDropdown = (button, { focusFirstItem = false } = {}) => {
      const item = getDropdownItem(button);
      const menu = getDropdownMenu(button);
      if (item) {
        item.setAttribute('data-open', 'true');
      }
      button.setAttribute('aria-expanded', 'true');
      if (menu) {
        menu.setAttribute('aria-hidden', 'false');
      }
      if (focusFirstItem) {
        const [first] = getMenuItems(button);
        if (first) {
          first.focus();
        }
      }
    };

    const closeAllDropdowns = ({ except } = {}) => {
      dropdownButtons.forEach((button) => {
        if (except && button === except) return;
        closeDropdown(button);
      });
    };

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
      closeAllDropdowns();
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
      const parentButton = event.target.closest('button.site-nav__link');
      if (parentButton) {
        const shouldOpen = !isDropdownOpen(parentButton);
        if (shouldOpen) {
          closeAllDropdowns({ except: parentButton });
          openDropdown(parentButton);
        } else {
          closeDropdown(parentButton);
        }
        return;
      }

      const anchorTarget = event.target.closest('a.site-nav__link, a.site-nav__sub-link, .site-nav__cta');
      if (anchorTarget) {
        if (anchorTarget.getAttribute('aria-current') === 'page') {
          event.preventDefault();
        }
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
        closeAllDropdowns();
      }
    };

    dropdownButtons.forEach((button) => {
      button.setAttribute('aria-expanded', button.getAttribute('aria-expanded') || 'false');
      const item = getDropdownItem(button);
      const menu = getDropdownMenu(button);
      if (menu && !menu.hasAttribute('aria-hidden')) {
        menu.setAttribute('aria-hidden', 'true');
      }

      button.addEventListener('click', (event) => {
        const shouldOpen = !isDropdownOpen(button);
        if (!isMobileViewport()) {
          event.preventDefault();
        }
        if (shouldOpen) {
          closeAllDropdowns({ except: button });
          openDropdown(button, { focusFirstItem: false });
        } else {
          closeDropdown(button);
        }
      });

      button.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          closeAllDropdowns({ except: button });
          openDropdown(button, { focusFirstItem: true });
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          closeAllDropdowns({ except: button });
          openDropdown(button);
          const items = getMenuItems(button);
          const last = items[items.length - 1];
          if (last) {
            last.focus();
          }
        } else if (event.key === 'Escape' && isDropdownOpen(button)) {
          event.preventDefault();
          closeDropdown(button, { focusButton: true });
        }
      });

      if (item) {
        item.addEventListener('pointerenter', () => {
          if (isMobileViewport()) return;
          cancelHoverTimer(item);
          closeAllDropdowns({ except: button });
          openDropdown(button);
        });
        item.addEventListener('pointerleave', () => {
          if (isMobileViewport()) return;
          cancelHoverTimer(item);
          const timer = window.setTimeout(() => {
            closeDropdown(button);
          }, 120);
          hoverTimers.set(item, timer);
        });
        item.addEventListener('focusin', () => {
          if (isMobileViewport()) return;
          cancelHoverTimer(item);
          closeAllDropdowns({ except: button });
          openDropdown(button);
        });
        item.addEventListener('focusout', (event) => {
          if (isMobileViewport()) return;
          if (!item.contains(event.relatedTarget)) {
            closeDropdown(button);
          }
        });
      }

      if (menu) {
        menu.addEventListener('keydown', (event) => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'].includes(event.key)) return;
          const items = getMenuItems(button);
          if (!items.length) return;
          const currentIndex = items.indexOf(document.activeElement);
          if (event.key === 'Escape') {
            event.preventDefault();
            closeDropdown(button, { focusButton: true });
            return;
          }
          event.preventDefault();
          let nextIndex = currentIndex;
          if (event.key === 'ArrowDown') {
            nextIndex = currentIndex + 1;
          } else if (event.key === 'ArrowUp') {
            nextIndex = currentIndex - 1;
          } else if (event.key === 'Home') {
            nextIndex = 0;
          } else if (event.key === 'End') {
            nextIndex = items.length - 1;
          }
          if (nextIndex < 0) {
            nextIndex = items.length - 1;
          } else if (nextIndex >= items.length) {
            nextIndex = 0;
          }
          items[nextIndex].focus();
        });
      }
    });

    if (dropdownButtons.length) {
      document.addEventListener('pointerdown', (event) => {
        if (!nav.contains(event.target)) {
          closeAllDropdowns();
        }
      });
    }

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
    fillCurrentYear();
    enhanceOptInForm();
    enhanceAffiliateButtons();

    initSiteNavigation();
    hydratePreloadedStyles();
    root.classList.remove('no-js');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
