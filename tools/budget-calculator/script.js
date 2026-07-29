// ===== NLrekentools maandbudgetcalculator =====

const DEFAULT_ROWS = [
  { category: "Wonen", amount: "", notes: "", noteHint: "Huur of hypotheek" },
  { category: "Energie & internet", amount: "", notes: "", noteHint: "Energie, water en internet" },
  { category: "Boodschappen & huishouden", amount: "", notes: "", noteHint: "Supermarkt en drogist" },
  { category: "Vervoer", amount: "", notes: "", noteHint: "Brandstof of openbaar vervoer" },
  { category: "Sparen & beleggen", amount: "", notes: "", noteHint: "Betaal jezelf eerst" }
];

const SAMPLE_DATA = {
  income: 3600,
  currency: "€",
  rows: [
    { category: "Wonen", amount: 1350, notes: "Huur inclusief servicekosten", noteHint: "Huur of hypotheek" },
    { category: "Energie & internet", amount: 180, notes: "Energie, water en glasvezel", noteHint: "Energie, water en internet" },
    { category: "Boodschappen & huishouden", amount: 420, notes: "Huishouden van drie personen", noteHint: "Supermarkt en drogist" },
    { category: "Vervoer", amount: 190, notes: "Treinabonnement en brandstof", noteHint: "Brandstof of openbaar vervoer" },
    { category: "Verzekeringen & zorg", amount: 220, notes: "Zorg- en autoverzekering", noteHint: "Maandelijkse premies" },
    { category: "Kinderopvang & school", amount: 250, notes: "Buitenschoolse opvang", noteHint: "Opvang en schoolkosten" },
    { category: "Abonnementen & media", amount: 65, notes: "Streaming en nieuws", noteHint: "Terugkerende diensten" },
    { category: "Uit eten & vrije tijd", amount: 160, notes: "Uitjes in het weekend", noteHint: "Restaurants en hobby's" },
    { category: "Noodbuffer", amount: 200, notes: "Aparte spaarrekening", noteHint: "Financiële buffer" },
    { category: "Pensioen & beleggen", amount: 300, notes: "Automatische overboeking", noteHint: "Pensioen en beleggingen" }
  ]
};

// DOM Elements
const rowsContainer = document.getElementById("rows");
const incomeInput = document.getElementById("income");
const currencySelect = document.getElementById("currency");
const totalExpensesEl = document.getElementById("totalExpenses");
const sumIncomeEl = document.getElementById("sumIncome");
const sumExpensesEl = document.getElementById("sumExpenses");
const sumSavingsEl = document.getElementById("sumSavings");
const savingsRateEl = document.getElementById("savingsRate");
const addRowBtn = document.getElementById("addRow");
const resetBtn = document.getElementById("reset");
const loadSampleBtn = document.getElementById("loadSample");
const exportBtn = document.getElementById("export");
const printBtn = document.getElementById("print");
const chartCanvas = document.getElementById("chart");
const legend = document.getElementById("legend");
const expenseBar = document.getElementById("expenseBar");
const budgetMessageEl = document.getElementById("budgetMessage");
const progressContainer = document.querySelector(".budget-progress-container");

// State
let chart;
let rows = [];
const STORAGE_KEY = "budget_calc_v1";

// --- Persistence ---

function saveState({ announce = true } = {}) {
  const state = {
    income: incomeInput.value,
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
      rows = state.rows || JSON.parse(JSON.stringify(DEFAULT_ROWS));
      incomeInput.value = state.income || "";
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
  const notesInput = document.createElement("input");
  notesInput.type = "text";
  notesInput.className = "form-control text-muted";
  notesInput.value = r.notes;
  notesInput.placeholder = r.noteHint || "Optionele notitie";
  notesInput.setAttribute("aria-label", `Notitie voor ${r.category || `uitgave ${i + 1}`}`);
  notesInput.style.fontSize = "0.9em";
  notesInput.addEventListener("input", e => { rows[i].notes = e.target.value; draw(); });
  tdNotes.appendChild(notesInput);
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
  rowsContainer.innerHTML = "";

  if (rows.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
        <td colspan="4" class="text-center py-5">
            <div class="text-muted mb-3">Nog geen uitgaven toegevoegd.</div>
            <button id="btn-empty-load-sample" class="button button--quiet">
                Voorbeeld laden
            </button>
        </td>
      `;
    rowsContainer.appendChild(emptyRow);

    // Bind event to the new button
    const emptyBtn = document.getElementById("btn-empty-load-sample");
    if (emptyBtn) {
      emptyBtn.addEventListener("click", () => {
        rows = JSON.parse(JSON.stringify(SAMPLE_DATA.rows));
        incomeInput.value = SAMPLE_DATA.income;
        currencySelect.value = SAMPLE_DATA.currency;
        renderRows();
        draw();
      });
    }
  } else {
    rows.forEach((r, i) => {
      const rowEl = createRowElement(r, i);
      rowsContainer.appendChild(rowEl);
    });
  }

  // Update currency symbols in new rows
  updateCurrencySymbols();
}

function totalExpenses() {
  return rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
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
  const income = Number(incomeInput.value || 0);
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

function randomColor(i) {
  const palette = [
    "#176b4d", "#4f7f6c", "#79a38f", "#b58a4b",
    "#85715e", "#47708f", "#7a6b91", "#b26b5f",
    "#66865a", "#9a7d54", "#517d7a", "#8b6874"
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

function addRow(category = "", amount = "", notes = "") {
  const newRow = { category, amount, notes, noteHint: "" };
  rows.push(newRow);
  renderRows();

  // Focus the new category input
  const lastRow = rowsContainer.lastElementChild;
  if (lastRow) {
    const input = lastRow.querySelector("input");
    if (input) input.focus();
    lastRow.classList.add("row-enter");
  }

  draw();
}

// --- Event Listeners ---

if (addRowBtn) addRowBtn.addEventListener("click", () => addRow("", "", ""));

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    if (confirm("Weet je zeker dat je alle budgetgegevens wilt wissen?")) {
      resetToDefaults();
      renderRows(); // full re-render
      // Re-init chart not strictly needed if we just update data, but good for safety
      initChart();
      draw();
    }
  });
}

if (loadSampleBtn) {
  loadSampleBtn.addEventListener("click", () => {
    rows = JSON.parse(JSON.stringify(SAMPLE_DATA.rows));
    incomeInput.value = SAMPLE_DATA.income;
    currencySelect.value = SAMPLE_DATA.currency;
    renderRows();
    draw();
  });
}

if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    const cur = currencySelect.value;
    const income = Number(incomeInput.value || 0);
    const header = ["Categorie", "Bedrag (" + cur + ")", "Notitie"].map(sanitizeCsvField);
    const lines = [header.join(",")];
    rows.forEach(r => {
      lines.push([
        sanitizeCsvField(r.category),
        sanitizeCsvField(r.amount),
        sanitizeCsvField(r.notes)
      ].join(","));
    });
    lines.push("");
    lines.push([sanitizeCsvField("Inkomen"), sanitizeCsvField(income)].join(","));
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

currencySelect.addEventListener("change", () => {
  updateCurrencySymbols();
  renderRows();
  draw();
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
initChart();
drawSummary();
drawChart();
saveState({ announce: false });
