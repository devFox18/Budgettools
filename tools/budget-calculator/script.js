// ===== Monthly Budget Calculator (vanilla JS) =====

const STORAGE_KEY = "budgettools:monthly-budget:v2";
const ONBOARDING_KEY = "budgettools:monthly-budget:onboarding";
const SAMPLE_INCOME = 3600;

const PLACEHOLDER_EXAMPLES = [
  { category: "Rent / Mortgage", amount: 1200, note: "Housing costs" },
  { category: "Utilities & Internet", amount: 200, note: "Energy, water, wifi" },
  { category: "Groceries & Household", amount: 350, note: "Food & essentials" },
  { category: "Transport", amount: 120, note: "Fuel, transit passes" },
  { category: "Insurance", amount: 90, note: "Health, home, or auto" },
  { category: "Subscriptions", amount: 30, note: "Streaming, apps" },
  { category: "Savings & Investments", amount: 300, note: "Pay yourself first" }
];

const SAMPLE_DATA = [
  { category: "Rent / Mortgage", amount: 1200, notes: "" },
  { category: "Utilities", amount: 200, notes: "" },
  { category: "Groceries", amount: 350, notes: "" },
  { category: "Transport", amount: 120, notes: "" },
  { category: "Insurance", amount: 90, notes: "" },
  { category: "Subscriptions", amount: 30, notes: "" },
  { category: "Savings & Investments", amount: 300, notes: "" }
];

const rowsContainer = document.getElementById("rows");
const incomeInput = document.getElementById("income");
const incomePrefix = document.querySelector("[data-income-prefix]");
const currencySelect = document.getElementById("currency");
const totalExpensesEl = document.getElementById("totalExpenses");
const sumIncomeEl = document.getElementById("sumIncome");
const sumExpensesEl = document.getElementById("sumExpenses");
const sumSavingsEl = document.getElementById("sumSavings");
const savingsRateEl = document.getElementById("savingsRate");
const addRowBtn = document.getElementById("addRow");
const resetBtn = document.getElementById("reset");
const exportBtn = document.getElementById("export");
const printBtn = document.getElementById("print");
const loadSampleBtn = document.getElementById("loadSample");
const startScratchBtn = document.getElementById("startScratch");
const introCard = document.getElementById("intro-card");
const introStartBtn = document.getElementById("intro-start");
const introDismissBtn = document.getElementById("intro-dismiss");
const expensesEmptyState = document.getElementById("expensesEmptyState");
const chartEmptyState = document.getElementById("chartEmptyState");
const chartCanvas = document.getElementById("chart");
const legend = document.getElementById("legend");
const ctx = chartCanvas ? chartCanvas.getContext("2d") : null;

let rows = [];
let placeholderCursor = 0;
let updateTimeout;

if (!rowsContainer || !incomeInput || !currencySelect) {
  console.warn("BudgetTools: calculator initialisation skipped (missing elements).");
}

function getPlaceholder(index) {
  const safeIndex = index % PLACEHOLDER_EXAMPLES.length;
  return PLACEHOLDER_EXAMPLES[safeIndex];
}

function nextPlaceholderIndex() {
  const index = placeholderCursor % PLACEHOLDER_EXAMPLES.length;
  placeholderCursor += 1;
  return index;
}

function createRow(data = {}) {
  const placeholderIndex = typeof data.placeholderIndex === "number"
    ? data.placeholderIndex % PLACEHOLDER_EXAMPLES.length
    : nextPlaceholderIndex();

  const amountValue = data.amount === "" || data.amount === undefined
    ? ""
    : Number(data.amount);

  return {
    category: data.category ? String(data.category) : "",
    amount: Number.isFinite(amountValue) ? amountValue : "",
    notes: data.notes ? String(data.notes) : "",
    placeholderIndex
  };
}

function fmt(value) {
  const currency = currencySelect.value || "€";
  const amount = Number(value) || 0;
  const sign = amount < 0 ? "-" : "";
  return `${sign}${currency}${Math.abs(amount).toFixed(2)}`;
}

