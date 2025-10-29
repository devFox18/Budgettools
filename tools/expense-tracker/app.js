/*
QA checklist (run manually before shipping)
- [ ] 0.1 + 0.2 equals 0.30 (cents math)
- [ ] Locale parsing for “1,23” and “1.23”
- [ ] Totals match sum of entries exactly
- [ ] Import malformed JSON shows helpful error
- [ ] 2,000-row performance acceptable
- [ ] Keyboard shortcuts work and are discoverable in a “?” help link
- [ ] Mobile layout readable; header sticky; summary accessible
- [ ] Clear month confirmation shows correct month and cancels safely

Before/After notes
- Money calculation fixes: switched to strict integer-cent math with locale-aware parsing/formatting to prevent rounding drift and enforce currency limits.
- UX improvements: added sticky controls, live validation with aria feedback, quick category workflows, summary filtering, and discoverable shortcut help for a polished flow.
- Performance & privacy trade-offs: kept a single in-memory source of truth with debounced storage writes; everything remains client-only with no network requests.
*/

(() => {
  const STORAGE_PREFIX = "bt_expenses";
  const CURRENCY_STORAGE_KEY = `${STORAGE_PREFIX}_currency`;
  const MAX_ROWS = 2000;
  const MAX_AMOUNT_CENTS = 100000000; // 1,000,000.00
  const SAVE_DEBOUNCE = 300;
  const DEFAULT_CURRENCY = "EUR";
  const DEFAULT_CATEGORIES = ["Housing", "Food", "Transport", "Subscriptions", "Leisure", "Other"];

  const pad = (value) => String(value).padStart(2, "0");
  const storageKey = (year, month) => `${STORAGE_PREFIX}_${year}_${pad(month)}`;
  const monthLabel = (year, month) => new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const NBSP = String.fromCharCode(160);
  const stripSpaces = (value) => {
    let result = "";
    for (const char of value) {
      const code = char.charCodeAt(0);
      if (code <= 32 || char === NBSP) continue;
      result += char;
    }
    return result;
  };

  const isDigitsOnly = (text) => {
    if (!text) return false;
    for (const char of text) {
      if (char < "0" || char > "9") return false;
    }
    return true;
  };

  const toCents = (input, localeAware = true) => {
    if (typeof input === "number" && Number.isFinite(input)) {
      return Math.round(input * 100);
    }
    const raw = String(input ?? "").trim();
    if (!raw) return NaN;
    if (!localeAware) {
      const direct = Number(raw);
      return Number.isFinite(direct) ? Math.round(direct * 100) : NaN;
    }
    const normalised = stripSpaces(raw);
    let commaCount = 0;
    let dotCount = 0;
    for (const char of normalised) {
      if (char === ",") commaCount += 1;
      if (char === ".") dotCount += 1;
    }
    const lastComma = normalised.lastIndexOf(",");
    const lastDot = normalised.lastIndexOf(".");
    let decimalSeparator = null;
    if (commaCount && dotCount) {
      decimalSeparator = lastComma > lastDot ? "," : ".";
    } else if (commaCount === 1 && !dotCount) {
      const decimals = normalised.length - lastComma - 1;
      if (decimals > 0 && decimals <= 2) {
        decimalSeparator = ",";
      }
    } else if (dotCount === 1 && !commaCount) {
      const decimals = normalised.length - lastDot - 1;
      if (decimals > 0 && decimals <= 2) {
        decimalSeparator = ".";
      }
    }

    let digits = "";
    for (const char of normalised) {
      if (decimalSeparator && char === decimalSeparator) {
        digits += ".";
        continue;
      }
      if (decimalSeparator === "." && char === ",") {
        continue;
      }
      if (decimalSeparator === "," && char === ".") {
        continue;
      }
      if (!decimalSeparator && (char === "," || char === ".")) {
        continue;
      }
      digits += char;
    }

    if (!digits) {
      return NaN;
    }

    const parts = digits.split(".");
    if (parts.length > 2) {
      return NaN;
    }
    const whole = parts[0] || "0";
    const numericOnly = digits.replace(".", "");
    if (!numericOnly) {
      return NaN;
    }
    if (!isDigitsOnly(whole)) {
      return NaN;
    }
    let fraction = parts[1] || "";
    if (fraction && !isDigitsOnly(fraction)) {
      return NaN;
    }
    if (fraction.length > 2) {
      return NaN;
    }
    const integerPart = Number(whole);
    if (!Number.isFinite(integerPart)) {
      return NaN;
    }
    const fractionPart = fraction.padEnd(2, "0").slice(0, 2);
    return integerPart * 100 + Number(fractionPart);
  };

  const fromCents = (cents) => cents / 100;
  const sumCents = (list) => list.reduce((total, amount) => total + (Number.isFinite(amount) ? amount : 0), 0);

  const parseAmount = (value) => {
    if (value === "" || value === null || typeof value === "undefined") {
      return { valid: false, message: "Enter an amount." };
    }
    const cents = toCents(value, true);
    if (!Number.isFinite(cents)) {
      return { valid: false, message: "Enter a valid amount (max two decimals)." };
    }
    if (cents < 0) {
      return { valid: false, message: "Amount must be zero or greater." };
    }
    if (cents > MAX_AMOUNT_CENTS) {
      return { valid: false, message: "Keep amounts below 1,000,000.00." };
    }
    return { valid: true, cents };
  };

  const formatters = new Map();
  const getCurrencyFormatter = (locale, currency) => {
    const key = `${locale || "default"}_${currency}`;
    if (formatters.has(key)) {
      return formatters.get(key);
    }
    let formatter;
    try {
      formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch (error) {
      formatter = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: DEFAULT_CURRENCY,
      });
    }
    formatters.set(key, formatter);
    return formatter;
  };

  const announce = (message, tone = "polite") => {
    const region = document.querySelector("[data-live-region]");
    if (!region) return;
    region.setAttribute("aria-live", tone);
    region.textContent = message;
    if (message) {
      window.clearTimeout(region._clearTimer);
      region._clearTimer = window.setTimeout(() => {
        region.textContent = "";
      }, 3200);
    }
  };

  const createId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `bt_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  };

  const loadCurrency = () => {
    try {
      const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (stored) return stored;
    } catch (error) {
      console.warn("Unable to read currency preference", error);
    }
    return DEFAULT_CURRENCY;
  };

  const saveCurrency = (currency) => {
    try {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    } catch (error) {
      console.warn("Unable to persist currency preference", error);
    }
  };

  const loadMonth = (year, month) => {
    const key = storageKey(year, month);
    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) {
        return { entries: [], categories: [] };
      }
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return {
          entries: parsed.slice(0, MAX_ROWS).map((entry) => ({
            id: typeof entry.id === "string" ? entry.id : createId(),
            date: typeof entry.date === "string" ? entry.date : new Date(year, month - 1, 1).toISOString().slice(0, 10),
            category: typeof entry.category === "string" ? entry.category : "",
            note: typeof entry.note === "string" ? entry.note : "",
            amountCents: Number.isFinite(entry.amount)
              ? Math.max(0, Math.round(entry.amount))
              : Number.isFinite(entry.amountCents)
              ? Math.max(0, Math.round(entry.amountCents))
              : 0,
          })),
          categories: [],
        };
      }
      if (!parsed || typeof parsed !== "object") {
        return { entries: [], categories: [] };
      }
      const entries = Array.isArray(parsed.entries)
        ? parsed.entries.slice(0, MAX_ROWS).map((entry) => ({
            id: typeof entry.id === "string" ? entry.id : createId(),
            date: typeof entry.date === "string" ? entry.date : new Date(year, month - 1, 1).toISOString().slice(0, 10),
            category: typeof entry.category === "string" ? entry.category : "",
            note: typeof entry.note === "string" ? entry.note : "",
            amountCents: Number.isFinite(entry.amountCents)
              ? Math.max(0, Math.round(entry.amountCents))
              : Number.isFinite(entry.amount)
              ? Math.max(0, Math.round(entry.amount))
              : 0,
          }))
        : [];
      const categories = Array.isArray(parsed.categories)
        ? parsed.categories.filter((name) => typeof name === "string")
        : [];
      return { entries, categories };
    } catch (error) {
      console.warn("Unable to parse stored month", error);
      return { entries: [], categories: [] };
    }
  };

  const saveMonth = (year, month, data) => {
    const key = storageKey(year, month);
    try {
      const payload = {
        year,
        month,
        entries: data.entries,
        categories: Array.from(data.categories ?? []),
      };
      window.localStorage.setItem(key, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.warn("Unable to persist expenses", error);
      announce("Could not save locally (storage full?).", "assertive");
      return false;
    }
  };

  const clearMonth = (year, month) => {
    const key = storageKey(year, month);
    window.localStorage.removeItem(key);
  };

  const today = new Date();
  const initialYear = today.getFullYear();
  const initialMonth = today.getMonth() + 1;

  const state = {
    year: initialYear,
    month: initialMonth,
    entries: [],
    categories: new Set(DEFAULT_CATEGORIES),
    selectedId: null,
    filterCategory: null,
    currency: loadCurrency(),
    saveTimer: null,
    pendingSave: false,
  };

  const tracker = document.querySelector("[data-tracker]");
  if (!tracker) return;

  const elements = {
    start: document.querySelector("[data-start-tracking]"),
    monthSelector: tracker.querySelector("[data-month-selector]"),
    currencySelector: tracker.querySelector("[data-currency-selector]"),
    addRow: tracker.querySelector("[data-add-row]"),
    deleteRow: tracker.querySelector("[data-delete-row]"),
    clearMonth: tracker.querySelector("[data-clear-month]"),
    entriesBody: tracker.querySelector("[data-entries]"),
    emptyState: tracker.querySelector("[data-empty-state]"),
    emptyAdd: tracker.querySelector("[data-empty-add]"),
    tip: tracker.querySelector("[data-tip]"),
    rowNotice: tracker.querySelector("[data-row-limit]"),
    summaryTotal: tracker.querySelector("[data-total-amount]"),
    summaryList: tracker.querySelector("[data-category-totals]"),
    summaryBar: tracker.querySelector("[data-summary-bar]"),
    download: tracker.querySelector("[data-download]"),
    importButton: tracker.querySelector("[data-import]"),
    importInput: tracker.querySelector("[data-import-input]"),
    chips: tracker.querySelector("[data-chips]"),
    chipCustomInput: tracker.querySelector("[data-custom-category-input]"),
    chipCustomApply: tracker.querySelector("[data-custom-category-apply]"),
    filterNotice: tracker.querySelector("[data-filter-notice]"),
    clearFilter: tracker.querySelector("[data-clear-filter]"),
    helpToggle: tracker.querySelector("[data-shortcuts-toggle]"),
    helpPanel: tracker.querySelector("[data-shortcuts-panel]"),
    helpClose: tracker.querySelector("[data-shortcuts-close]"),
    saveStatus: tracker.querySelector("[data-save-status]"),
    importError: tracker.querySelector("[data-import-error]"),
  };

  const ensureElements = Object.values(elements).every((el) => el);
  if (!ensureElements) {
    console.warn("Expense tracker markup missing required nodes.");
    return;
  }

  const getFormatter = () => getCurrencyFormatter(undefined, state.currency);
  const formatCents = (cents) => getFormatter().format(fromCents(cents || 0));

  const setSaveStatus = (message = "Saved", tone = "success") => {
    if (!elements.saveStatus) return;
    elements.saveStatus.textContent = message;
    elements.saveStatus.dataset.tone = tone;
    if (message) {
      window.clearTimeout(elements.saveStatus._timer);
      elements.saveStatus._timer = window.setTimeout(() => {
        elements.saveStatus.textContent = "";
      }, 2800);
    }
  };

  const syncMonthSelector = () => {
    elements.monthSelector.value = `${state.year}-${pad(state.month)}`;
  };

  const syncCurrencySelector = () => {
    elements.currencySelector.value = state.currency;
  };

  const scheduleSave = () => {
    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
    }
    state.pendingSave = true;
    setSaveStatus("Saving…", "pending");
    state.saveTimer = window.setTimeout(() => {
      const success = saveMonth(state.year, state.month, {
        entries: state.entries,
        categories: Array.from(state.categories),
      });
      state.pendingSave = false;
      state.saveTimer = null;
      if (success) {
        setSaveStatus("Saved locally", "success");
      } else {
        setSaveStatus("Save failed", "error");
      }
    }, SAVE_DEBOUNCE);
  };

  const persistNow = () => {
    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }
    const success = saveMonth(state.year, state.month, {
      entries: state.entries,
      categories: Array.from(state.categories),
    });
    state.pendingSave = false;
    if (success) {
      setSaveStatus("Saved locally", "success");
      announce("Month saved", "polite");
    } else {
      setSaveStatus("Save failed", "error");
    }
  };

  const renderEmptyState = (visibleEntries) => {
    const hasEntries = state.entries.length > 0;
    const message = elements.emptyState.querySelector("p");
    const button = elements.emptyAdd;
    if (!hasEntries) {
      if (message) message.textContent = "No expenses yet. Add your first expense to get started.";
      if (button) button.textContent = "Add your first expense";
      elements.emptyState.hidden = false;
    } else if (state.filterCategory && visibleEntries.length === 0) {
      if (message) message.textContent = `No expenses in ${state.filterCategory} yet.`;
      if (button) button.textContent = "Add expense";
      elements.emptyState.hidden = false;
    } else {
      elements.emptyState.hidden = true;
    }
    const showTip = hasEntries && !(state.filterCategory && visibleEntries.length === 0);
    elements.tip.hidden = !showTip;
  };

  const renderRowNotice = () => {
    const isMaxed = state.entries.length >= MAX_ROWS;
    elements.addRow.disabled = isMaxed;
    elements.emptyAdd.disabled = isMaxed;
    if (isMaxed) {
      elements.rowNotice.hidden = false;
      elements.rowNotice.textContent = `You have reached the ${MAX_ROWS.toLocaleString()} entry limit for a month. Consider splitting data.`;
    } else {
      elements.rowNotice.hidden = true;
      elements.rowNotice.textContent = "";
    }
  };

  const getVisibleEntries = () => {
    if (!state.filterCategory) return state.entries;
    return state.entries.filter((entry) => (entry.category || "Uncategorised") === state.filterCategory);
  };

  const focusRow = (id, selector = "input, select") => {
    window.requestAnimationFrame(() => {
      const row = elements.entriesBody.querySelector(`tr[data-entry-id="${id}"]`);
      if (!row) return;
      const target = row.querySelector(selector);
      if (target) target.focus();
    });
  };

  const updateSelection = (id) => {
    state.selectedId = id;
    elements.entriesBody.querySelectorAll("tr[data-entry-id]").forEach((row) => {
      row.dataset.selected = row.dataset.entryId === id ? "true" : "false";
    });
    elements.deleteRow.disabled = !id;
  };

  const allCategories = () => {
    const categories = new Set(state.categories);
    state.entries.forEach((entry) => {
      if (entry.category) categories.add(entry.category);
    });
    return Array.from(categories);
  };

  const buildCategoryOptions = (value) => {
    const select = document.createElement("select");
    select.dataset.field = "category";
    select.setAttribute("aria-label", "Select expense category");

    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Select category";
    select.append(blank);

    const categories = allCategories();
    categories.sort((a, b) => a.localeCompare(b));
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      if (category === value) option.selected = true;
      select.append(option);
    });

    const custom = document.createElement("option");
    custom.value = "__custom__";
    custom.textContent = "+ Custom category";
    select.append(custom);
    return select;
  };

  const buildRow = (entry) => {
    const row = document.createElement("tr");
    row.dataset.entryId = entry.id;
    row.dataset.selected = state.selectedId === entry.id ? "true" : "false";

    const dateCell = document.createElement("td");
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = entry.date;
    dateInput.dataset.field = "date";
    dateInput.setAttribute("aria-label", "Expense date");
    dateCell.append(dateInput);

    const categoryCell = document.createElement("td");
    const categorySelect = buildCategoryOptions(entry.category);
    categoryCell.append(categorySelect);

    const noteCell = document.createElement("td");
    const noteInput = document.createElement("input");
    noteInput.type = "text";
    noteInput.placeholder = "Add note";
    noteInput.value = entry.note;
    noteInput.maxLength = 160;
    noteInput.dataset.field = "note";
    noteInput.setAttribute("aria-label", "Expense note (optional)");
    noteCell.append(noteInput);

    const amountCell = document.createElement("td");
    const amountInput = document.createElement("input");
    amountInput.type = "text";
    amountInput.inputMode = "decimal";
    amountInput.pattern = "[0-9.,]*";
    amountInput.placeholder = "0.00";
    amountInput.value = entry.amountCents ? (fromCents(entry.amountCents)).toFixed(2) : "";
    amountInput.dataset.field = "amount";
    amountInput.setAttribute("aria-label", "Expense amount");
    amountInput.classList.add("amount-input");
    amountCell.append(amountInput);

    row.append(dateCell, categoryCell, noteCell, amountCell);
    return row;
  };

  const renderEntries = () => {
    elements.entriesBody.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const visibleEntries = getVisibleEntries();
    visibleEntries.forEach((entry) => {
      fragment.append(buildRow(entry));
    });
    elements.entriesBody.append(fragment);
    elements.filterNotice.hidden = !state.filterCategory;
    elements.clearFilter.disabled = !state.filterCategory;
    if (state.filterCategory) {
      elements.filterNotice.querySelector("strong").textContent = state.filterCategory;
    }
    renderEmptyState(visibleEntries);
    renderRowNotice();
    renderSummary();
  };

  const renderSummary = () => {
    const visibleEntries = getVisibleEntries();
    const totalsAll = calculateTotals(state.entries);
    const totalsVisible = calculateTotals(visibleEntries);
    const displayTotal = state.filterCategory ? totalsVisible.total : totalsAll.total;
    elements.summaryTotal.textContent = formatCents(displayTotal);
    elements.summaryList.innerHTML = "";

    if (totalsAll.perCategory.size === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "summary__empty";
      emptyItem.textContent = "No categories yet";
      elements.summaryList.append(emptyItem);
    } else {
      const sorted = Array.from(totalsAll.perCategory.entries()).sort((a, b) => b[1] - a[1]);
      sorted.forEach(([category, amount]) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.categoryToggle = category;
        button.className = "summary__category";
        if (state.filterCategory === category) {
          button.dataset.active = "true";
        }
        const nameSpan = document.createElement("span");
        nameSpan.textContent = category;
        const amountSpan = document.createElement("span");
        amountSpan.textContent = formatCents(amount);
        button.append(nameSpan, amountSpan);
        item.append(button);
        elements.summaryList.append(item);
      });
    }

    elements.summaryBar.innerHTML = "";
    if (totalsAll.total === 0 || totalsAll.perCategory.size === 0) {
      const segment = document.createElement("div");
      segment.className = "summary__segment is-empty";
      elements.summaryBar.append(segment);
      return;
    }

    const sorted = Array.from(totalsAll.perCategory.entries()).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([category, amount]) => {
      const segment = document.createElement("div");
      segment.className = "summary__segment";
      const share = totalsAll.total === 0 ? 0 : Math.max(0.04, amount / totalsAll.total);
      segment.style.flexGrow = String(share);
      segment.title = `${category}: ${formatCents(amount)}`;
      segment.dataset.category = category;
      segment.dataset.label = category;
      if (state.filterCategory === category) {
        segment.dataset.active = "true";
      }
      elements.summaryBar.append(segment);
    });
  };

  const setMonthData = (year, month, entries, categories) => {
    state.year = year;
    state.month = month;
    state.entries = entries;
    state.categories = new Set([...DEFAULT_CATEGORIES, ...(categories || [])]);
    state.selectedId = null;
    state.filterCategory = null;
    syncMonthSelector();
    renderEntries();
    elements.deleteRow.disabled = true;
  };

  const refreshStateFromStorage = () => {
    const data = loadMonth(state.year, state.month);
    const entries = data.entries.map((entry) => ({
      id: entry.id || createId(),
      date: entry.date || new Date(state.year, state.month - 1, 1).toISOString().slice(0, 10),
      category: entry.category || "",
      note: entry.note || "",
      amountCents: Number.isFinite(entry.amountCents) ? Math.max(0, entry.amountCents) : 0,
    }));
    setMonthData(state.year, state.month, entries, data.categories || []);
  };

  const addEntry = (category) => {
    if (state.entries.length >= MAX_ROWS) {
      renderRowNotice();
      announce(`Cannot add more than ${MAX_ROWS} rows.`, "assertive");
      return;
    }
    const id = createId();
    const entry = {
      id,
      date: new Date().toISOString().slice(0, 10),
      category: category || state.filterCategory || "",
      note: "",
      amountCents: 0,
    };
    state.entries.push(entry);
    scheduleSave();
    renderEntries();
    updateSelection(id);
    focusRow(id, "input[data-field='date']");
    if (category) {
      const activeCategory = category;
      state.categories.add(activeCategory);
    }
  };

  const deleteSelected = () => {
    if (!state.selectedId) return;
    const index = state.entries.findIndex((entry) => entry.id === state.selectedId);
    if (index === -1) return;
    const confirmed = window.confirm("Delete the selected expense?");
    if (!confirmed) return;
    state.entries.splice(index, 1);
    const nextEntry = state.entries[Math.min(index, state.entries.length - 1)];
    const nextId = nextEntry ? nextEntry.id : null;
    updateSelection(nextId);
    scheduleSave();
    renderEntries();
    if (nextId) {
      focusRow(nextId);
    }
  };

  const updateEntry = (id, field, value) => {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    if (field === "amount") {
      const validation = parseAmount(value);
      const row = elements.entriesBody.querySelector(`tr[data-entry-id="${id}"]`);
      const input = row ? row.querySelector("input[data-field='amount']") : null;
      if (!validation.valid) {
        if (input) {
          input.classList.add("has-error");
          input.setAttribute("aria-invalid", "true");
          window.requestAnimationFrame(() => input.focus());
        }
        announce(validation.message, "polite");
        return;
      }
      if (input) {
        input.classList.remove("has-error");
        input.removeAttribute("aria-invalid");
        input.value = (fromCents(validation.cents)).toFixed(2);
      }
      entry.amountCents = validation.cents;
    } else if (field === "category") {
      if (value === "__custom__") {
        showInlineCategoryInput(id);
        return;
      }
      entry.category = value;
      if (value) {
        state.categories.add(value);
      }
    } else if (field === "date") {
      entry.date = value;
    } else if (field === "note") {
      entry.note = value;
    }
    scheduleSave();
    renderSummary();
  };

  const showInlineCategoryInput = (id) => {
    const row = elements.entriesBody.querySelector(`tr[data-entry-id="${id}"]`);
    if (!row) return;
    let container = row.querySelector(".category-inline");
    if (!container) {
      container = document.createElement("div");
      container.className = "category-inline";
      container.innerHTML = `
        <label class="sr-only" for="custom-${id}">New category name</label>
        <input id="custom-${id}" type="text" maxlength="30" aria-label="New category name" />
        <button type="button" data-inline-save>Save</button>
        <button type="button" data-inline-cancel>Cancel</button>
      `;
      const cell = row.querySelector("td:nth-child(2)");
      cell.append(container);
    }
    const input = container.querySelector("input");
    if (input) input.focus();
  };

  const removeInlineCategoryInput = (id) => {
    const row = elements.entriesBody.querySelector(`tr[data-entry-id="${id}"]`);
    if (!row) return;
    const container = row.querySelector(".category-inline");
    if (container) container.remove();
    const select = row.querySelector("select[data-field='category']");
    if (select) select.value = "";
  };

  const applyInlineCategory = (id, value) => {
    if (!value) return;
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    entry.category = value;
    state.categories.add(value);
    removeInlineCategoryInput(id);
    scheduleSave();
    renderEntries();
    updateSelection(id);
    focusRow(id, "select[data-field='category']");
  };

  const handleInlineCategoryAction = (target) => {
    const row = target.closest("tr[data-entry-id]");
    if (!row) return;
    const id = row.dataset.entryId;
    if (!id) return;
    if (target.matches("[data-inline-save]")) {
      const input = row.querySelector(".category-inline input");
      if (!input) return;
      const value = input.value.trim();
      if (!value) {
        announce("Enter a category name", "polite");
        input.focus();
        return;
      }
      applyInlineCategory(id, value);
    } else if (target.matches("[data-inline-cancel]")) {
      removeInlineCategoryInput(id);
      focusRow(id, "select[data-field='category']");
    }
  };

  const downloadJson = () => {
    const data = {
      year: state.year,
      month: state.month,
      entries: state.entries,
      categories: Array.from(state.categories),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `expenses_${state.year}_${pad(state.month)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const showImportError = (message) => {
    elements.importError.hidden = false;
    elements.importError.textContent = message;
    setSaveStatus(message, "error");
    announce(message, "assertive");
  };

  const clearImportError = () => {
    elements.importError.hidden = true;
    elements.importError.textContent = "";
  };

  const handleImport = (file) => {
    if (!file) return;
    clearImportError();
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("File malformed: expected an object with month data.");
        }
        const { year, month, entries, categories } = parsed;
        if (!Number.isInteger(year) || !Number.isInteger(month)) {
          throw new Error("File malformed: missing year/month metadata.");
        }
        if (!Array.isArray(entries)) {
          throw new Error("File malformed: expected 'entries' array.");
        }
        if (entries.length > MAX_ROWS) {
          throw new Error(`Import exceeds the ${MAX_ROWS} row limit.`);
        }
        const normalisedEntries = entries.map((entry) => {
          if (!entry || typeof entry !== "object") {
            throw new Error("Entries must be objects.");
          }
          const amountSource = Number.isFinite(entry.amountCents)
            ? entry.amountCents
            : Number.isFinite(entry.amount)
            ? entry.amount
            : null;
          if (amountSource === null) {
            throw new Error("Entry missing numeric amount.");
          }
          const amount = Math.min(MAX_AMOUNT_CENTS, Math.max(0, Math.round(amountSource)));
          return {
            id: typeof entry.id === "string" ? entry.id : createId(),
            date: typeof entry.date === "string" ? entry.date : new Date(year, month - 1, 1).toISOString().slice(0, 10),
            category: typeof entry.category === "string" ? entry.category : "",
            note: typeof entry.note === "string" ? entry.note : "",
            amountCents: amount,
          };
        });
        if (categories && !Array.isArray(categories)) {
          throw new Error("File malformed: categories must be an array of strings.");
        }
        setMonthData(year, month, normalisedEntries, categories || []);
        saveMonth(year, month, {
          entries: normalisedEntries,
          categories: Array.from(state.categories),
        });
        setSaveStatus("Import complete", "success");
        announce("Import complete", "polite");
      } catch (error) {
        showImportError(error.message || "Could not import file.");
      }
    });
    reader.readAsText(file);
  };

  const useQuickCategory = (category) => {
    const label = category.trim();
    if (!label) return;
    state.categories.add(label);
    if (state.selectedId) {
      updateEntry(state.selectedId, "category", label);
      renderEntries();
      updateSelection(state.selectedId);
      focusRow(state.selectedId, "select[data-field='category']");
      return;
    }
    addEntry(label);
  };

  const handleCurrencyChange = (value) => {
    if (!value) return;
    state.currency = value;
    saveCurrency(value);
    renderSummary();
  };

  const handleMonthChange = (value) => {
    if (!value) return;
    const parts = value.split("-");
    if (parts.length !== 2) return;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (!Number.isInteger(year) || !Number.isInteger(month)) return;
    state.year = year;
    state.month = month;
    refreshStateFromStorage();
  };

  const handleSummaryToggle = (category) => {
    if (!category) return;
    if (state.filterCategory === category) {
      state.filterCategory = null;
    } else {
      state.filterCategory = category;
    }
    renderEntries();
  };

  const toggleHelpPanel = (show) => {
    const supportsDialog = typeof elements.helpPanel.showModal === "function";
    const isOpen = supportsDialog ? elements.helpPanel.open : elements.helpPanel.hasAttribute("open");
    const shouldOpen = show === true || (show === undefined && !isOpen);
    if (supportsDialog) {
      if (shouldOpen) {
        elements.helpPanel.removeAttribute("hidden");
        elements.helpPanel.showModal();
        const closeBtn = elements.helpPanel.querySelector("[data-shortcuts-close]") || elements.helpPanel;
        closeBtn.focus();
      } else {
        elements.helpPanel.close();
        elements.helpPanel.setAttribute("hidden", "hidden");
        elements.helpToggle.focus();
      }
    } else {
      if (shouldOpen) {
        elements.helpPanel.setAttribute("open", "true");
        elements.helpPanel.removeAttribute("hidden");
      } else {
        elements.helpPanel.removeAttribute("open");
        elements.helpPanel.setAttribute("hidden", "hidden");
        elements.helpToggle.focus();
      }
    }
  };

  const initKeyboardShortcuts = () => {
    document.addEventListener("keydown", (event) => {
      const active = document.activeElement;
      const isFormField = active && (active.tagName === "INPUT" || active.tagName === "SELECT" || active.tagName === "TEXTAREA");
      if (event.key.toLowerCase() === "a" && !event.altKey && !event.metaKey && !event.ctrlKey) {
        if (isFormField && active.dataset.field !== "note") return;
        event.preventDefault();
        addEntry();
      }
      if (event.key === "Delete" && isFormField) {
        const row = active.closest("tr[data-entry-id]");
        if (row) {
          event.preventDefault();
          updateSelection(row.dataset.entryId);
          deleteSelected();
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        persistNow();
      }
      if (event.key === "?" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        toggleHelpPanel(true);
      }
    });
  };

  const bindEvents = () => {
    elements.start.addEventListener("click", () => {
      tracker.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    elements.monthSelector.addEventListener("change", (event) => handleMonthChange(event.target.value));
    elements.currencySelector.addEventListener("change", (event) => handleCurrencyChange(event.target.value));
    elements.addRow.addEventListener("click", () => addEntry());
    elements.emptyAdd.addEventListener("click", () => addEntry());
    elements.deleteRow.addEventListener("click", deleteSelected);
    elements.clearMonth.addEventListener("click", () => {
      const label = monthLabel(state.year, state.month);
      const confirmed = window.confirm(`Clear all expenses for ${label}? This cannot be undone.`);
      if (!confirmed) return;
      clearMonth(state.year, state.month);
      setMonthData(state.year, state.month, [], []);
      announce("Month cleared", "polite");
      setSaveStatus("Month cleared", "success");
    });
    elements.download.addEventListener("click", downloadJson);
    elements.importButton.addEventListener("click", () => elements.importInput.click());
    elements.importInput.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      handleImport(file);
      event.target.value = "";
    });

    elements.entriesBody.addEventListener("focusin", (event) => {
      const row = event.target.closest("tr[data-entry-id]");
      if (!row) return;
      updateSelection(row.dataset.entryId);
    });

    elements.entriesBody.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
      const row = target.closest("tr[data-entry-id]");
      if (!row) return;
      const id = row.dataset.entryId;
      const field = target.dataset.field;
      if (!id || !field) return;
      updateEntry(id, field, target.value);
    });

    elements.entriesBody.addEventListener("blur", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.dataset.field === "amount") {
        const row = target.closest("tr[data-entry-id]");
        if (!row) return;
        updateEntry(row.dataset.entryId, "amount", target.value);
      }
    }, true);

    elements.entriesBody.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches("[data-inline-save], [data-inline-cancel]")) {
        handleInlineCategoryAction(target);
        return;
      }
      const button = target.closest("button.summary__category");
      if (button && button.dataset.categoryToggle) {
        handleSummaryToggle(button.dataset.categoryToggle);
      }
    });

    elements.summaryList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-category-toggle]");
      if (button) {
        handleSummaryToggle(button.dataset.categoryToggle);
      }
    });

    elements.summaryBar.addEventListener("click", (event) => {
      const segment = event.target.closest(".summary__segment");
      if (!segment) return;
      const category = segment.dataset.category || segment.dataset.label;
      if (category) {
        handleSummaryToggle(category);
      }
    });

    elements.chips.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-category-chip]");
      if (chip) {
        event.preventDefault();
        useQuickCategory(chip.getAttribute("data-category-chip"));
      }
      if (event.target.matches("[data-custom-category-apply]")) {
        event.preventDefault();
        const value = elements.chipCustomInput.value.trim();
        if (!value) {
          elements.chipCustomInput.focus();
          return;
        }
        useQuickCategory(value);
        elements.chipCustomInput.value = "";
      }
    });

    elements.chipCustomInput.addEventListener("input", () => {
      const value = elements.chipCustomInput.value.trim();
      elements.chipCustomApply.textContent = value ? `Use ${value}` : "Use";
      elements.chipCustomApply.setAttribute("aria-label", value ? `Apply ${value} category` : "Apply custom category");
    });

    elements.chipCustomInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const value = elements.chipCustomInput.value.trim();
        if (!value) {
          elements.chipCustomInput.focus();
          return;
        }
        useQuickCategory(value);
        elements.chipCustomInput.value = "";
      }
    });

    elements.chipCustomApply.textContent = "Use";
    elements.chipCustomApply.setAttribute("aria-label", "Apply custom category");

    elements.clearFilter.addEventListener("click", () => {
      state.filterCategory = null;
      renderEntries();
    });
    elements.helpToggle.addEventListener("click", () => toggleHelpPanel());
    elements.helpClose.addEventListener("click", () => toggleHelpPanel(false));
    if (typeof elements.helpPanel.showModal === "function") {
      elements.helpPanel.addEventListener("cancel", (event) => {
        event.preventDefault();
        toggleHelpPanel(false);
      });
    }
  };

  const init = () => {
    refreshStateFromStorage();
    syncCurrencySelector();
    bindEvents();
    initKeyboardShortcuts();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
