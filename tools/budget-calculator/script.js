// ===== NLrekentools maandbudgetcalculator =====

const DEFAULT_ROWS = [
  { kind: "fixed", category: "Wonen", amount: "", notes: "", noteHint: "Huur of hypotheek" },
  { kind: "fixed", category: "Energie & internet", amount: "", notes: "", noteHint: "Energie, water en internet" },
  { kind: "fixed", category: "Verzekeringen & zorg", amount: "", notes: "", noteHint: "Maandelijkse premies" },
  { kind: "variable", category: "Boodschappen & huishouden", amount: "", notes: "", noteHint: "Supermarkt en drogist" },
  { kind: "variable", category: "Vervoer", amount: "", notes: "", noteHint: "Brandstof of openbaar vervoer" }
];

const SAMPLE_DATA = {
  income: 3600,
  extraIncome: 250,
  currency: "€",
  rows: [
    { kind: "fixed", category: "Wonen", amount: 1350, notes: "Huur inclusief servicekosten", noteHint: "Huur of hypotheek" },
    { kind: "fixed", category: "Energie & internet", amount: 180, notes: "Energie, water en glasvezel", noteHint: "Energie, water en internet" },
    { kind: "fixed", category: "Verzekeringen & zorg", amount: 220, notes: "Zorg- en autoverzekering", noteHint: "Maandelijkse premies" },
    { kind: "fixed", category: "Kinderopvang & school", amount: 250, notes: "Buitenschoolse opvang", noteHint: "Opvang en schoolkosten" },
    { kind: "fixed", category: "Abonnementen & media", amount: 65, notes: "Streaming en nieuws", noteHint: "Terugkerende diensten" },
    { kind: "variable", category: "Boodschappen & huishouden", amount: 420, notes: "Huishouden van drie personen", noteHint: "Supermarkt en drogist" },
    { kind: "variable", category: "Vervoer", amount: 190, notes: "Treinabonnement en brandstof", noteHint: "Brandstof of openbaar vervoer" },
    { kind: "variable", category: "Uit eten & vrije tijd", amount: 160, notes: "Uitjes in het weekend", noteHint: "Restaurants en hobby's" },
    { kind: "variable", category: "Noodbuffer", amount: 200, notes: "Aparte spaarrekening", noteHint: "Financiële buffer" },
    { kind: "variable", category: "Pensioen & beleggen", amount: 300, notes: "Automatische overboeking", noteHint: "Pensioen en beleggingen" }
  ]
};

// DOM Elements
const fixedRowsContainer = document.getElementById("fixedRows");
const variableRowsContainer = document.getElementById("variableRows");
const incomeInput = document.getElementById("income");
const extraIncomeInput = document.getElementById("extraIncome");
const currencySelect = document.getElementById("currency");
const totalExpensesEl = document.getElementById("totalExpenses");
const sumIncomeEl = document.getElementById("sumIncome");
const sumExpensesEl = document.getElementById("sumExpenses");
const sumSavingsEl = document.getElementById("sumSavings");
const savingsRateEl = document.getElementById("savingsRate");
const addFixedRowBtn = document.getElementById("addFixedRow");
const addVariableRowBtn = document.getElementById("addVariableRow");
const resetBtn = document.getElementById("reset");
const loadSampleBtn = document.getElementById("loadSample");
const exportBtn = document.getElementById("export");
const printBtn = document.getElementById("print");
const chartCanvas = document.getElementById("chart");
const legend = document.getElementById("legend");
const expenseBar = document.getElementById("expenseBar");
const budgetMessageEl = document.getElementById("budgetMessage");
const progressContainer = document.querySelector(".budget-progress-container");
const stepButtons = Array.from(document.querySelectorAll("[data-budget-step]"));
const stepPanels = Array.from(document.querySelectorAll("[data-step-panel]"));
const stepNavigationButtons = Array.from(document.querySelectorAll("[data-go-step]"));
const budgetActions = document.querySelector(".budget-actions");

// State
let chart;
let rows = [];
const STORAGE_KEY = "budget_calc_v1";

// --- Persistence ---