function sanitizeCsvField(value) {
  const str = String(value ?? "");
  const escaped = str.replace(/"/g, '""');
  const needsFormulaEscape = /^[=+\-@]/.test(escaped);
  const safe = needsFormulaEscape ? `'${escaped}` : escaped;
  return `"${safe}"`;
}

function totalExpenses() {
  return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

function updateExpensesEmptyState() {
  if (!expensesEmptyState) return;
  if (rows.length === 0) {
    expensesEmptyState.classList.remove("is-hidden");
  } else {
    expensesEmptyState.classList.add("is-hidden");
  }
}

function renderRows() {
  rowsContainer.innerHTML = "";

  rows.forEach((row, index) => {
    const placeholder = getPlaceholder(row.placeholderIndex);
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.setAttribute("role", "row");

    const categoryInput = document.createElement("input");
    categoryInput.type = "text";
    categoryInput.value = row.category;
    categoryInput.placeholder = placeholder.category;
    categoryInput.setAttribute("aria-label", "Expense category");

    const group = document.createElement("div");
    group.className = "input-group";

    const prefix = document.createElement("span");
    prefix.className = "prefix";
    prefix.setAttribute("aria-hidden", "true");
    prefix.textContent = currencySelect.value;

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.inputMode = "decimal";
    amountInput.step = "0.01";
    amountInput.min = "0";
    amountInput.value = row.amount === "" ? "" : row.amount;
    amountInput.placeholder = `${currencySelect.value} ${placeholder.amount} (example)`;
    amountInput.setAttribute("aria-label", "Amount");

    group.appendChild(prefix);
    group.appendChild(amountInput);

    const notesInput = document.createElement("input");
    notesInput.type = "text";
    notesInput.value = row.notes;
    notesInput.placeholder = placeholder.note ? `${placeholder.note} (optional)` : "Notes (optional)";
    notesInput.setAttribute("aria-label", "Notes");

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove";
    removeBtn.type = "button";
    removeBtn.title = "Remove";
    removeBtn.setAttribute("aria-label", "Remove this expense row");
    removeBtn.textContent = "×";

    categoryInput.addEventListener("input", (event) => {
      rows[index].category = event.target.value;
      scheduleUpdate();
    });

    amountInput.addEventListener("input", (event) => {
      const value = event.target.value;
      rows[index].amount = value === "" ? "" : Number(value);
      scheduleUpdate();
    });

    notesInput.addEventListener("input", (event) => {
      rows[index].notes = event.target.value;
      scheduleUpdate();
    });

    removeBtn.addEventListener("click", () => {
      rows.splice(index, 1);
      renderRows();
      scheduleUpdate();
    });

    rowEl.appendChild(categoryInput);
    rowEl.appendChild(group);
    rowEl.appendChild(notesInput);
    rowEl.appendChild(removeBtn);
    rowsContainer.appendChild(rowEl);
  });

  updateExpensesEmptyState();
}

function updateIncomePlaceholder() {
  const currency = currencySelect.value || "€";
  if (incomePrefix) {
    incomePrefix.textContent = currency;
  }
  incomeInput.placeholder = `${currency} 3600 (example)`;
}

function updateOverview() {
  drawSummary();
  drawChart();
}

function drawSummary() {
  const income = Number(incomeInput.value) || 0;
  const expenses = totalExpenses();
  const savings = income - expenses;
  const rate = income > 0 ? (savings / income) * 100 : 0;

  totalExpensesEl.textContent = fmt(expenses);
  sumIncomeEl.textContent = fmt(income);
  sumExpensesEl.textContent = fmt(expenses);
  sumSavingsEl.textContent = fmt(savings);

  sumSavingsEl.classList.remove("positive", "negative");
  sumSavingsEl.classList.add(savings >= 0 ? "positive" : "negative");

  savingsRateEl.textContent = `${rate.toFixed(0)}%`;
}

function randomColor(index) {
  const hues = [210, 260, 190, 20, 340, 120, 280, 45, 160, 0, 300, 200];
  const hue = hues[index % hues.length];
  return `hsl(${hue} 70% 55%)`;
}

function drawChart() {
  if (!ctx || !chartCanvas || !legend) return;

  const data = rows.filter((row) => Number(row.amount) > 0);
  const total = data.reduce((sum, row) => sum + Number(row.amount), 0);

  ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
  legend.innerHTML = "";

  if (total <= 0) {
    if (chartEmptyState) {
      chartEmptyState.classList.remove("is-hidden");
    }
    chartCanvas.setAttribute("aria-hidden", "true");
    legend.setAttribute("hidden", "true");
    return;
  }

  chartCanvas.setAttribute("aria-hidden", "false");
  legend.removeAttribute("hidden");
  if (chartEmptyState) {
    chartEmptyState.classList.add("is-hidden");
  }

  let start = -Math.PI / 2;
  const cx = chartCanvas.width / 2;
  const cy = chartCanvas.height / 2;
  const radius = Math.min(cx, cy) - 10;

  data.forEach((row, index) => {
    const value = Number(row.amount);
    const angle = (value / total) * Math.PI * 2;
    const end = start + angle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = randomColor(index);
    ctx.fill();

    const mid = (start + end) / 2;
    const labelX = cx + Math.cos(mid) * (radius * 0.6);
    const labelY = cy + Math.sin(mid) * (radius * 0.6);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const percentage = Math.round((value / total) * 100);
    ctx.fillText(`${percentage}%`, labelX, labelY);

    const legendItem = document.createElement("div");
    legendItem.className = "item";
    legendItem.setAttribute("role", "listitem");

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = randomColor(index);

    const label = document.createElement("span");
    label.textContent = `${row.category || "Unnamed"} (${fmt(value)})`;

    legendItem.appendChild(dot);
    legendItem.appendChild(label);
    legend.appendChild(legendItem);

    start = end;
  });
}

function persistState() {
  try {
    const payload = {
      currency: currencySelect.value,
      income: incomeInput.value,
      rows: rows.map((row) => ({
        category: row.category,
        amount: row.amount,
        notes: row.notes,
        placeholderIndex: row.placeholderIndex
      })),
      placeholderCursor
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Ignore storage errors (e.g., private mode).
  }
}

function scheduleUpdate() {
  window.clearTimeout(updateTimeout);
  updateTimeout = window.setTimeout(() => {
    updateOverview();
    persistState();
  }, 100);
}

function loadSampleData() {
  rows = SAMPLE_DATA.map((item, index) => createRow({
    category: item.category,
    amount: item.amount,
    notes: item.notes,
    placeholderIndex: index
  }));
  placeholderCursor = rows.length;
  incomeInput.value = SAMPLE_INCOME;
  updateIncomePlaceholder();
  renderRows();
  scheduleUpdate();
  dismissOnboarding();
}

function startFromScratch({ resetCurrency = false } = {}) {
  rows = [];
  placeholderCursor = 0;
  incomeInput.value = "";
  if (resetCurrency) {
    currencySelect.value = "€";
  }
  updateIncomePlaceholder();
  renderRows();
  scheduleUpdate();
  dismissOnboarding();
}

function hydrateFromStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      updateIncomePlaceholder();
      renderRows();
      updateOverview();
      return;
    }

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (parsed.currency) {
        currencySelect.value = parsed.currency;
      }
      if (typeof parsed.income === "string" || typeof parsed.income === "number") {
        incomeInput.value = parsed.income;
      }
      placeholderCursor = typeof parsed.placeholderCursor === "number" ? parsed.placeholderCursor : 0;

      if (Array.isArray(parsed.rows)) {
        rows = parsed.rows.map((row, index) => createRow({
          category: row.category,
          amount: row.amount,
          notes: row.notes,
          placeholderIndex: typeof row.placeholderIndex === "number" ? row.placeholderIndex : index
        }));
      }
    }
  } catch (error) {
    rows = [];
  }

  updateIncomePlaceholder();
  renderRows();
  updateOverview();
}

