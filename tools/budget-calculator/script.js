// ===== Monthly Budget Calculator (Improved UX) =====

const DEFAULT_ROWS = [
  { category: "Housing", amount: "", notes: "", noteHint: "Rent or mortgage" },
  { category: "Utilities & Internet", amount: "", notes: "", noteHint: "Energy, water, wifi" },
  { category: "Groceries & Household", amount: "", notes: "", noteHint: "Supermarket, toiletries" },
  { category: "Transport", amount: "", notes: "", noteHint: "Fuel, transit passes" },
  { category: "Savings & Investments", amount: "", notes: "", noteHint: "Pay yourself first" }
];

const SAMPLE_DATA = {
  income: 3600,
  currency: "€",
  rows: [
    { category: "Housing", amount: 1350, notes: "Rent incl. service costs", noteHint: "Rent or mortgage" },
    { category: "Utilities & Internet", amount: 180, notes: "Electricity, water, fibre", noteHint: "Energy, water, wifi" },
    { category: "Groceries & Household", amount: 420, notes: "Family of three", noteHint: "Supermarket, toiletries" },
    { category: "Transport", amount: 190, notes: "Train pass + fuel", noteHint: "Fuel, transit passes" },
    { category: "Insurance & Healthcare", amount: 220, notes: "Health + car insurance", noteHint: "Monthly premiums" },
    { category: "Childcare & School", amount: 250, notes: "After-school care", noteHint: "Daycare, tuition" },
    { category: "Subscriptions & Media", amount: 65, notes: "Streaming + news", noteHint: "Recurring services" },
    { category: "Eating Out & Fun", amount: 160, notes: "Weekends out", noteHint: "Restaurants, hobbies" },
    { category: "Emergency Fund", amount: 200, notes: "Separate savings account", noteHint: "Savings buffer" },
    { category: "Retirement & Investments", amount: 300, notes: "Automatic transfer", noteHint: "Pension, ETF" }
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

// State
let chart;
let rows = [];
const STORAGE_KEY = "budget_calc_v1";

// --- Persistence ---

function saveState() {
  const state = {
    income: incomeInput.value,
    currency: currencySelect.value,
    rows: rows
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const statusIndicator = document.getElementById("status-indicator");
  if (statusIndicator) {
    statusIndicator.textContent = "Saved to local storage.";
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
      console.error("Failed to parse saved state", e);
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
  return cur + (Number(v) || 0).toFixed(2);
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
  catInput.placeholder = "Category Name";
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
  amountInput.className = "form-control text-end"; // align numbers right
  amountInput.value = r.amount === "" ? "" : r.amount;
  amountInput.min = "0";
  amountInput.step = "any";
  amountInput.placeholder = "0.00";

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
  notesInput.placeholder = r.noteHint || "Optional notes";
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
  removeBtn.title = "Remove row";
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
  rows.forEach((r, i) => {
    const rowEl = createRowElement(r, i);
    rowsContainer.appendChild(rowEl);
  });
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
    // Cap visual bar at 100% (or allow overflow logic if desired, but 100% is safer for layout)
    // Let's cap at 100% for the width, but maybe change color if over budget.
  } else if (expenses > 0) {
    percent = 100; // All expenses, no income = 100% bar
  }

  expenseBar.style.width = Math.min(percent, 100) + "%";

  // Change color based on health
  if (expenses > income && income > 0) {
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
  const rate = income > 0 ? ((savings / income) * 100) : 0;

  // Format Rate Display
  const rateText = savings >= 0
    ? `${Math.max(0, rate).toFixed(0)}% Saved`
    : `Over budget`;

  // Update DOM
  totalExpensesEl.textContent = fmt(expenses);
  sumIncomeEl.textContent = fmt(income);
  sumExpensesEl.textContent = fmt(expenses);
  sumSavingsEl.textContent = fmt(savings);

  // Savings Rate / Status Logic
  if (savingsRateEl) {
    savingsRateEl.textContent = rateText;
    if (savings < 0) {
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

  updateProgressBar(income, expenses);
}

function randomColor(i) {
  const hues = [210, 260, 190, 20, 340, 120, 280, 45, 160, 0, 300, 200];
  const h = hues[i % hues.length];
  return `hsl(${h} 70% 55%)`;
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
    item.className = "d-flex align-items-center small border rounded px-2 py-1 bg-white shadow-sm";

    const dot = document.createElement("span");
    dot.style.width = "10px";
    dot.style.height = "10px";
    dot.style.borderRadius = "50%";
    dot.style.backgroundColor = randomColor(i);
    dot.style.marginRight = "8px";

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
    if (confirm("Are you sure you want to reset all data?")) {
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
    const header = ["Category", "Amount(" + cur + ")", "Notes"].map(sanitizeCsvField);
    const lines = [header.join(",")];
    rows.forEach(r => {
      lines.push([
        sanitizeCsvField(r.category),
        sanitizeCsvField(r.amount),
        sanitizeCsvField(r.notes)
      ].join(","));
    });
    lines.push("");
    lines.push([sanitizeCsvField("Income"), sanitizeCsvField(income)].join(","));
    lines.push([sanitizeCsvField("Total Expenses"), sanitizeCsvField(totalExpenses())].join(","));
    lines.push([sanitizeCsvField("Savings"), sanitizeCsvField(income - totalExpenses())].join(","));

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "budget-summary.csv";
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
draw();