function saveState({ announce = true } = {}) {
  const state = {
    income: incomeInput.value,
    extraIncome: extraIncomeInput.value,
    currency: currencySelect.value,
    rows: rows
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const statusIndicator = document.getElementById("status-indicator");
  if (statusIndicator && announce) {
    statusIndicator.textContent = "Automatisch opgeslagen op dit apparaat.";
    statusIndicator.style.opacity = "1";
    setTimeout(() => {
      statusIndicator.style.opacity = "0";
    }, 1500);
  }
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const state = JSON.parse(saved);
      rows = Array.isArray(state.rows)
        ? state.rows.map(normalizeRow)
        : JSON.parse(JSON.stringify(DEFAULT_ROWS));
      incomeInput.value = state.income || "";
      extraIncomeInput.value = state.extraIncome || "";
      currencySelect.value = state.currency || "€";
    } catch (e) {
      console.error("Opgeslagen budget kon niet worden geladen", e);
      resetToDefaults();
    }
  } else {
    resetToDefaults();
  }
}

function resetToDefaults() {
  rows = JSON.parse(JSON.stringify(DEFAULT_ROWS));
  incomeInput.value = "";
  extraIncomeInput.value = "";
  currencySelect.value = "€";
}

// --- Helpers ---

function fmt(v) {
  const cur = currencySelect.value || "€";
  const currencyCodes = { "€": "EUR", "$": "USD", "£": "GBP" };
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currencyCodes[cur] || "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(v) || 0);
}