function dismissOnboarding() {
  if (introCard && !introCard.hidden) {
    introCard.hidden = true;
  }
  try {
    window.localStorage.setItem(ONBOARDING_KEY, "seen");
  } catch (error) {
    // ignore
  }
}

function initOnboarding() {
  if (!introCard) return;

  let hasSeen = false;
  try {
    hasSeen = window.localStorage.getItem(ONBOARDING_KEY) === "seen";
  } catch (error) {
    hasSeen = false;
  }

  const shouldShow = !hasSeen && rows.length === 0 && incomeInput.value === "";
  introCard.hidden = !shouldShow;

  const markSeen = () => {
    dismissOnboarding();
  };

  if (introDismissBtn) {
    introDismissBtn.addEventListener("click", markSeen);
  }

  if (introStartBtn) {
    introStartBtn.addEventListener("click", () => {
      markSeen();
      incomeInput.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        incomeInput.focus({ preventScroll: true });
      }, 400);
    });
  }
}

if (rowsContainer && incomeInput && currencySelect) {
  // Event bindings
  if (addRowBtn) {
    addRowBtn.addEventListener("click", () => {
      rows.push(createRow());
      renderRows();
      scheduleUpdate();
      window.requestAnimationFrame(() => {
        const lastRowCategory = rowsContainer.querySelector(".row:last-of-type input[type='text']");
        if (lastRowCategory) {
          lastRowCategory.focus();
        }
      });
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      startFromScratch({ resetCurrency: true });
    });
  }

  if (loadSampleBtn) {
    loadSampleBtn.addEventListener("click", loadSampleData);
  }

  if (startScratchBtn) {
    startScratchBtn.addEventListener("click", () => startFromScratch());
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const currency = currencySelect.value;
      const income = Number(incomeInput.value) || 0;
      const header = ["Category", `Amount (${currency})`, "Notes"].map(sanitizeCsvField);
      const lines = [header.join(",")];

      rows.forEach((row) => {
        lines.push([
          sanitizeCsvField(row.category),
          sanitizeCsvField(row.amount),
          sanitizeCsvField(row.notes)
        ].join(","));
      });

      lines.push("");
      lines.push([sanitizeCsvField("Income"), sanitizeCsvField(income)].join(","));
      const expenses = totalExpenses();
      lines.push([sanitizeCsvField("Total Expenses"), sanitizeCsvField(expenses)].join(","));
      lines.push([sanitizeCsvField("Savings"), sanitizeCsvField(income - expenses)].join(","));

      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "budget-summary.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    });
  }

  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }

  incomeInput.addEventListener("input", scheduleUpdate);

  currencySelect.addEventListener("change", () => {
    updateIncomePlaceholder();
    renderRows();
    scheduleUpdate();
  });

  // Initialise
  hydrateFromStorage();
  initOnboarding();

  updateExpensesEmptyState();

  if (rows.length === 0) {
    scheduleUpdate();
  }
}
