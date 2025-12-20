/**
 * Findings:
 * - Totals and insights are buried beneath the add form, making users scroll before seeing the big picture.
 * - Filters, search, and actions are scattered with mobile-hostile controls, and inline edits lack clear save/cancel affordances.
 * - Table rendering recreates markup wholesale, aria-sort hints are missing, and empty/chart states offer little guidance.
 */
(() => {
  /** Redesign Notes
   * IA: Totals surface first, followed by manage controls, the subscription list, then the chart for a top-down narrative.
   * Components: Summary cards, manage controls (filters/actions + add form), responsive table/mobile cards, and Chart.js donut.
   * Extension points: Drop in new filters/actions or additional summary tiles without rewriting persistence or render loops.
   */
  const STORAGE_KEY = 'bt_subscription_saver_v1';
  const FX = { USD: 1, EUR: 0.93, GBP: 0.8 };
  const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£' };
  const QUICK_ADD_ITEMS = [
    { name: 'Netflix', category: 'Streaming', frequency: 'monthly', price: 15.99 },
    { name: 'Spotify', category: 'Music', frequency: 'monthly', price: 9.99 },
    { name: 'iCloud+', category: 'Productivity', frequency: 'monthly', price: 2.99 },
    { name: 'Xbox Game Pass', category: 'Gaming', frequency: 'monthly', price: 14.99 },
    { name: 'Notion Plus', category: 'Productivity', frequency: 'monthly', price: 10 },
    { name: 'Adobe Creative Cloud', category: 'Productivity', frequency: 'monthly', price: 59.99 },
    { name: 'Canva Pro', category: 'Productivity', frequency: 'monthly', price: 12.99 },
    { name: 'Peloton', category: 'Fitness', frequency: 'monthly', price: 44 },
    { name: 'Disney+', category: 'Streaming', frequency: 'monthly', price: 13.99 },
    { name: 'HBO Max', category: 'Streaming', frequency: 'monthly', price: 15.99 }
  ];
  const SUGGESTION_LIMIT = 3;
  const OPTIMIZE_REASON_COPY = {
    expensive: 'High monthly cost',
    duplicate: 'Duplicate category',
    manual: 'Manually selected'
  };
  const SUGGESTION_REASON_COPY = {
    expensive: 'High monthly cost',
    duplicate: 'Duplicate in category',
    unused: 'Marked as rarely used'
  };
  const clone = (value) => {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  };

  const currencyFormatters = new Map();

  function getRate(currency) {
    return FX[currency] ?? 1;
  }

  function toCurrency(valueUSD, currency = state.currency) {
    const rate = getRate(currency);
    const amount = Number(valueUSD) || 0;
    return Math.round((amount * rate + Number.EPSILON) * 100) / 100;
  }

  function fromCurrency(value, currency = state.currency) {
    const rate = getRate(currency);
    if (!rate) return Number(value) || 0;
    const amount = Number(value) || 0;
    return Math.round((amount / rate + Number.EPSILON) * 100) / 100;
  }

  function formatMoney(valueUSD, currency = state.currency) {
    const formatter = getFormatter(currency);
    return formatter.format(toCurrency(valueUSD, currency));
  }

  function getFormatter(currency) {
    if (!currencyFormatters.has(currency)) {
      currencyFormatters.set(currency, new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }));
    }
    return currencyFormatters.get(currency);
  }

  const createId = () => {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `id-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
  };

  const DEMO_ROWS = [
    { name: 'Netflix', category: 'Streaming', frequency: 'monthly', price: 15.99, nextBilling: '', notes: '4K plan', included: true },
    { name: 'Spotify', category: 'Music', frequency: 'monthly', price: 9.99, nextBilling: '', notes: '', included: true },
    { name: 'Xbox Game Pass', category: 'Gaming', frequency: 'monthly', price: 12.99, nextBilling: '', notes: '', included: true },
    { name: 'Adobe Creative Cloud', category: 'Productivity', frequency: 'monthly', price: 60, nextBilling: '', notes: 'All apps', included: true },
    { name: 'Mobile Plan', category: 'Phone', frequency: 'monthly', price: 25, nextBilling: '', notes: '', included: true },
    { name: 'Amazon Prime', category: 'Streaming', frequency: 'yearly', price: 99, nextBilling: '', notes: '', included: true }
  ];

  const defaultState = {
    rows: [],
    sort: { key: 'name', dir: 'asc' },
    filters: { query: '', categories: [], frequency: 'all' },
    currency: 'USD'
  };

  const elements = {
    form: document.getElementById('subscriptionForm'),
    name: document.getElementById('subscriptionName'),
    category: document.getElementById('subscriptionCategory'),
    price: document.getElementById('subscriptionPrice'),
    frequencyMonthly: document.getElementById('frequencyMonthly'),
    frequencyYearly: document.getElementById('frequencyYearly'),
    nextBilling: document.getElementById('subscriptionNextBilling'),
    notes: document.getElementById('subscriptionNotes'),
    priceError: document.getElementById('priceError'),
    tableBody: document.getElementById('subscriptionTableBody'),
    mobileList: document.getElementById('mobileCardList'),
    tableEmpty: document.getElementById('tableEmpty'),
    noMatches: document.getElementById('noMatches'),
    totalMonthly: document.getElementById('totalMonthly'),
    totalYearly: document.getElementById('totalYearly'),
    potentialSavings: document.getElementById('potentialSavings'),
    monthlyDelta: document.getElementById('monthlyDelta'),
    yearlyDelta: document.getElementById('yearlyDelta'),
    savingsHelper: document.getElementById('savingsHelper'),
    tableCount: document.getElementById('tableCount'),
    chartCanvas: document.getElementById('subscriptionChart'),
    chartEmpty: document.getElementById('chartEmpty'),
    search: document.getElementById('searchInput'),
    frequencyRadios: Array.from(document.querySelectorAll('input[name="frequencyFilter"]')),
    categoryCheckboxes: Array.from(document.querySelectorAll('[data-category-filter]')),
    exportCsv: document.getElementById('exportCsvButton'),
    reset: document.getElementById('resetButton'),
    demo: document.getElementById('demoDataButton'),
    currencySelect: document.getElementById('currencySelect'),
    currencyPrefix: document.querySelector('.currency-prefix'),
    miniSummary: document.getElementById('miniSummary'),
    miniMonthly: document.getElementById('miniMonthly'),
    miniYearly: document.getElementById('miniYearly'),
    miniSavings: document.getElementById('miniSavings'),
    miniOptimize: document.getElementById('miniOptimize'),
    optimizeButton: document.getElementById('optimizeButton'),
    optimizeList: document.getElementById('optimizeList'),
    optimizePause: document.getElementById('optimizePause'),
    optimizeClear: document.getElementById('optimizeClear'),
    optimizePanel: document.getElementById('optimizePanel'),
    suggestionsList: document.getElementById('suggestionsList'),
    quickAddButton: document.getElementById('quickAddButton'),
    quickAddMenu: document.getElementById('quickAddMenu'),
    exportCsvTop: document.getElementById('exportCsvButtonTop'),
    demoTop: document.getElementById('demoDataButtonTop'),
    toastRegion: document.getElementById('toastRegion'),
    shortcutsModal: document.getElementById('shortcutsModal')
  };

  let state = loadState();
  let editingId = null;
  let editDraft = null;
  let chartInstance = null;
  let searchTimer = null;
  let pendingFocus = null;
  let editingTrigger = null;
  let lastFocusedEditField = null;
  let optimizeState = { active: false, selected: new Set(), reasons: new Map() };
  let quickAddOpen = false;
  let quickAddPopover = null;
  let lastShortcutTrigger = null;
  let currentTotals = { monthlyUSD: 0, yearlyUSD: 0, savingsUSD: 0 };

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.body.classList.add('prefers-reduced-motion');
  }

  init();

  function init() {
    updateFilterControls();
    syncCurrencyControls();
    ensureToastRegion();
    bindEvents();
    render();
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return clone(defaultState);
      const parsed = JSON.parse(stored);
      const rowsSource = Array.isArray(parsed.rows)
        ? parsed.rows
        : Array.isArray(parsed.items)
          ? parsed.items
          : [];
      const rows = rowsSource.map(normaliseRow);
      const sort = parsed.sort && typeof parsed.sort === 'object' ? {
        key: ['name', 'category', 'monthly', 'yearly', 'nextBilling'].includes(parsed.sort.key) ? parsed.sort.key : 'name',
        dir: parsed.sort.dir === 'desc' ? 'desc' : 'asc'
      } : clone(defaultState.sort);
      const filters = parsed.filters && typeof parsed.filters === 'object' ? {
        query: typeof parsed.filters.query === 'string' ? parsed.filters.query : '',
        categories: Array.isArray(parsed.filters.categories) ? parsed.filters.categories.filter(Boolean) : [],
        frequency: ['monthly', 'yearly'].includes(parsed.filters.frequency) ? parsed.filters.frequency : 'all'
      } : clone(defaultState.filters);
      const currency = typeof parsed.currency === 'string' && FX[parsed.currency] ? parsed.currency : 'USD';
      return { rows, sort, filters, currency };
    } catch (error) {
      console.warn('Failed to load subscription saver state', error);
      return clone(defaultState);
    }
  }

  function normaliseRow(row) {
    return {
      id: typeof row.id === 'string' ? row.id : createId(),
      name: typeof row.name === 'string' ? row.name : '',
      category: typeof row.category === 'string' ? row.category : 'Other',
      frequency: row.frequency === 'yearly' ? 'yearly' : 'monthly',
      price: typeof row.price === 'number' ? row.price : Number(row.price) || 0,
      nextBilling: typeof row.nextBilling === 'string' ? row.nextBilling : '',
      notes: typeof row.notes === 'string' ? row.notes : '',
      included: typeof row.included === 'boolean' ? row.included : true
    };
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Unable to persist subscription saver data', error);
    }
  }

  function syncCurrencyControls() {
    if (elements.currencySelect) {
      elements.currencySelect.value = state.currency;
    }
    updateCurrencyPrefix();
    updateQuickAddCopy();
  }

  function updateCurrencyPrefix() {
    if (elements.currencyPrefix) {
      elements.currencyPrefix.textContent = CURRENCY_SYMBOLS[state.currency] ?? '$';
    }
  }

  function ensureToastRegion() {
    if (!elements.toastRegion) {
      const region = document.createElement('div');
      region.id = 'toastRegion';
      region.className = 'toast-region';
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      document.body.appendChild(region);
      elements.toastRegion = region;
    } else {
      elements.toastRegion.setAttribute('aria-live', 'polite');
      elements.toastRegion.setAttribute('aria-atomic', 'true');
    }
  }

  function toast(message) {
    if (!message) return;
    ensureToastRegion();
    const toastNode = document.createElement('div');
    toastNode.className = 'toast';
    toastNode.textContent = message;
    elements.toastRegion.appendChild(toastNode);
    window.setTimeout(() => {
      toastNode.classList.add('toast--exit');
      window.setTimeout(() => {
        toastNode.remove();
      }, 300);
    }, 3000);
  }

  function updateQuickAddCopy() {
    const container = quickAddPopover || elements.quickAddMenu;
    if (!container) return;
    container.querySelectorAll('[data-quick-add]').forEach((button) => {
      let data;
      const payload = button.getAttribute('data-quick-add');
      if (payload) {
        try {
          data = JSON.parse(payload);
        } catch (error) {
          data = null;
        }
      }
      if (!data) {
        const name = button.getAttribute('data-quick-add-name');
        const price = Number.parseFloat(button.getAttribute('data-quick-add-price'));
        const frequency = button.getAttribute('data-quick-add-frequency') || 'monthly';
        if (!name || Number.isNaN(price)) return;
        data = { name, price, frequency };
        button.dataset.quickAdd = JSON.stringify(data);
      }
      const monthlyUSD = data.frequency === 'yearly' ? data.price / 12 : data.price;
      button.textContent = `${data.name} · ${formatMoney(monthlyUSD, state.currency)}`;
    });
  }

  function bindEvents() {
    if (elements.form) {
      elements.form.addEventListener('submit', handleAdd);
    }
    if (elements.exportCsv) {
      elements.exportCsv.addEventListener('click', () => exportCsv());
    }
    if (elements.exportCsvTop) {
      elements.exportCsvTop.addEventListener('click', () => exportCsv());
    }
    if (elements.reset) {
      elements.reset.addEventListener('click', handleReset);
    }
    if (elements.demo) {
      elements.demo.addEventListener('click', insertDemoData);
    }
    if (elements.demoTop) {
      elements.demoTop.addEventListener('click', insertDemoData);
    }
    if (elements.currencySelect) {
      elements.currencySelect.addEventListener('change', handleCurrencyChange);
    }

    if (elements.search) {
      elements.search.addEventListener('input', handleSearchInput);
    }

    elements.frequencyRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        state.filters.frequency = radio.value;
        persist();
        render();
      });
    });

    elements.categoryCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const selected = elements.categoryCheckboxes.filter((input) => input.checked).map((input) => input.value);
        state.filters.categories = selected;
        persist();
        render();
      });
    });

    document.querySelectorAll('.sort-button').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.getAttribute('data-sort');
        if (!key) return;
        if (state.sort.key === key) {
          state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sort.key = key;
          state.sort.dir = key === 'nextBilling' ? 'asc' : 'desc';
          if (key === 'name' || key === 'category') {
            state.sort.dir = 'asc';
          }
        }
        persist();
        render();
      });
    });

    if (elements.quickAddButton) {
      elements.quickAddButton.addEventListener('click', handleQuickAddToggle);
    }
    if (elements.quickAddMenu) {
      elements.quickAddMenu.addEventListener('click', handleQuickAddSelection);
    }

    if (elements.optimizeButton) {
      elements.optimizeButton.addEventListener('click', () => launchOptimize('primary'));
    }
    if (elements.miniOptimize) {
      elements.miniOptimize.addEventListener('click', () => launchOptimize('mini'));
    }
    if (elements.optimizePause) {
      elements.optimizePause.addEventListener('click', pauseOptimizeSelection);
    }
    if (elements.optimizeClear) {
      elements.optimizeClear.addEventListener('click', clearOptimizeSelection);
    }
    if (elements.optimizeList) {
      elements.optimizeList.addEventListener('click', handleOptimizeListClick);
    }

    if (elements.shortcutsModal) {
      elements.shortcutsModal.addEventListener('keydown', trapModalFocus);
      elements.shortcutsModal.querySelectorAll('[data-close-modal]').forEach((trigger) => {
        trigger.addEventListener('click', () => closeShortcutsModal());
      });
    }

    document.querySelectorAll('[data-open-shortcuts]').forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        openShortcutsModal();
      });
    });

    if (elements.suggestionsList) {
      elements.suggestionsList.addEventListener('click', handleSuggestionAction);
    }

    document.addEventListener('click', handleDocumentClick, true);
    document.addEventListener('keydown', handleGlobalKeydown);
  }

  function handleSearchInput(event) {
    const value = event.target.value;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.filters.query = value.trim();
      persist();
      render();
    }, 150);
  }

  function handleCurrencyChange(event) {
    const next = event.target.value;
    if (!FX[next] || next === state.currency) {
      elements.currencySelect.value = state.currency;
      return;
    }
    state.currency = next;
    persist();
    syncCurrencyControls();
    closeQuickAddPopover();
    render();
    toast(`Currency switched to ${next}.`);
  }

  function buildQuickAddPopover() {
    if (quickAddPopover) return quickAddPopover;
    if (elements.quickAddMenu) {
      quickAddPopover = elements.quickAddMenu;
      return quickAddPopover;
    }
    if (!elements.quickAddButton) return null;
    const container = document.createElement('div');
    container.className = 'quick-add-popover';
    container.id = 'quickAddMenu';
    container.setAttribute('role', 'menu');
    container.setAttribute('aria-hidden', 'true');
    const list = document.createElement('ul');
    list.className = 'quick-add-list';
    QUICK_ADD_ITEMS.forEach((item) => {
      const listItem = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quick-add-item';
      button.dataset.quickAdd = JSON.stringify(item);
      button.textContent = `${item.name} · ${formatMoney(monthlyCost(item), state.currency)}`;
      listItem.appendChild(button);
      list.appendChild(listItem);
    });
    container.appendChild(list);
    document.body.appendChild(container);
    quickAddPopover = container;
    return quickAddPopover;
  }

  function handleQuickAddToggle(event) {
    event.preventDefault();
    const popover = buildQuickAddPopover();
    if (!popover) return;
    const alreadyOpen = quickAddOpen;
    closeQuickAddPopover();
    if (!alreadyOpen) {
      openQuickAddPopover(popover);
    }
  }

  function openQuickAddPopover(popover) {
    if (!elements.quickAddButton) return;
    const rect = elements.quickAddButton.getBoundingClientRect();
    popover.style.position = 'absolute';
    popover.style.top = `${rect.bottom + window.scrollY + 8}px`;
    popover.style.left = `${rect.left + window.scrollX}px`;
    popover.dataset.open = 'true';
    popover.setAttribute('aria-hidden', 'false');
    elements.quickAddButton.setAttribute('aria-expanded', 'true');
    quickAddOpen = true;
    quickAddPopover = popover;
  }

  function closeQuickAddPopover() {
    if (!quickAddPopover) return;
    quickAddPopover.dataset.open = 'false';
    quickAddPopover.setAttribute('aria-hidden', 'true');
    if (elements.quickAddButton) {
      elements.quickAddButton.setAttribute('aria-expanded', 'false');
    }
    quickAddOpen = false;
  }

  function handleQuickAddSelection(event) {
    const target = event.target.closest('[data-quick-add]');
    if (!target) return;
    event.preventDefault();
    const payload = target.dataset.quickAdd;
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload);
      applyQuickAddItem(parsed);
    } catch (error) {
      console.warn('Failed to parse quick add item', error);
    }
  }

  function applyQuickAddItem(item) {
    if (!elements.form || !item) return;
    if (elements.name) {
      elements.name.value = item.name || '';
    }
    if (elements.category && item.category) {
      elements.category.value = item.category;
    }
    if (elements.frequencyMonthly && elements.frequencyYearly) {
      const isYearly = item.frequency === 'yearly';
      elements.frequencyMonthly.checked = !isYearly;
      elements.frequencyYearly.checked = isYearly;
    }
    if (elements.price && typeof item.price === 'number') {
      const converted = toCurrency(item.price, state.currency);
      elements.price.value = converted.toFixed(2);
    }
    if (elements.notes && item.notes) {
      elements.notes.value = item.notes;
    }
    closeQuickAddPopover();
    if (elements.price) {
      elements.price.focus();
    }
    toast(`${item.name} details loaded.`);
  }

  function handleDocumentClick(event) {
    if (quickAddOpen && quickAddPopover) {
      const withinPopover = quickAddPopover.contains(event.target);
      const isTrigger = elements.quickAddButton && elements.quickAddButton.contains(event.target);
      if (!withinPopover && !isTrigger) {
        closeQuickAddPopover();
      }
    }
  }

  function toggleShortcutsModal() {
    if (!elements.shortcutsModal) return;
    if (isShortcutsOpen()) {
      closeShortcutsModal();
    } else {
      openShortcutsModal();
    }
  }

  function isShortcutsOpen() {
    return Boolean(elements.shortcutsModal && elements.shortcutsModal.hasAttribute('open'));
  }

  function openShortcutsModal() {
    if (!elements.shortcutsModal) return;
    lastShortcutTrigger = document.activeElement;
    elements.shortcutsModal.setAttribute('open', '');
    focusFirstShortcutControl();
  }

  function focusFirstShortcutControl() {
    const focusable = getShortcutFocusable();
    if (focusable.length) {
      focusable[0].focus();
    }
  }

  function closeShortcutsModal() {
    if (!elements.shortcutsModal) return;
    elements.shortcutsModal.removeAttribute('open');
    if (lastShortcutTrigger && typeof lastShortcutTrigger.focus === 'function') {
      lastShortcutTrigger.focus();
    }
    lastShortcutTrigger = null;
  }

  function getShortcutFocusable() {
    if (!elements.shortcutsModal) return [];
    return Array.from(elements.shortcutsModal.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((node) => !node.hasAttribute('hidden') && !node.closest('[aria-hidden="true"]'));
  }

  function trapModalFocus(event) {
    if (event.key !== 'Tab') return;
    const focusable = getShortcutFocusable();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleGlobalKeydown(event) {
    const key = event.key;
    const activeElement = document.activeElement;
    const tag = activeElement ? activeElement.tagName : '';
    const isTypingField = tag === 'INPUT' || tag === 'TEXTAREA' || activeElement?.isContentEditable;
    const hasModifier = event.metaKey || event.ctrlKey || event.altKey;

    if (key === 'Escape') {
      if (editingId) {
        event.preventDefault();
        cancelEdit();
        return;
      }
      if (quickAddOpen) {
        closeQuickAddPopover();
        return;
      }
      if (isShortcutsOpen()) {
        event.preventDefault();
        closeShortcutsModal();
        return;
      }
    }

    if ((isTypingField && key !== 'Escape') || hasModifier) {
      return;
    }

    if (key === '/' && !event.shiftKey) {
      if (elements.search) {
        event.preventDefault();
        elements.search.focus();
      }
      return;
    }

    if (key === 'n' || key === 'N') {
      if (elements.name) {
        event.preventDefault();
        elements.name.focus();
      }
      return;
    }

    if (key === 'e' || key === 'E') {
      event.preventDefault();
      exportCsv();
      return;
    }

    if (key === '?' || (key === '/' && event.shiftKey)) {
      event.preventDefault();
      toggleShortcutsModal();
    }
  }

  function handleAdd(event) {
    event.preventDefault();
    const name = elements.name.value.trim();
    const category = elements.category.value;
    const frequency = elements.frequencyYearly.checked ? 'yearly' : 'monthly';
    const priceRaw = elements.price.value;
    const priceValue = Number.parseFloat(priceRaw);
    const nextBilling = elements.nextBilling.value;
    const notes = elements.notes.value.trim();

    elements.priceError.textContent = '';
    elements.price.setCustomValidity('');

    if (!name || !category) {
      elements.form.reportValidity();
      return;
    }

    if (priceRaw === '' || Number.isNaN(priceValue) || priceValue < 0) {
      elements.priceError.textContent = 'Price must be zero or higher.';
      elements.price.setCustomValidity('Invalid price');
      elements.price.focus();
      return;
    }

    const priceUSD = fromCurrency(priceValue, state.currency);

    const newRow = {
      id: createId(),
      name,
      category,
      frequency,
      price: priceUSD,
      nextBilling: nextBilling || '',
      notes,
      included: true
    };

    state.rows.push(newRow);
    persist();
    elements.form.reset();
    elements.frequencyMonthly.checked = true;
    render();
    elements.name.focus();
    toast(`${name} added to tracker.`);
  }

  function monthlyCost(row) {
    return row.frequency === 'monthly' ? row.price : row.price / 12;
  }

  function yearlyCost(row) {
    return row.frequency === 'monthly' ? row.price * 12 : row.price;
  }

  function formatCurrency(value) {
    const amount = Number.isFinite(value) ? value : 0;
    return formatMoney(amount, state.currency);
  }

  function formatFrequency(frequency) {
    return frequency === 'yearly' ? 'Yearly' : 'Monthly';
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }

  function applyFilters(rows) {
    const query = state.filters.query.toLowerCase();
    const categories = state.filters.categories;
    const frequency = state.filters.frequency;
    return rows.filter((row) => {
      const matchesQuery = query ? (row.name.toLowerCase().includes(query) || row.category.toLowerCase().includes(query)) : true;
      const matchesCategory = categories.length ? categories.includes(row.category) : true;
      const matchesFrequency = frequency === 'all' ? true : row.frequency === frequency;
      return matchesQuery && matchesCategory && matchesFrequency;
    });
  }

  function sortRows(rows) {
    const { key, dir } = state.sort;
    const multiplier = dir === 'asc' ? 1 : -1;
    const sorted = [...rows].sort((a, b) => {
      switch (key) {
        case 'name':
        case 'category': {
          return a[key].localeCompare(b[key]) * multiplier;
        }
        case 'monthly': {
          return (monthlyCost(a) - monthlyCost(b)) * multiplier;
        }
        case 'yearly': {
          return (yearlyCost(a) - yearlyCost(b)) * multiplier;
        }
        case 'nextBilling': {
          const fallback = dir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
          const aTime = a.nextBilling ? new Date(a.nextBilling).getTime() : fallback;
          const bTime = b.nextBilling ? new Date(b.nextBilling).getTime() : fallback;
          if (aTime === bTime) return 0;
          return (aTime - bTime) * multiplier;
        }
        default:
          return 0;
      }
    });
    return sorted;
  }

  function render() {
    const baseline = sortRows(applyFilters(state.rows));
    let displayRows = optimizeState.active ? getOptimizeRows() : baseline;
    if (!optimizeState.active) {
      displayRows = baseline;
    }
    updateSortIndicators();
    renderTable(displayRows);
    renderMobileCards(displayRows);
    updateSummary(displayRows, baseline);
    updateMiniSummary();
    updateTableMeta(displayRows);
    updateChart(displayRows);
    updateEmptyStates(displayRows, baseline);
    renderSuggestions();
    renderOptimizePanel();
    if (elements.miniOptimize) {
      elements.miniOptimize.setAttribute('aria-pressed', optimizeState.active ? 'true' : 'false');
    }
    if (elements.optimizeButton) {
      elements.optimizeButton.setAttribute('aria-pressed', optimizeState.active ? 'true' : 'false');
    }
    queueFocusWork();
  }

  function queueFocusWork() {
    window.requestAnimationFrame(() => {
      if (editingId) {
        focusFirstEditable();
      } else {
        lastFocusedEditField = null;
        restorePendingFocus();
      }
    });
  }

  function focusFirstEditable() {
    const container = document.querySelector('[data-editing="true"]');
    if (!container) return;
    const focusTarget = container.querySelector('[data-focus-initial]') || container.querySelector('input, select, textarea');
    if (focusTarget && focusTarget !== lastFocusedEditField) {
      focusTarget.focus({ preventScroll: true });
      if (typeof focusTarget.select === 'function') {
        focusTarget.select();
      }
      lastFocusedEditField = focusTarget;
    }
  }

  function restorePendingFocus() {
    if (!pendingFocus) return;
    if (pendingFocus.id && pendingFocus.action) {
      const selector = `[data-row-id="${pendingFocus.id}"][data-action="${pendingFocus.action}"]`;
      const node = document.querySelector(selector);
      if (node) {
        node.focus({ preventScroll: true });
        pendingFocus = null;
        return;
      }
    }
    if (pendingFocus.fallback && typeof pendingFocus.fallback.focus === 'function') {
      pendingFocus.fallback.focus({ preventScroll: true });
    }
    pendingFocus = null;
  }

  function updateSortIndicators() {
    document.querySelectorAll('.sort-button').forEach((button) => {
      const key = button.getAttribute('data-sort');
      const th = button.closest('th');
      if (state.sort.key === key) {
        button.setAttribute('data-direction', state.sort.dir);
        if (th) {
          th.setAttribute('aria-sort', state.sort.dir === 'asc' ? 'ascending' : 'descending');
        }
      } else {
        button.removeAttribute('data-direction');
        if (th) {
          th.setAttribute('aria-sort', 'none');
        }
      }
    });
  }

  function renderTable(rows) {
    const tbody = elements.tableBody;
    if (!tbody) return;
    const existingRows = new Map(Array.from(tbody.children).map((rowEl) => [rowEl.dataset.id, rowEl]));
    const fragment = document.createDocumentFragment();

    rows.forEach((row) => {
      const tr = existingRows.get(row.id) || document.createElement('tr');
      tr.dataset.id = row.id;
      tr.dataset.included = String(row.included);
      tr.dataset.optimizeSelected = optimizeState.selected.has(row.id) ? 'true' : 'false';
      if (editingId === row.id) {
        tr.dataset.editing = 'true';
        tr.replaceChildren();
        renderEditingRow(row, tr);
      } else {
        tr.removeAttribute('data-editing');
        tr.replaceChildren();
        renderDisplayRow(row, tr);
      }
      fragment.appendChild(tr);
    });

    tbody.replaceChildren(fragment);
  }

  function renderDisplayRow(row, tr) {
    const includeCell = document.createElement('td');
    includeCell.className = 'col-include';
    const includeCheckbox = createIncludeCheckbox(row);
    includeCell.appendChild(includeCheckbox);
    const includeLabel = document.createElement('label');
    includeLabel.className = 'sr-only';
    includeLabel.setAttribute('for', includeCheckbox.id);
    includeLabel.textContent = `Include ${row.name} in totals`;
    includeCell.appendChild(includeLabel);
    tr.appendChild(includeCell);

    const nameCell = document.createElement('td');
    nameCell.className = 'cell-name';
    const nameText = document.createElement('span');
    nameText.className = 'subscription-name';
    nameText.textContent = row.name;
    nameCell.appendChild(nameText);
    if (row.notes) {
      const notes = document.createElement('p');
      notes.className = 'subscription-notes';
      notes.textContent = row.notes;
      nameCell.appendChild(notes);
    }
    tr.appendChild(nameCell);

    const categoryCell = document.createElement('td');
    categoryCell.textContent = row.category;
    tr.appendChild(categoryCell);

    const frequencyCell = document.createElement('td');
    frequencyCell.textContent = formatFrequency(row.frequency);
    tr.appendChild(frequencyCell);

    const priceCell = document.createElement('td');
    priceCell.className = 'numeric';
    priceCell.textContent = formatCurrency(row.price);
    tr.appendChild(priceCell);

    const monthlyCell = document.createElement('td');
    monthlyCell.className = 'numeric';
    monthlyCell.textContent = formatCurrency(monthlyCost(row));
    tr.appendChild(monthlyCell);

    const yearlyCell = document.createElement('td');
    yearlyCell.className = 'numeric';
    yearlyCell.textContent = formatCurrency(yearlyCost(row));
    tr.appendChild(yearlyCell);

    const nextBillingCell = document.createElement('td');
    nextBillingCell.textContent = formatDate(row.nextBilling);
    tr.appendChild(nextBillingCell);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'col-actions';
    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.setAttribute('aria-label', `Edit ${row.name}`);
    editButton.dataset.action = 'edit';
    editButton.dataset.rowId = row.id;
    editButton.addEventListener('click', () => {
      editingId = row.id;
      editDraft = { ...row, priceEmpty: false };
      editingTrigger = { id: row.id, action: 'edit' };
      render();
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', `Delete ${row.name}`);
    deleteButton.dataset.action = 'delete';
    deleteButton.dataset.rowId = row.id;
    deleteButton.addEventListener('click', () => {
      const confirmed = window.confirm(`Delete ${row.name}?`);
      if (!confirmed) return;
      state.rows = state.rows.filter((item) => item.id !== row.id);
      persist();
      if (editingId === row.id) {
        editingId = null;
        editDraft = null;
      }
      pendingFocus = { fallback: elements.search };
      render();
    });

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    actionsCell.appendChild(actions);
    tr.appendChild(actionsCell);
  }

  function renderEditingRow(row, tr) {
    if (!editDraft || editDraft.id !== row.id) {
      editDraft = { ...row, priceEmpty: false };
    } else if (typeof editDraft.priceEmpty !== 'boolean') {
      editDraft.priceEmpty = false;
    }

    const includeCell = document.createElement('td');
    includeCell.className = 'col-include';
    const includeCheckbox = createIncludeCheckbox(row);
    includeCell.appendChild(includeCheckbox);
    const includeLabel = document.createElement('label');
    includeLabel.className = 'sr-only';
    includeLabel.setAttribute('for', includeCheckbox.id);
    includeLabel.textContent = `Include ${row.name} in totals`;
    includeCell.appendChild(includeLabel);
    tr.appendChild(includeCell);

    const nameCell = document.createElement('td');
    nameCell.className = 'cell-name edit-cell';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = editDraft.name;
    nameInput.placeholder = 'Subscription name';
    nameInput.setAttribute('aria-label', 'Subscription name');
    nameInput.dataset.focusInitial = 'true';
    nameInput.addEventListener('input', (event) => {
      editDraft.name = event.target.value;
    });
    addEditFieldKeyboard(nameInput);
    nameCell.appendChild(nameInput);

    const notesArea = document.createElement('textarea');
    notesArea.rows = 2;
    notesArea.value = editDraft.notes || '';
    notesArea.placeholder = 'Notes (optional)';
    notesArea.setAttribute('aria-label', 'Notes');
    notesArea.addEventListener('input', (event) => {
      editDraft.notes = event.target.value;
    });
    nameCell.appendChild(notesArea);
    tr.appendChild(nameCell);

    const categoryCell = document.createElement('td');
    categoryCell.className = 'edit-cell';
    const categorySelect = document.createElement('select');
    ['Streaming', 'Music', 'Gaming', 'Productivity', 'Phone', 'Internet', 'Fitness', 'Other'].forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      if (value === editDraft.category) {
        option.selected = true;
      }
      categorySelect.appendChild(option);
    });
    categorySelect.setAttribute('aria-label', 'Category');
    categorySelect.addEventListener('change', (event) => {
      editDraft.category = event.target.value;
    });
    addEditFieldKeyboard(categorySelect);
    categoryCell.appendChild(categorySelect);
    tr.appendChild(categoryCell);

    const frequencyCell = document.createElement('td');
    frequencyCell.className = 'edit-cell';
    const frequencySelect = document.createElement('select');
    [['monthly', 'Monthly'], ['yearly', 'Yearly']].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      if (value === editDraft.frequency) option.selected = true;
      frequencySelect.appendChild(option);
    });
    frequencySelect.setAttribute('aria-label', 'Billing frequency');
    frequencySelect.addEventListener('change', (event) => {
      editDraft.frequency = event.target.value;
      monthlyValue.textContent = formatCurrency(monthlyCost(editDraft));
      yearlyValue.textContent = formatCurrency(yearlyCost(editDraft));
    });
    addEditFieldKeyboard(frequencySelect);
    frequencyCell.appendChild(frequencySelect);
    tr.appendChild(frequencyCell);

    const priceCell = document.createElement('td');
    priceCell.className = 'edit-cell numeric';
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.min = '0';
    priceInput.step = '0.01';
    priceInput.value = toCurrency(editDraft.price, state.currency);
    priceInput.setAttribute('aria-label', 'Price');
    priceInput.addEventListener('input', (event) => {
      const raw = event.target.value;
      const numeric = Number.parseFloat(raw);
      const isEmpty = raw === '';
      const isInvalid = Number.isNaN(numeric);
      editDraft.priceEmpty = isEmpty || isInvalid;
      editDraft.price = isEmpty || isInvalid ? 0 : fromCurrency(numeric, state.currency);
      monthlyValue.textContent = formatCurrency(monthlyCost(editDraft));
      yearlyValue.textContent = formatCurrency(yearlyCost(editDraft));
      showEditError('');
    });
    addEditFieldKeyboard(priceInput);
    priceCell.appendChild(priceInput);
    tr.appendChild(priceCell);

    const monthlyCell = document.createElement('td');
    monthlyCell.className = 'numeric';
    const monthlyValue = document.createElement('span');
    monthlyValue.textContent = formatCurrency(monthlyCost(editDraft));
    monthlyCell.appendChild(monthlyValue);
    tr.appendChild(monthlyCell);

    const yearlyCell = document.createElement('td');
    yearlyCell.className = 'numeric';
    const yearlyValue = document.createElement('span');
    yearlyValue.textContent = formatCurrency(yearlyCost(editDraft));
    yearlyCell.appendChild(yearlyValue);
    tr.appendChild(yearlyCell);

    const nextBillingCell = document.createElement('td');
    nextBillingCell.className = 'edit-cell';
    const nextBillingInput = document.createElement('input');
    nextBillingInput.type = 'date';
    nextBillingInput.value = editDraft.nextBilling || '';
    nextBillingInput.setAttribute('aria-label', 'Next billing date');
    nextBillingInput.addEventListener('change', (event) => {
      editDraft.nextBilling = event.target.value;
    });
    addEditFieldKeyboard(nextBillingInput);
    nextBillingCell.appendChild(nextBillingInput);
    tr.appendChild(nextBillingCell);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'col-actions';
    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = 'Save';
    saveButton.dataset.action = 'save';
    saveButton.addEventListener('click', () => saveEdit(row));

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    cancelButton.dataset.action = 'cancel';
    cancelButton.addEventListener('click', () => cancelEdit());

    const errorMessage = document.createElement('div');
    errorMessage.setAttribute('data-edit-error', '');
    errorMessage.className = 'edit-error';

    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);
    actionsCell.appendChild(actions);
    actionsCell.appendChild(errorMessage);
    tr.appendChild(actionsCell);
  }

  function addEditFieldKeyboard(node) {
    if (!node || node.tagName === 'TEXTAREA') return;
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const current = state.rows.find((item) => item.id === editingId);
        if (current) {
          saveEdit(current);
        }
      }
    });
  }

  function saveEdit(row) {
    if (!editDraft) return;
    const trimmedName = editDraft.name.trim();
    if (!trimmedName) {
      showEditError('Name is required.');
      return;
    }
    if (editDraft.priceEmpty || Number.isNaN(editDraft.price) || editDraft.price < 0) {
      showEditError('Price must be zero or higher.');
      return;
    }

    const target = state.rows.find((item) => item.id === row.id);
    if (!target) return;

    const nextBilling = editDraft.nextBilling ? editDraft.nextBilling : '';
    Object.assign(target, {
      name: trimmedName,
      category: editDraft.category,
      frequency: editDraft.frequency === 'yearly' ? 'yearly' : 'monthly',
      price: Number(editDraft.price),
      nextBilling,
      notes: editDraft.notes ? editDraft.notes.trim() : '',
      included: target.included
    });

    pendingFocus = editingTrigger || { id: row.id, action: 'edit' };
    editingTrigger = null;
    editingId = null;
    editDraft = null;
    showEditError('');
    persist();
    render();
  }

  function cancelEdit() {
    if (!editingId) return;
    pendingFocus = editingTrigger || { id: editingId, action: 'edit' };
    editingTrigger = null;
    editingId = null;
    editDraft = null;
    showEditError('');
    render();
  }

  function showEditError(message) {
    document.querySelectorAll('[data-edit-error]').forEach((node) => {
      node.textContent = message;
    });
  }

  function createIncludeCheckbox(row) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'include-checkbox';
    checkbox.checked = row.included;
    checkbox.id = `include-${row.id}`;
    checkbox.setAttribute('aria-describedby', 'tableDescription');
    checkbox.addEventListener('change', () => {
      updateIncludedState(row, checkbox.checked);
    });
    checkbox.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        checkbox.checked = !checkbox.checked;
        updateIncludedState(row, checkbox.checked);
      }
    });
    return checkbox;
  }

  function updateIncludedState(row, included) {
    row.included = included;
    persist();
    render();
    toast(`${row.name} ${included ? 'included in totals.' : 'paused from totals.'}`);
  }

  function renderMobileCards(rows) {
    const container = elements.mobileList;
    if (!container) return;
    container.replaceChildren();
    if (!rows.length) {
      container.hidden = true;
      container.setAttribute('aria-hidden', 'true');
      return;
    }
    container.hidden = false;
    container.removeAttribute('aria-hidden');

    rows.forEach((row) => {
      const card = document.createElement('article');
      card.className = 'subscription-card';
      card.dataset.id = row.id;
      card.dataset.included = String(row.included);
      card.dataset.optimizeSelected = optimizeState.selected.has(row.id) ? 'true' : 'false';

      if (editingId === row.id) {
        card.dataset.editing = 'true';
        renderMobileEditingCard(row, card);
      } else {
        card.removeAttribute('data-editing');
        renderMobileDisplayCard(row, card);
      }

      container.appendChild(card);
    });
  }

  function renderMobileDisplayCard(row, card) {
    const header = document.createElement('div');
    header.className = 'subscription-card__header';

    const includeCheckbox = createIncludeCheckbox(row);
    header.appendChild(includeCheckbox);
    const includeLabel = document.createElement('label');
    includeLabel.className = 'sr-only';
    includeLabel.setAttribute('for', includeCheckbox.id);
    includeLabel.textContent = `Include ${row.name} in totals`;
    header.appendChild(includeLabel);

    const name = document.createElement('div');
    name.className = 'subscription-name';
    name.textContent = row.name;
    header.appendChild(name);
    card.appendChild(header);

    if (row.notes) {
      const notes = document.createElement('p');
      notes.className = 'subscription-notes';
      notes.textContent = row.notes;
      card.appendChild(notes);
    }

    const meta = document.createElement('div');
    meta.className = 'subscription-card__meta';
    meta.innerHTML = `<span>${row.category}</span><span>${formatFrequency(row.frequency)}</span><span>Next: ${formatDate(row.nextBilling)}</span>`;
    card.appendChild(meta);

    const amounts = document.createElement('div');
    amounts.className = 'subscription-card__amounts';
    amounts.innerHTML = `<span>Price: ${formatCurrency(row.price)}</span><span>Monthly: ${formatCurrency(monthlyCost(row))}</span><span>Yearly: ${formatCurrency(yearlyCost(row))}</span>`;
    card.appendChild(amounts);

    const actions = document.createElement('div');
    actions.className = 'subscription-card__actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.setAttribute('aria-label', `Edit ${row.name}`);
    editButton.dataset.action = 'edit';
    editButton.dataset.rowId = row.id;
    editButton.addEventListener('click', () => {
      editingId = row.id;
      editDraft = { ...row, priceEmpty: false };
      editingTrigger = { id: row.id, action: 'edit' };
      render();
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', `Delete ${row.name}`);
    deleteButton.dataset.action = 'delete';
    deleteButton.dataset.rowId = row.id;
    deleteButton.addEventListener('click', () => {
      const confirmed = window.confirm(`Delete ${row.name}?`);
      if (!confirmed) return;
      state.rows = state.rows.filter((item) => item.id !== row.id);
      persist();
      if (editingId === row.id) {
        editingId = null;
        editDraft = null;
      }
      pendingFocus = { fallback: elements.search };
      render();
    });

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    card.appendChild(actions);
  }

  function renderMobileEditingCard(row, card) {
    if (!editDraft || editDraft.id !== row.id) {
      editDraft = { ...row, priceEmpty: false };
    } else if (typeof editDraft.priceEmpty !== 'boolean') {
      editDraft.priceEmpty = false;
    }

    const header = document.createElement('div');
    header.className = 'subscription-card__header';

    const includeCheckbox = createIncludeCheckbox(row);
    header.appendChild(includeCheckbox);
    const includeLabel = document.createElement('label');
    includeLabel.className = 'sr-only';
    includeLabel.setAttribute('for', includeCheckbox.id);
    includeLabel.textContent = `Include ${row.name} in totals`;
    header.appendChild(includeLabel);

    const nameField = document.createElement('div');
    nameField.className = 'edit-field';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = editDraft.name;
    nameInput.placeholder = 'Subscription name';
    nameInput.setAttribute('aria-label', 'Subscription name');
    nameInput.dataset.focusInitial = 'true';
    nameInput.addEventListener('input', (event) => {
      editDraft.name = event.target.value;
    });
    addEditFieldKeyboard(nameInput);
    nameField.appendChild(nameInput);
    header.appendChild(nameField);
    card.appendChild(header);

    const notesField = document.createElement('div');
    notesField.className = 'edit-field';
    const notesInput = document.createElement('textarea');
    notesInput.rows = 2;
    notesInput.value = editDraft.notes || '';
    notesInput.placeholder = 'Notes (optional)';
    notesInput.setAttribute('aria-label', 'Notes');
    notesInput.addEventListener('input', (event) => {
      editDraft.notes = event.target.value;
    });
    notesField.appendChild(notesInput);
    card.appendChild(notesField);

    const categoryField = document.createElement('div');
    categoryField.className = 'edit-field';
    const categorySelect = document.createElement('select');
    ['Streaming', 'Music', 'Gaming', 'Productivity', 'Phone', 'Internet', 'Fitness', 'Other'].forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      if (value === editDraft.category) option.selected = true;
      categorySelect.appendChild(option);
    });
    categorySelect.setAttribute('aria-label', 'Category');
    categorySelect.addEventListener('change', (event) => {
      editDraft.category = event.target.value;
    });
    addEditFieldKeyboard(categorySelect);
    categoryField.appendChild(categorySelect);
    card.appendChild(categoryField);

    const frequencyField = document.createElement('div');
    frequencyField.className = 'edit-field';
    const frequencySelect = document.createElement('select');
    [['monthly', 'Monthly'], ['yearly', 'Yearly']].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      if (value === editDraft.frequency) option.selected = true;
      frequencySelect.appendChild(option);
    });
    frequencySelect.setAttribute('aria-label', 'Billing frequency');
    frequencySelect.addEventListener('change', (event) => {
      editDraft.frequency = event.target.value;
      monthlyValue.textContent = `Monthly: ${formatCurrency(monthlyCost(editDraft))}`;
      yearlyValue.textContent = `Yearly: ${formatCurrency(yearlyCost(editDraft))}`;
    });
    addEditFieldKeyboard(frequencySelect);
    frequencyField.appendChild(frequencySelect);
    card.appendChild(frequencyField);

    const priceField = document.createElement('div');
    priceField.className = 'edit-field';
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.min = '0';
    priceInput.step = '0.01';
    priceInput.value = toCurrency(editDraft.price, state.currency);
    priceInput.setAttribute('aria-label', 'Price');
    priceInput.addEventListener('input', (event) => {
      const raw = event.target.value;
      const numeric = Number.parseFloat(raw);
      const isEmpty = raw === '';
      const isInvalid = Number.isNaN(numeric);
      editDraft.priceEmpty = isEmpty || isInvalid;
      editDraft.price = isEmpty || isInvalid ? 0 : fromCurrency(numeric, state.currency);
      monthlyValue.textContent = `Monthly: ${formatCurrency(monthlyCost(editDraft))}`;
      yearlyValue.textContent = `Yearly: ${formatCurrency(yearlyCost(editDraft))}`;
      showEditError('');
    });
    addEditFieldKeyboard(priceInput);
    priceField.appendChild(priceInput);
    card.appendChild(priceField);

    const amounts = document.createElement('div');
    amounts.className = 'subscription-card__amounts';
    const monthlyValue = document.createElement('span');
    monthlyValue.textContent = `Monthly: ${formatCurrency(monthlyCost(editDraft))}`;
    const yearlyValue = document.createElement('span');
    yearlyValue.textContent = `Yearly: ${formatCurrency(yearlyCost(editDraft))}`;
    amounts.appendChild(monthlyValue);
    amounts.appendChild(yearlyValue);
    card.appendChild(amounts);

    const nextBillingField = document.createElement('div');
    nextBillingField.className = 'edit-field';
    const nextBillingInput = document.createElement('input');
    nextBillingInput.type = 'date';
    nextBillingInput.value = editDraft.nextBilling || '';
    nextBillingInput.setAttribute('aria-label', 'Next billing date');
    nextBillingInput.addEventListener('change', (event) => {
      editDraft.nextBilling = event.target.value;
    });
    addEditFieldKeyboard(nextBillingInput);
    nextBillingField.appendChild(nextBillingInput);
    card.appendChild(nextBillingField);

    const actions = document.createElement('div');
    actions.className = 'subscription-card__actions';
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = 'Save';
    saveButton.addEventListener('click', () => saveEdit(row));
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => cancelEdit());
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);
    card.appendChild(actions);

    const errorMessage = document.createElement('div');
    errorMessage.setAttribute('data-edit-error', '');
    errorMessage.className = 'edit-error';
    card.appendChild(errorMessage);
  }

  function updateSummary(displayRows, baselineRows) {
    const includedAll = state.rows.filter((row) => row.included);
    const includedDisplay = displayRows.filter((row) => row.included);
    const includedBaseline = baselineRows.filter((row) => row.included);
    const excludedAll = state.rows.filter((row) => !row.included);
    const excludedDisplay = displayRows.filter((row) => !row.included);

    const totalMonthlyAll = sumBy(includedAll, monthlyCost);
    const totalMonthlyDisplay = sumBy(includedDisplay, monthlyCost);
    const totalMonthlyBaseline = sumBy(includedBaseline, monthlyCost);
    const totalYearlyAll = sumBy(includedAll, yearlyCost);
    const totalYearlyDisplay = sumBy(includedDisplay, yearlyCost);
    const totalYearlyBaseline = sumBy(includedBaseline, yearlyCost);
    const savingsAll = sumBy(excludedAll, monthlyCost);
    const savingsDisplay = sumBy(excludedDisplay, monthlyCost);

    currentTotals = {
      monthlyUSD: totalMonthlyDisplay,
      yearlyUSD: totalYearlyDisplay,
      savingsUSD: savingsAll
    };

    elements.totalMonthly.textContent = formatCurrency(totalMonthlyDisplay);
    elements.totalYearly.textContent = formatCurrency(totalYearlyDisplay);
    elements.potentialSavings.textContent = formatCurrency(savingsAll);

    updateDeltaCopy(elements.monthlyDelta, totalMonthlyDisplay, totalMonthlyBaseline, totalMonthlyAll);
    updateDeltaCopy(elements.yearlyDelta, totalYearlyDisplay, totalYearlyBaseline, totalYearlyAll);
    updateSavingsHelper(elements.savingsHelper, savingsDisplay, savingsAll);
  }

  function sumBy(list, fn) {
    return list.reduce((total, item) => total + fn(item), 0);
  }

  function updateDeltaCopy(node, displayValue, baselineValue, allValue) {
    if (!node) return;
    const diff = displayValue - baselineValue;
    if (Math.abs(diff) < 0.01) {
      node.textContent = 'Showing all included subscriptions.';
      return;
    }
    if (diff < 0) {
      node.textContent = `Filtered view hides ${formatCurrency(Math.abs(diff))} each cycle.`;
      return;
    }
    node.textContent = `Filtered view adds ${formatCurrency(diff)} compared to all data.`;
  }

  function updateSavingsHelper(node, displayValue, allValue) {
    if (!node) return;
    if (allValue <= 0.009) {
      node.textContent = 'All tracked subscriptions are currently included in totals.';
      return;
    }
    if (Math.abs(displayValue - allValue) < 0.01) {
      node.textContent = 'Potential savings from excluded subscriptions (all categories).';
      return;
    }
    node.textContent = `Filters cover ${formatCurrency(displayValue)} of ${formatCurrency(allValue)} monthly savings opportunities.`;
  }

  function updateMiniSummary() {
    if (!elements.miniSummary) return;
    const hasRows = state.rows.length > 0;
    if (!hasRows) {
      elements.miniSummary.setAttribute('hidden', '');
      elements.miniSummary.setAttribute('aria-hidden', 'true');
      elements.miniSummary.hidden = true;
      return;
    }
    elements.miniSummary.removeAttribute('hidden');
    elements.miniSummary.setAttribute('aria-hidden', 'false');
    elements.miniSummary.hidden = false;
    if (elements.miniMonthly) {
      elements.miniMonthly.textContent = formatCurrency(currentTotals.monthlyUSD);
    }
    if (elements.miniYearly) {
      elements.miniYearly.textContent = formatCurrency(currentTotals.yearlyUSD);
    }
    if (elements.miniSavings) {
      elements.miniSavings.textContent = formatCurrency(currentTotals.savingsUSD);
    }
  }

  function getOptimizeRows() {
    if (!optimizeState.active || !optimizeState.selected.size) {
      return [];
    }
    const rows = state.rows.filter((row) => optimizeState.selected.has(row.id));
    if (!rows.length) {
      optimizeState.selected.clear();
      optimizeState.active = false;
      return [];
    }
    return rows.sort((a, b) => monthlyCost(b) - monthlyCost(a));
  }

  function renderOptimizePanel() {
    if (!elements.optimizePanel) return;
    const rows = getOptimizeRows();
    if (!optimizeState.active || !rows.length) {
      elements.optimizePanel.setAttribute('hidden', '');
      elements.optimizePanel.setAttribute('aria-hidden', 'true');
      elements.optimizePanel.hidden = true;
      if (elements.optimizeList) {
        elements.optimizeList.replaceChildren();
      }
      if (elements.optimizePause) {
        elements.optimizePause.disabled = true;
      }
      if (elements.optimizeClear) {
        elements.optimizeClear.disabled = !optimizeState.active;
      }
      return;
    }

    elements.optimizePanel.removeAttribute('hidden');
    elements.optimizePanel.setAttribute('aria-hidden', 'false');
    elements.optimizePanel.hidden = false;
    if (elements.optimizePause) {
      elements.optimizePause.disabled = optimizeState.selected.size === 0;
    }
    if (elements.optimizeClear) {
      elements.optimizeClear.disabled = false;
    }

    if (elements.optimizeList) {
      const fragment = document.createDocumentFragment();
      rows.forEach((row) => {
        const item = document.createElement('li');
        item.className = 'optimize-list__item';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'optimize-toggle';
        button.dataset.optimizeId = row.id;
        const isSelected = optimizeState.selected.has(row.id);
        button.setAttribute('aria-pressed', String(isSelected));
        button.setAttribute('aria-label', `${isSelected ? 'Deselect' : 'Select'} ${row.name} for optimization`);
        const reasons = optimizeState.reasons.get(row.id);
        const reasonSet = reasons instanceof Set ? reasons : new Set(reasons || []);
        const reasonLabel = Array.from(reasonSet).map((reason) => OPTIMIZE_REASON_COPY[reason] || reason).join(' · ');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'optimize-toggle__name';
        nameSpan.textContent = row.name;
        button.appendChild(nameSpan);

        const metaSpan = document.createElement('span');
        metaSpan.className = 'optimize-toggle__meta';
        metaSpan.textContent = row.category;
        button.appendChild(metaSpan);

        const costSpan = document.createElement('span');
        costSpan.className = 'optimize-toggle__cost';
        costSpan.textContent = formatCurrency(monthlyCost(row));
        button.appendChild(costSpan);

        const reasonSpan = document.createElement('span');
        reasonSpan.className = 'optimize-toggle__reason';
        reasonSpan.textContent = reasonLabel;
        if (!reasonLabel) {
          reasonSpan.hidden = true;
          reasonSpan.setAttribute('aria-hidden', 'true');
        }
        button.appendChild(reasonSpan);

        item.appendChild(button);
        fragment.appendChild(item);
      });
      elements.optimizeList.replaceChildren(fragment);
    }
  }

  function launchOptimize(source = 'primary') {
    if (!state.rows.length) {
      toast('Add subscriptions before optimizing.');
      return;
    }

    const sortedByMonthly = [...state.rows].sort((a, b) => monthlyCost(b) - monthlyCost(a));
    const topExpensive = sortedByMonthly.slice(0, SUGGESTION_LIMIT);
    const included = state.rows.filter((row) => row.included);
    const duplicates = findDuplicateCategories(included);

    const reasons = new Map();
    const selected = new Set();

    topExpensive.forEach((row) => {
      selected.add(row.id);
      reasons.set(row.id, new Set(['expensive']));
    });

    duplicates.forEach((row) => {
      if (!selected.has(row.id)) {
        selected.add(row.id);
        reasons.set(row.id, new Set(['duplicate']));
      } else {
        const existing = reasons.get(row.id) || new Set();
        existing.add('duplicate');
        reasons.set(row.id, existing);
      }
    });

    if (!selected.size) {
      toast('No optimization suggestions yet.');
      return;
    }

    optimizeState = { active: true, selected, reasons };
    render();
    if (source === 'mini') {
      toast('Optimization suggestions ready below.');
    } else {
      toast('Optimization view showing your top opportunities.');
    }
  }

  function renderSuggestions() {
    if (!elements.suggestionsList) return;
    const suggestions = computeSuggestions(state.rows);
    const fragment = document.createDocumentFragment();
    if (!suggestions.length) {
      const emptyTag = elements.suggestionsList.tagName === 'UL' ? 'li' : 'p';
      const empty = document.createElement(emptyTag);
      empty.className = 'suggestions-empty';
      empty.textContent = 'No smart suggestions yet. Add more details or subscriptions to see quick wins.';
      elements.suggestionsList.replaceChildren(empty);
      return;
    }
    suggestions.forEach(({ row, reasons }) => {
      const item = document.createElement('li');
      item.className = 'suggestion-item';
      const header = document.createElement('div');
      header.className = 'suggestion-item__header';
      const name = document.createElement('span');
      name.className = 'suggestion-item__name';
      name.textContent = row.name;
      const cost = document.createElement('span');
      cost.className = 'suggestion-item__cost';
      cost.textContent = formatCurrency(monthlyCost(row));
      header.appendChild(name);
      header.appendChild(cost);
      item.appendChild(header);

      const reason = document.createElement('p');
      reason.className = 'suggestion-item__reason';
      reason.textContent = reasons
        .map((reasonKey) => SUGGESTION_REASON_COPY[reasonKey] || reasonKey)
        .join(' · ');
      item.appendChild(reason);

      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'suggestion-item__action';
      action.dataset.suggestionId = row.id;
      const willPause = row.included;
      action.textContent = willPause ? 'Mark to pause' : 'Resume';
      action.setAttribute('aria-pressed', String(!row.included));
      action.setAttribute('aria-label', willPause ? `Pause ${row.name}` : `Resume ${row.name}`);
      item.appendChild(action);

      fragment.appendChild(item);
    });
    elements.suggestionsList.replaceChildren(fragment);
  }

  function computeSuggestions(rows) {
    const suggestions = new Map();
    const included = rows.filter((row) => row.included);

    const highCost = [...included].sort((a, b) => monthlyCost(b) - monthlyCost(a)).slice(0, SUGGESTION_LIMIT);
    highCost.forEach((row) => {
      const entry = suggestions.get(row.id) || { row, reasons: new Set() };
      entry.reasons.add('expensive');
      suggestions.set(row.id, entry);
    });

    const duplicates = findDuplicateCategories(state.rows.filter((row) => row.included));
    duplicates.forEach((row) => {
      const entry = suggestions.get(row.id) || { row, reasons: new Set() };
      entry.reasons.add('duplicate');
      suggestions.set(row.id, entry);
    });

    rows.forEach((row) => {
      if (!row.included || !row.notes) return;
      const notes = row.notes.toLowerCase();
      if (notes.includes('trial') || notes.includes('rarely')) {
        const entry = suggestions.get(row.id) || { row, reasons: new Set() };
        entry.reasons.add('unused');
        suggestions.set(row.id, entry);
      }
    });

    return Array.from(suggestions.values())
      .map(({ row, reasons }) => ({ row, reasons: Array.from(reasons) }))
      .sort((a, b) => monthlyCost(b.row) - monthlyCost(a.row))
      .slice(0, 6);
  }

  function handleSuggestionAction(event) {
    const button = event.target.closest('[data-suggestion-id]');
    if (!button) return;
    event.preventDefault();
    const id = button.dataset.suggestionId;
    const row = state.rows.find((item) => item.id === id);
    if (!row) return;
    row.included = !row.included;
    persist();
    render();
    toast(row.included ? `${row.name} added back to totals.` : `${row.name} marked to pause.`);
  }

  function findDuplicateCategories(sourceRows = state.rows) {
    const categories = new Map();
    sourceRows.forEach((row) => {
      const list = categories.get(row.category) || [];
      list.push(row);
      categories.set(row.category, list);
    });
    const duplicates = [];
    categories.forEach((rows) => {
      if (rows.length > 1) {
        const sorted = [...rows].sort((a, b) => monthlyCost(b) - monthlyCost(a));
        duplicates.push(sorted[0]);
      }
    });
    return duplicates;
  }

  function handleOptimizeListClick(event) {
    const button = event.target.closest('[data-optimize-id]');
    if (!button) return;
    const id = button.getAttribute('data-optimize-id');
    if (!id) return;
    if (optimizeState.selected.has(id)) {
      optimizeState.selected.delete(id);
    } else {
      optimizeState.selected.add(id);
      if (!optimizeState.reasons.has(id)) {
        optimizeState.reasons.set(id, new Set(['manual']));
      }
    }
    render();
  }

  function pauseOptimizeSelection() {
    if (!optimizeState.selected.size) {
      toast('Select subscriptions to pause first.');
      return;
    }
    let updated = 0;
    state.rows.forEach((row) => {
      if (optimizeState.selected.has(row.id) && row.included) {
        row.included = false;
        updated += 1;
      }
    });
    if (updated) {
      persist();
      toast(`Paused ${updated} subscription${updated === 1 ? '' : 's'}.`);
    } else {
      toast('Selected subscriptions are already paused.');
    }
    optimizeState.active = false;
    optimizeState.selected.clear();
    render();
  }

  function clearOptimizeSelection() {
    if (!optimizeState.active) return;
    optimizeState.active = false;
    optimizeState.selected.clear();
    render();
    toast('Cleared optimization view.');
  }

  function updateTableMeta(rows) {
    if (!elements.tableCount) return;
    const total = rows.length;
    const label = total === 1 ? 'subscription' : 'subscriptions';
    elements.tableCount.textContent = `${total} ${label}`;
  }

  function updateChart(rows) {
    if (!elements.chartCanvas || !window.Chart) return;
    const included = rows.filter((row) => row.included);
    if (!included.length) {
      elements.chartEmpty.hidden = false;
      elements.chartEmpty.setAttribute('aria-hidden', 'false');
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      return;
    }
    elements.chartEmpty.hidden = true;
    elements.chartEmpty.setAttribute('aria-hidden', 'true');

    const dataByCategory = included.reduce((accumulator, row) => {
      const monthly = monthlyCost(row);
      accumulator[row.category] = (accumulator[row.category] || 0) + monthly;
      return accumulator;
    }, {});

    const sortedEntries = Object.entries(dataByCategory).sort((a, b) => b[1] - a[1]);
    const labels = sortedEntries.map(([label]) => label);
    const data = sortedEntries.map(([, value]) => Number(value.toFixed(2)));
    const total = data.reduce((sum, value) => sum + value, 0);

    if (!total) {
      elements.chartEmpty.hidden = false;
      elements.chartEmpty.setAttribute('aria-hidden', 'false');
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      return;
    }

    const colors = ['#0ea5e9', '#a855f7', '#f97316', '#22c55e', '#facc15', '#ec4899', '#14b8a6', '#6366f1'];
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (chartInstance) {
      chartInstance.data.labels = labels;
      chartInstance.data.datasets[0].data = data;
      chartInstance.data.datasets[0].backgroundColor = labels.map((_, index) => colors[index % colors.length]);
      chartInstance.update();
      return;
    }

    chartInstance = new window.Chart(elements.chartCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: labels.map((_, index) => colors[index % colors.length]),
            borderColor: '#ffffff',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 8 },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 16,
              boxHeight: 16,
              usePointStyle: true,
              color: '#0f172a'
            }
          },
          tooltip: {
            callbacks: {
              label(context) {
                const label = context.label || '';
                const value = Number(context.parsed) || 0;
                const dataset = context.chart.data.datasets?.[context.datasetIndex];
                const sum = Array.isArray(dataset?.data)
                  ? dataset.data.reduce((accumulator, entry) => accumulator + (Number(entry) || 0), 0)
                  : 0;
                const percent = sum ? ((value / sum) * 100).toFixed(1) : '0.0';
                return `${label}: ${formatCurrency(value)} (${percent}% of monthly)`;
              }
            }
          }
        },
        animation: {
          duration: reduceMotion ? 0 : 500
        }
      }
    });
  }

  function updateEmptyStates(displayRows, baselineRows) {
    if (!elements.tableEmpty || !elements.noMatches) return;
    const hasRows = state.rows.length > 0;
    elements.tableEmpty.hidden = hasRows;
    elements.tableEmpty.setAttribute('aria-hidden', hasRows ? 'true' : 'false');
    const hasDisplay = displayRows.length > 0;
    const hasBaseline = baselineRows.length > 0;
    const showNoMatches = !hasDisplay && hasBaseline;
    elements.noMatches.hidden = !showNoMatches;
    elements.noMatches.setAttribute('aria-hidden', showNoMatches ? 'false' : 'true');
    if (!hasDisplay && elements.mobileList) {
      elements.mobileList.hidden = true;
      elements.mobileList.setAttribute('aria-hidden', 'true');
    }
  }

  function updateFilterControls() {
    if (elements.search) {
      elements.search.value = state.filters.query;
    }
    elements.frequencyRadios.forEach((radio) => {
      radio.checked = radio.value === state.filters.frequency;
    });
    elements.categoryCheckboxes.forEach((checkbox) => {
      checkbox.checked = state.filters.categories.includes(checkbox.value);
    });
  }

  function exportCsv() {
    const filtered = sortRows(applyFilters(state.rows));
    if (!filtered.length) {
      toast('No subscriptions to export yet.');
      return;
    }
    const header = ['Included', 'Name', 'Category', 'Frequency', 'Price', 'Monthly', 'Yearly', 'NextBilling', 'Notes', 'Currency'];
    const rows = filtered.map((row) => {
      const priceDisplay = toCurrency(row.price, state.currency).toFixed(2);
      const monthlyDisplay = toCurrency(monthlyCost(row), state.currency).toFixed(2);
      const yearlyDisplay = toCurrency(yearlyCost(row), state.currency).toFixed(2);
      return [
        row.included ? 'Yes' : 'No',
        sanitizeCsvField(row.name),
        sanitizeCsvField(row.category),
        sanitizeCsvField(formatFrequency(row.frequency)),
        sanitizeCsvField(priceDisplay),
        sanitizeCsvField(monthlyDisplay),
        sanitizeCsvField(yearlyDisplay),
        sanitizeCsvField(row.nextBilling || ''),
        sanitizeCsvField(row.notes || ''),
        state.currency
      ].join(',');
    });
    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'subscriptions.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast('Exported subscriptions as CSV.');
  }

  function sanitizeCsvField(value) {
    const stringValue = String(value ?? '');
    const escaped = stringValue.replace(/"/g, '""');
    const needsEscape = /[",\n]/.test(escaped);
    const needsFormulaEscape = /^[=+\-@]/.test(escaped);
    const safe = needsFormulaEscape ? `'${escaped}` : escaped;
    return needsEscape ? `"${safe}"` : safe;
  }

  function handleReset() {
    const confirmed = window.confirm('Clear all subscriptions and reset filters?');
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    state = clone(defaultState);
    editingId = null;
    editDraft = null;
    elements.form.reset();
    elements.frequencyMonthly.checked = true;
    elements.priceError.textContent = '';
    updateFilterControls();
    syncCurrencyControls();
    pendingFocus = { fallback: elements.search };
    render();
    toast('All subscriptions and filters reset.');
  }

  function insertDemoData() {
    DEMO_ROWS.forEach((demo) => {
      const exists = state.rows.some((row) =>
        row.name === demo.name &&
        row.category === demo.category &&
        row.frequency === demo.frequency &&
        Math.abs(row.price - demo.price) < 0.001
      );
      if (!exists) {
        state.rows.push({ ...demo, id: createId() });
      }
    });
    persist();
    render();
    toast('Loaded demo subscriptions.');
  }
})();