function sanitizeCsvField(value) {
  const str = String(value ?? "");
  const escaped = str.replace(/"/g, '""');
  // Prevent CSV injection (formulae)
  const needsFormulaEscape = /^[=+\-@]/.test(escaped);
  const safe = needsFormulaEscape ? `'${escaped}` : escaped;
  return `"${safe}"`;
}

function updateCurrencySymbols() {
  const sym = currencySelect.value;
  document.querySelectorAll('.js-currency-symbol').forEach(el => el.textContent = sym);
}

// --- UI Rendering ---

function createRowElement(r, i) {
  const tr = document.createElement("tr");
  tr.className = "expense-row";

  // Category Column
  const tdCat = document.createElement("td");
  const catInput = document.createElement("input");
  catInput.type = "text";
  catInput.className = "form-control";
  catInput.value = r.category;
  catInput.placeholder = "Naam categorie";
  catInput.setAttribute("aria-label", `Categorie ${i + 1}`);
  catInput.addEventListener("input", e => { rows[i].category = e.target.value; draw(); });
  tdCat.appendChild(catInput);
  tr.appendChild(tdCat);

  // Amount Column
  const tdAmount = document.createElement("td");
  const amountGroup = document.createElement("div");
  amountGroup.className = "input-group";

  const prefix = document.createElement("span");
  prefix.className = "input-group-text js-currency-symbol";
  prefix.textContent = currencySelect.value;

  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.className = "form-control text-end";
  amountInput.value = r.amount === "" ? "" : r.amount;
  amountInput.min = "0";
  amountInput.step = "any";
  amountInput.placeholder = "0.00";
  amountInput.setAttribute("aria-label", `Bedrag voor ${r.category || `uitgave ${i + 1}`}`);

  amountInput.addEventListener("input", e => {
    let value = e.target.value;
    if (parseFloat(value) < 0) value = "0";
    rows[i].amount = value === "" ? "" : parseFloat(value);
    draw();
  });

  amountGroup.appendChild(prefix);
  amountGroup.appendChild(amountInput);
  tdAmount.appendChild(amountGroup);
  tr.appendChild(tdAmount);

  // Notes Column
  const tdNotes = document.createElement("td");
  const notesDetails = document.createElement("details");
  notesDetails.className = "row-notes";
  notesDetails.open = Boolean(r.notes);
  const notesSummary = document.createElement("summary");
  notesSummary.textContent = r.notes ? "Notitie bekijken" : "Notitie toevoegen";
  const notesInput = document.createElement("input");
  notesInput.type = "text";
  notesInput.className = "form-control text-muted";
  notesInput.value = r.notes;
  notesInput.placeholder = r.noteHint || "Optionele notitie";
  notesInput.setAttribute("aria-label", `Notitie voor ${r.category || `uitgave ${i + 1}`}`);
  notesInput.style.fontSize = "0.9em";
  notesInput.addEventListener("input", e => {
    rows[i].notes = e.target.value;
    notesSummary.textContent = e.target.value ? "Notitie bekijken" : "Notitie toevoegen";
    draw();
  });
  notesDetails.appendChild(notesSummary);
  notesDetails.appendChild(notesInput);
  tdNotes.appendChild(notesDetails);
  tr.appendChild(tdNotes);

  // Actions Column
  const tdAction = document.createElement("td");
  tdAction.className = "text-end";
  const removeBtn = document.createElement("button");
  removeBtn.className = "btn-remove mx-auto";
  removeBtn.type = "button";
  removeBtn.innerHTML = "&times;";
  removeBtn.title = "Uitgave verwijderen";
  removeBtn.setAttribute("aria-label", `${r.category || `Uitgave ${i + 1}`} verwijderen`);
  removeBtn.addEventListener("click", () => {
    rows.splice(i, 1);
    renderRows();
    draw();
  });
  tdAction.appendChild(removeBtn);
  tr.appendChild(tdAction);

  return tr;
}

function renderRows() {
  fixedRowsContainer.innerHTML = "";
  variableRowsContainer.innerHTML = "";

  const renderGroup = (kind, container) => {
    const groupRows = rows
      .map((row, index) => ({ row, index }))
      .filter(item => item.row.kind === kind);

    if (groupRows.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
        <td colspan="4" class="text-center py-5">
            <div class="text-muted">Nog geen ${kind === "fixed" ? "vaste lasten" : "variabele uitgaven"} toegevoegd.</div>
        </td>
      `;
      container.appendChild(emptyRow);
      return;
    }

    groupRows.forEach(({ row, index }) => {
      const rowEl = createRowElement(row, index);
      container.appendChild(rowEl);
    });
  };

  renderGroup("fixed", fixedRowsContainer);
  renderGroup("variable", variableRowsContainer);

  // Update currency symbols in new rows
  updateCurrencySymbols();
}

function totalExpenses() {
  return rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

function totalIncome() {
  return Number(incomeInput.value || 0) + Number(extraIncomeInput.value || 0);
}

function updateProgressBar(income, expenses) {
  if (!expenseBar) return;

  let percent = 0;
  if (income > 0) {
    percent = (expenses / income) * 100;
  } else if (expenses > 0) {
    percent = 100; // All expenses, no income = 100% bar
  }

  expenseBar.style.width = Math.min(percent, 100) + "%";
  if (progressContainer) {
    progressContainer.setAttribute("aria-valuenow", String(Math.round(Math.min(percent, 100))));
    progressContainer.setAttribute(
      "aria-valuetext",
      income > 0 ? `${Math.round(percent)}% van het inkomen uitgegeven` : "Nog geen inkomen ingevuld"
    );
  }

  // Change color based on health
  if (expenses > income) {
    expenseBar.style.background = "var(--color-expense)";
  } else if (percent > 80) {
    expenseBar.style.background = "#fbbf24"; // warning yellow/orange
  } else {
    expenseBar.style.background = ""; // reset to default gradient
  }
}

function drawSummary() {
  const income = totalIncome();
  const expenses = totalExpenses();
  const savings = income - expenses;
  const usedRate = income > 0 ? ((expenses / income) * 100) : 0;

  const rateText = income > 0
    ? `${usedRate.toFixed(0)}% gebruikt`
    : "Nog geen inkomen";

  // Update DOM
  totalExpensesEl.textContent = fmt(expenses);
  sumIncomeEl.textContent = fmt(income);
  sumExpensesEl.textContent = fmt(expenses);
  sumSavingsEl.textContent = fmt(savings);

  // Savings Rate / Status Logic
  if (savingsRateEl) {
    savingsRateEl.textContent = rateText;
    if (income <= 0) {
      savingsRateEl.classList.add("text-muted");
      savingsRateEl.classList.remove("text-expense", "text-success");
    } else if (savings < 0) {
      savingsRateEl.classList.add("text-expense");
      savingsRateEl.classList.remove("text-success", "text-muted");
    } else {
      savingsRateEl.classList.remove("text-expense", "text-muted");
      savingsRateEl.classList.add("text-success");
    }
  }

  // Update Overview Colors
  if (savings >= 0) {
    sumSavingsEl.className = "overview-value text-saving";
  } else {
    sumSavingsEl.className = "overview-value text-expense";
  }

  if (budgetMessageEl) {
    let message = "Vul je inkomen en uitgaven in om te zien hoeveel ruimte je overhoudt.";
    let tone = "neutral";

    if (income > 0 && expenses === 0) {
      message = "Je inkomen staat erin. Voeg je vaste en variabele uitgaven toe voor een realistisch overzicht.";
    } else if (income > 0 && savings < 0) {
      message = `Je uitgaven zijn ${fmt(Math.abs(savings))} hoger dan je inkomen. Bekijk welke posten je kunt aanpassen.`;
      tone = "danger";
    } else if (income > 0 && usedRate >= 90) {
      message = `Je houdt ${fmt(savings)} over. Dat geeft weinig ruimte voor onverwachte kosten.`;
      tone = "warning";
    } else if (income > 0 && expenses > 0) {
      message = `Je houdt deze maand ${fmt(savings)} over. Dat is ${(100 - usedRate).toFixed(0)}% van je inkomen.`;
    } else if (income === 0 && expenses > 0) {
      message = "Vul je maandinkomen in om te zien of deze uitgaven binnen je budget passen.";
      tone = "warning";
    }

    budgetMessageEl.textContent = message;
    budgetMessageEl.dataset.tone = tone;
  }

  updateProgressBar(income, expenses);
}

function normalizeRow(row, index) {
  const fixedCategories = [
    "wonen", "energie", "internet", "verzekering", "zorg",
    "kinderopvang", "school", "abonnement"
  ];
  const category = String(row?.category || "");
  const inferredKind = fixedCategories.some(term => category.toLowerCase().includes(term))
    ? "fixed"
    : (index < 2 ? "fixed" : "variable");

  return {
    kind: row?.kind === "fixed" || row?.kind === "variable" ? row.kind : inferredKind,
    category,
    amount: row?.amount ?? "",
    notes: String(row?.notes || ""),
    noteHint: String(row?.noteHint || "")
  };
}

function randomColor(i) {
  const palette = [
    "#12344d", "#1c5978", "#397894", "#5c92aa",
    "#80aabd", "#a8c3cf", "#d0dfe6", "#d5a83f",
    "#b77a3b", "#7b6b91", "#6d7f52", "#955d67"
  ];
  return palette[i % palette.length];
}

function drawChart() {
  const data = rows.filter(r => Number(r.amount) > 0);
  const total = data.reduce((s, r) => s + Number(r.amount), 0);
  legend.innerHTML = "";

  const chartContainer = document.getElementById("chart-container");
  const chartEmptyState = document.getElementById("chart-empty-state");

  if (total <= 0) {
    chartContainer.style.display = "none";
    chartEmptyState.style.display = "block";
  } else {
    chartContainer.style.display = "block";
    chartEmptyState.style.display = "none";
  }

  if (!chart) return; // safety

  chart.data.labels = data.map(r => r.category);
  chart.data.datasets[0].data = data.map(r => r.amount);
  chart.data.datasets[0].backgroundColor = data.map((_, i) => randomColor(i));
  chart.update();

  // Custom Legend
  data.forEach((r, i) => {
    const item = document.createElement("div");
    item.className = "legend-item";

    const dot = document.createElement("span");
    dot.className = "legend-dot";
    dot.style.backgroundColor = randomColor(i);

    const text = document.createElement("span");
    text.textContent = `${r.category}: ${fmt(r.amount)}`;

    item.appendChild(dot);
    item.appendChild(text);
    legend.appendChild(item);
  });
}

function draw() {
  drawSummary();
  drawChart();
  saveState();
}

function addRow(kind, category = "", amount = "", notes = "") {
  const newRow = { kind, category, amount, notes, noteHint: "" };
  rows.push(newRow);
  renderRows();

  // Focus the new category input
  const targetContainer = kind === "fixed" ? fixedRowsContainer : variableRowsContainer;
  const lastRow = targetContainer.querySelector(".expense-row:last-child");
  if (lastRow) {
    const input = lastRow.querySelector("input");
    if (input) input.focus();
    lastRow.classList.add("row-enter");
  }

  draw();
}

function setActiveStep(step, { moveFocus = true } = {}) {
  const validSteps = ["income", "expenses", "summary"];
  if (!validSteps.includes(step)) return;

  stepButtons.forEach(button => {
    const isActive = button.dataset.budgetStep === step;
    button.classList.toggle("is-active", isActive);
    if (isActive) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });

  stepPanels.forEach(panel => {
    panel.hidden = panel.dataset.stepPanel !== step;
  });

  document.body.dataset.activeBudgetStep = step;

  if (step === "summary") {
    requestAnimationFrame(() => {
      if (chart) chart.resize();
      drawChart();
    });
  }

  if (moveFocus) {
    const activePanel = document.querySelector(`[data-step-panel="${step}"]`);
    const heading = activePanel?.querySelector("h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelector(".budget-flow-bar")?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start"
    });
  }
}

// --- Event Listeners ---

if (addFixedRowBtn) addFixedRowBtn.addEventListener("click", () => addRow("fixed"));
if (addVariableRowBtn) addVariableRowBtn.addEventListener("click", () => addRow("variable"));

stepButtons.forEach(button => {
  button.addEventListener("click", () => setActiveStep(button.dataset.budgetStep));
});

stepNavigationButtons.forEach(button => {
  button.addEventListener("click", () => setActiveStep(button.dataset.goStep));
});

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    if (confirm("Weet je zeker dat je alle budgetgegevens wilt wissen?")) {
      resetToDefaults();
      renderRows(); // full re-render
      // Re-init chart not strictly needed if we just update data, but good for safety
      initChart();
      draw();
      setActiveStep("income");
    }
  });
}

if (loadSampleBtn) {
  loadSampleBtn.addEventListener("click", () => {
    rows = JSON.parse(JSON.stringify(SAMPLE_DATA.rows));
    incomeInput.value = SAMPLE_DATA.income;
    extraIncomeInput.value = SAMPLE_DATA.extraIncome;
    currencySelect.value = SAMPLE_DATA.currency;
    renderRows();
    draw();
    setActiveStep("income");
  });
}

if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    const cur = currencySelect.value;
    const primaryIncome = Number(incomeInput.value || 0);
    const extraIncome = Number(extraIncomeInput.value || 0);
    const income = primaryIncome + extraIncome;
    const header = ["Soort", "Categorie", "Bedrag (" + cur + ")", "Notitie"].map(sanitizeCsvField);
    const lines = [header.join(",")];
    rows.forEach(r => {
      lines.push([
        sanitizeCsvField(r.kind === "fixed" ? "Vaste last" : "Variabele uitgave"),
        sanitizeCsvField(r.category),
        sanitizeCsvField(r.amount),
        sanitizeCsvField(r.notes)
      ].join(","));
    });
    lines.push("");
    lines.push([sanitizeCsvField("Netto maandinkomen"), sanitizeCsvField(primaryIncome)].join(","));
    lines.push([sanitizeCsvField("Overige inkomsten"), sanitizeCsvField(extraIncome)].join(","));
    lines.push([sanitizeCsvField("Totaal inkomen"), sanitizeCsvField(income)].join(","));
    lines.push([sanitizeCsvField("Totale uitgaven"), sanitizeCsvField(totalExpenses())].join(","));
    lines.push([sanitizeCsvField("Resterend"), sanitizeCsvField(income - totalExpenses())].join(","));

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nlrekentools-maandbudget.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

if (printBtn) {
  printBtn.addEventListener("click", () => window.print());
}

incomeInput.addEventListener("input", (e) => {
  if (e.target.value < 0) e.target.value = 0;
  draw();
});

extraIncomeInput.addEventListener("input", (e) => {
  if (e.target.value < 0) e.target.value = 0;
  draw();
});

currencySelect.addEventListener("change", () => {
  updateCurrencySymbols();
  renderRows();
  draw();
});

document.querySelectorAll(".budget-actions button").forEach(button => {
  button.addEventListener("click", () => {
    if (budgetActions) budgetActions.open = false;
  });
});

// --- Initialization ---

function initChart() {
  if (chart) chart.destroy();
  if (typeof Chart === "undefined") {
    const chartContainer = document.getElementById("chart-container");
    if (chartContainer) chartContainer.hidden = true;
    return;
  }
  const ctx = chartCanvas.getContext("2d");
  chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              let label = context.label || '';
              if (label) label += ': ';
              if (context.parsed !== null) label += fmt(context.parsed);
              return label;
            }
          }
        }
      },
      cutout: '65%' // Thinner doughnut
    }
  });
}

// Start
loadState();
renderRows();
setActiveStep("income", { moveFocus: false });
initChart();
drawSummary();
drawChart();
saveState({ announce: false });
