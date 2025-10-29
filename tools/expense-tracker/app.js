const DEFAULT_CATEGORIES = ["Housing", "Food", "Transport", "Subscriptions", "Leisure", "Other"];
const STORAGE_PREFIX = "bt_expenses";
const MAX_ROWS = 2000;

const pad = (value) => String(value).padStart(2, "0");
const storageKey = (year, month) => `${STORAGE_PREFIX}_${year}_${pad(month)}`;

const formatCurrency = (() => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format;
  } catch (error) {
    return (value) => `$${(value / 100).toFixed(2)}`;
  }
})();

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `bt_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
};

const toCents = (value) => Math.round(Number(value) * 100);

const parseAmount = (raw) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: true, cents: 0, isBlank: true };
  }
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) {
    return { valid: false, message: "Enter a valid amount with up to two decimals." };
  }
  const cents = toCents(trimmed);
  if (cents < 0) {
    return { valid: false, message: "Amount must be zero or greater." };
  }
  return { valid: true, cents, isBlank: false };
};

const loadMonth = (year, month) => {
  const key = storageKey(year, month);
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        id: typeof entry.id === "string" ? entry.id : createId(),
        date: typeof entry.date === "string" ? entry.date : "",
        category: typeof entry.category === "string" ? entry.category : "",
        note: typeof entry.note === "string" ? entry.note : "",
        amount: typeof entry.amount === "number" ? entry.amount : 0,
      }))
      .slice(0, MAX_ROWS);
  } catch (error) {
    console.warn("Unable to parse stored expenses", error);
    return [];
  }
};

const saveMonth = (year, month, entries) => {
  const key = storageKey(year, month);
  try {
    window.localStorage.setItem(key, JSON.stringify(entries));
  } catch (error) {
    console.warn("Unable to save expenses", error);
  }
};

const clearMonth = (year, month) => {
  const key = storageKey(year, month);
  window.localStorage.removeItem(key);
};

const calculateTotals = (entries) => {
  const perCategory = new Map();
  let total = 0;
  entries.forEach((entry) => {
    if (!entry || typeof entry.amount !== "number") return;
    const amount = Math.max(0, entry.amount);
    total += amount;
    const category = entry.category || "Uncategorised";
    perCategory.set(category, (perCategory.get(category) || 0) + amount);
  });
  return { total, perCategory };
};

const state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  entries: [],
  selectedId: null,
};

const elements = {
  monthSelector: document.querySelector("[data-month-selector]"),
  entriesBody: document.querySelector("[data-entries]"),
  addRow: document.querySelector("[data-add-row]"),
  deleteSelected: document.querySelector("[data-delete-selected]"),
  clearMonth: document.querySelector("[data-clear-month]"),
  download: document.querySelector("[data-download]"),
  importButton: document.querySelector("[data-import]"),
  importInput: document.querySelector("[data-import-input]"),
  emptyState: document.querySelector("[data-empty-state]"),
  emptyAdd: document.querySelector("[data-empty-add]"),
  tip: document.querySelector("[data-tip]"),
  rowLimit: document.querySelector("[data-row-limit]"),
  totalAmount: document.querySelector("[data-total-amount]"),
  totalsList: document.querySelector("[data-category-totals]"),
  chart: document.querySelector("[data-chart]"),
  tracker: document.querySelector("[data-tracker]"),
  startButton: document.querySelector("[data-start-tracking]"),
};

const ensureElements = () => Object.values(elements).every((el) => el);

if (!ensureElements()) {
  console.warn("Expense tracker markup missing required elements.");
}

const getToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const syncMonthSelector = () => {
  if (!elements.monthSelector) return;
  elements.monthSelector.value = `${state.year}-${pad(state.month)}`;
};

const getAllCategories = () => {
  const categories = new Set(DEFAULT_CATEGORIES);
  state.entries.forEach((entry) => {
    if (entry.category) {
      categories.add(entry.category);
    }
  });
  return Array.from(categories);
};

const renderEmptyState = () => {
  if (!elements.emptyState || !elements.tip) return;
  const hasEntries = state.entries.length > 0;
  elements.emptyState.hidden = hasEntries;
  elements.tip.hidden = !hasEntries;
};

const renderRowLimitNotice = () => {
  if (!elements.rowLimit) return;
  if (state.entries.length >= MAX_ROWS) {
    elements.rowLimit.hidden = false;
    elements.rowLimit.textContent = `You have reached the ${MAX_ROWS.toLocaleString()} entry limit for a month.`;
  } else {
    elements.rowLimit.hidden = true;
    elements.rowLimit.textContent = "";
  }
};

const setSelectedRow = (id) => {
  state.selectedId = id;
  if (!elements.entriesBody) return;
  elements.entriesBody.querySelectorAll("tr[data-entry-id]").forEach((row) => {
    row.dataset.selected = row.dataset.entryId === id ? "true" : "false";
  });
  if (elements.deleteSelected) {
    elements.deleteSelected.disabled = !id;
  }
};

const createCategorySelect = (entry) => {
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Select expense category");
  select.dataset.field = "category";
  const categories = getAllCategories();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select category";
  select.append(placeholder);
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    if (entry.category === category) {
      option.selected = true;
    }
    select.append(option);
  });
  const customOption = document.createElement("option");
  customOption.value = "__custom__";
  customOption.textContent = "+ Custom category";
  select.append(customOption);
  return select;
};

const buildRow = (entry) => {
  const row = document.createElement("tr");
  row.dataset.entryId = entry.id;
  row.dataset.selected = state.selectedId === entry.id ? "true" : "false";

  const dateCell = document.createElement("td");
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.required = true;
  dateInput.value = entry.date || getToday();
  dateInput.dataset.field = "date";
  dateInput.setAttribute("aria-label", "Expense date");
  dateCell.append(dateInput);

  const categoryCell = document.createElement("td");
  const categorySelect = createCategorySelect(entry);
  categoryCell.append(categorySelect);

  const noteCell = document.createElement("td");
  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.placeholder = "Add note";
  noteInput.value = entry.note || "";
  noteInput.maxLength = 120;
  noteInput.dataset.field = "note";
  noteInput.setAttribute("aria-label", "Expense note");
  noteCell.append(noteInput);

  const amountCell = document.createElement("td");
  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.min = "0";
  amountInput.step = "0.01";
  amountInput.inputMode = "decimal";
  amountInput.dataset.field = "amount";
  amountInput.setAttribute("aria-label", "Expense amount");
  amountInput.value = entry.amount > 0 ? (entry.amount / 100).toFixed(2) : "";
  amountCell.append(amountInput);

  row.append(dateCell, categoryCell, noteCell, amountCell);
  return row;
};

const renderEntries = () => {
  if (!elements.entriesBody) return;
  elements.entriesBody.innerHTML = "";
  const fragment = document.createDocumentFragment();
  state.entries.forEach((entry) => {
    fragment.append(buildRow(entry));
  });
  elements.entriesBody.append(fragment);
  renderEmptyState();
  renderRowLimitNotice();
  renderSummary();
};

const renderSummary = () => {
  if (!elements.totalAmount || !elements.totalsList || !elements.chart) return;
  const { total, perCategory } = calculateTotals(state.entries);
  elements.totalAmount.textContent = formatCurrency(total);
  elements.totalsList.innerHTML = "";
  if (perCategory.size === 0) {
    const dt = document.createElement("dt");
    dt.textContent = "No categories yet";
    const dd = document.createElement("dd");
    dd.textContent = formatCurrency(0);
    elements.totalsList.append(dt, dd);
  } else {
    perCategory.forEach((amount, category) => {
      const dt = document.createElement("dt");
      dt.textContent = category;
      const dd = document.createElement("dd");
      dd.textContent = formatCurrency(amount);
      elements.totalsList.append(dt, dd);
    });
  }
  renderChart(total, perCategory);
};

const renderChart = (total, perCategory) => {
  if (!elements.chart) return;
  elements.chart.innerHTML = "";
  if (total === 0 || perCategory.size === 0) {
    const emptySegment = document.createElement("div");
    emptySegment.dataset.segment = "empty";
    emptySegment.classList.add("is-empty");
    elements.chart.append(emptySegment);
    return;
  }
  perCategory.forEach((amount, category) => {
    const segment = document.createElement("div");
    segment.dataset.segment = category;
    const width = Math.max(4, Math.round((amount / total) * 100));
    segment.style.flex = `${width}`;
    segment.style.background = `color-mix(in srgb, var(--color-accent) ${30 + Math.min(60, width)}%, transparent)`;
    segment.title = `${category}: ${formatCurrency(amount)}`;
    elements.chart.append(segment);
  });
};

const persist = () => {
  saveMonth(state.year, state.month, state.entries);
  renderSummary();
};

const addEntry = (category) => {
  if (state.entries.length >= MAX_ROWS) {
    renderRowLimitNotice();
    return;
  }
  const entry = {
    id: createId(),
    date: getToday(),
    category: category || "",
    note: "",
    amount: 0,
  };
  state.entries.push(entry);
  persist();
  renderEntries();
  setSelectedRow(entry.id);
  requestAnimationFrame(() => {
    const row = elements.entriesBody?.querySelector(`tr[data-entry-id="${entry.id}"] input[data-field="date"]`);
    row?.focus();
  });
};

const deleteSelectedEntry = () => {
  if (!state.selectedId) return;
  const index = state.entries.findIndex((entry) => entry.id === state.selectedId);
  if (index === -1) return;
  state.entries.splice(index, 1);
  state.selectedId = null;
  persist();
  renderEntries();
  if (elements.deleteSelected) {
    elements.deleteSelected.disabled = true;
  }
};

const handleFieldUpdate = (id, field, value) => {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  if (field === "amount") {
    const { valid, cents, message } = parseAmount(value);
    const input = elements.entriesBody?.querySelector(`tr[data-entry-id="${id}"] input[data-field="amount"]`);
    if (!valid) {
      if (input) {
        input.setCustomValidity(message || "");
        input.reportValidity();
      }
      return;
    }
    if (input) {
      input.setCustomValidity("");
    }
    entry.amount = cents;
    persist();
    return;
  }
  if (field === "category") {
    if (value === "__custom__") {
      showInlineCategoryInput(id);
      return;
    }
    entry.category = value;
  } else if (field === "date") {
    entry.date = value;
  } else if (field === "note") {
    entry.note = value;
  }
  persist();
};

const showInlineCategoryInput = (id) => {
  const row = elements.entriesBody?.querySelector(`tr[data-entry-id="${id}"]`);
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
    const selectCell = row.querySelector("td:nth-child(2)");
    selectCell?.append(container);
  }
  const input = container.querySelector("input");
  input?.focus();
};

const removeInlineCategoryInput = (id) => {
  const row = elements.entriesBody?.querySelector(`tr[data-entry-id="${id}"]`);
  const container = row?.querySelector(".category-inline");
  if (container) {
    container.remove();
  }
  const select = row?.querySelector("select[data-field='category']");
  if (select) {
    select.value = "";
  }
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
      input.focus();
      return;
    }
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    entry.category = value;
    removeInlineCategoryInput(id);
    persist();
    renderEntries();
    setSelectedRow(id);
  } else if (target.matches("[data-inline-cancel]")) {
    removeInlineCategoryInput(id);
  }
};

const scrollToTracker = () => {
  elements.tracker?.scrollIntoView({ behavior: "smooth" });
};

const handleMonthChange = (value) => {
  if (!value) return;
  const [year, month] = value.split("-").map((part) => parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return;
  state.year = year;
  state.month = month;
  state.entries = loadMonth(year, month);
  state.selectedId = null;
  renderEntries();
  if (elements.deleteSelected) {
    elements.deleteSelected.disabled = true;
  }
};

const downloadJson = () => {
  const data = {
    year: state.year,
    month: state.month,
    entries: state.entries,
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

const handleImport = (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid file");
      const { year, month, entries } = parsed;
      if (!Array.isArray(entries)) throw new Error("Missing entries array");
      if (!Number.isInteger(year) || !Number.isInteger(month)) throw new Error("Missing month metadata");
      if (entries.length > MAX_ROWS) throw new Error(`Import exceeds the ${MAX_ROWS} entry limit.`);
      const normalised = entries.map((entry) => ({
        id: typeof entry.id === "string" ? entry.id : createId(),
        date: typeof entry.date === "string" ? entry.date : getToday(),
        category: typeof entry.category === "string" ? entry.category : "",
        note: typeof entry.note === "string" ? entry.note : "",
        amount: typeof entry.amount === "number" ? Math.max(0, entry.amount) : 0,
      }));
      state.year = year;
      state.month = month;
      state.entries = normalised;
      state.selectedId = null;
      syncMonthSelector();
      persist();
      renderEntries();
      if (elements.deleteSelected) {
        elements.deleteSelected.disabled = true;
      }
    } catch (error) {
      window.alert(error.message || "Could not import file.");
    }
  });
  reader.readAsText(file);
};

const useQuickCategory = (category) => {
  if (!category) return;
  if (state.selectedId) {
    const row = elements.entriesBody?.querySelector(`tr[data-entry-id="${state.selectedId}"]`);
    const select = row?.querySelector("select[data-field='category']");
    if (select && select.value !== category) {
      select.value = category;
      handleFieldUpdate(state.selectedId, "category", category);
      return;
    }
  }
  addEntry(category);
};

const initKeyboardShortcuts = () => {
  document.addEventListener("keydown", (event) => {
    const active = document.activeElement;
    const tag = active?.tagName;
    const isFormElement = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
    if (!isFormElement && event.key.toLowerCase() === "a") {
      event.preventDefault();
      addEntry();
    }
    if (event.key === "Delete") {
      const row = active?.closest?.("tr[data-entry-id]");
      if (row) {
        event.preventDefault();
        setSelectedRow(row.dataset.entryId || null);
        deleteSelectedEntry();
      }
    }
  });
};

const initEventListeners = () => {
  elements.startButton?.addEventListener("click", scrollToTracker);
  elements.monthSelector?.addEventListener("change", (event) => {
    handleMonthChange(event.target.value);
  });
  elements.addRow?.addEventListener("click", () => addEntry());
  elements.emptyAdd?.addEventListener("click", () => addEntry());
  elements.deleteSelected?.addEventListener("click", deleteSelectedEntry);
  elements.clearMonth?.addEventListener("click", () => {
    const confirmed = window.confirm("Clear all expenses for this month? This cannot be undone.");
    if (!confirmed) return;
    clearMonth(state.year, state.month);
    state.entries = [];
    state.selectedId = null;
    renderEntries();
    if (elements.deleteSelected) {
      elements.deleteSelected.disabled = true;
    }
  });
  elements.download?.addEventListener("click", downloadJson);
  elements.importButton?.addEventListener("click", () => elements.importInput?.click());
  elements.importInput?.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    handleImport(file);
    event.target.value = "";
  });
  elements.entriesBody?.addEventListener("focusin", (event) => {
    const row = event.target.closest("tr[data-entry-id]");
    if (!row) return;
    setSelectedRow(row.dataset.entryId || null);
  });
  elements.entriesBody?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    const row = target.closest("tr[data-entry-id]");
    if (!row) return;
    const id = row.dataset.entryId;
    const field = target.dataset.field;
    if (!id || !field) return;
    handleFieldUpdate(id, field, target.value);
  });
  elements.entriesBody?.addEventListener("blur", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.field === "amount") {
      const row = target.closest("tr[data-entry-id]");
      if (!row) return;
      handleFieldUpdate(row.dataset.entryId || "", "amount", target.value);
    }
  }, true);
  elements.entriesBody?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches("[data-inline-save], [data-inline-cancel]")) {
      handleInlineCategoryAction(target);
    }
  });

  const chipContainer = document.querySelector("[data-tracker] .tracker__chips");
  const customInput = document.querySelector("[data-custom-category-input]");
  const customApply = document.querySelector("[data-custom-category-apply]");
  const syncCustomButton = () => {
    if (!customInput || !customApply) return;
    const value = customInput.value.trim();
    const label = value || "Use";
    customApply.textContent = label;
    customApply.setAttribute("aria-label", value ? `Apply ${value} category` : "Apply custom category");
  };
  customInput?.addEventListener("input", syncCustomButton);
  customInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const value = customInput.value.trim();
      if (!value) {
        customInput.focus();
        return;
      }
      useQuickCategory(value);
    }
  });
  syncCustomButton();
  chipContainer?.addEventListener("click", (event) => {
    const chip = event.target.closest?.("[data-category-chip]");
    if (chip) {
      event.preventDefault();
      const category = chip.getAttribute("data-category-chip");
      if (category) {
        useQuickCategory(category);
      }
      return;
    }
    if (event.target.matches?.("[data-custom-category-apply]")) {
      event.preventDefault();
      const input = document.querySelector("[data-custom-category-input]");
      if (!input) return;
      const value = input.value.trim();
      if (!value) {
        input.focus();
        return;
      }
      useQuickCategory(value);
    }
  });
};

const init = () => {
  syncMonthSelector();
  state.entries = loadMonth(state.year, state.month);
  renderEntries();
  renderEmptyState();
  renderRowLimitNotice();
  initEventListeners();
  initKeyboardShortcuts();
};

document.addEventListener("DOMContentLoaded", init);
