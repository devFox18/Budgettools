// ===== Monthly Budget Calculator (vanilla JS) =====

// Default categories give structure but start empty so users can type without clearing values.
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

let chart; // To hold the Chart.js instance

const STORAGE_KEY = 'budget-calculator-data';
let rows = [];

function saveState() {
  const state = {
    income: incomeInput.value,
    currency: currencySelect.value,
    rows: rows
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const statusIndicator = document.getElementById("status-indicator");
  if (statusIndicator) {
    statusIndicator.textContent = "Saving...";
    statusIndicator.style.opacity = "1";
    setTimeout(() => {
      statusIndicator.textContent = "Saved.";
      setTimeout(() => {
        statusIndicator.style.opacity = "0";
      }, 1000);
    }, 500);
  }
}


// Make the income field step per €1 via spinner
if (incomeInput) {
  incomeInput.step = "1";
}

// Helpers
function fmt(v){
  const cur = currencySelect.value || "€";
  return cur + (Number(v)||0).toFixed(2);
}

function sanitizeCsvField(value){
  const str = String(value ?? "");
  const escaped = str.replace(/"/g, '""');
  const needsFormulaEscape = /^[=+\-@]/.test(escaped);
  const safe = needsFormulaEscape ? `'${escaped}` : escaped;
  return `"${safe}"`;
}

function createRowElement(r, i) {
    const row = document.createElement("div");
    row.className = "row mb-4";

    const catEl = document.createElement("input");
    catEl.type = "text";
    catEl.value = r.category;
    catEl.placeholder = "e.g., Rent, Groceries";
    catEl.setAttribute("aria-label", "Expense category"); catEl.classList.add("p-3");

    const group = document.createElement("div");
    group.className = "input-group";

    const prefix = document.createElement("span");
    prefix.className = "prefix";
    prefix.textContent = currencySelect.value;

    const amountEl = document.createElement("input");
    amountEl.type = "number";
    amountEl.value = r.amount === "" ? "" : r.amount;
    amountEl.min = "0";
    amountEl.step = "1"; // step per €1 with the arrow keys/spinner
    amountEl.setAttribute("aria-label", "Amount"); amountEl.classList.add("p-3");
    amountEl.placeholder = "0.00";

    group.appendChild(prefix);
    group.appendChild(amountEl);

    const notesEl = document.createElement("input");
    notesEl.type = "text";
    notesEl.value = r.notes;
    notesEl.placeholder = r.noteHint || "Notes (optional)";
    notesEl.setAttribute("aria-label", "Notes"); notesEl.classList.add("p-3");

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove btn btn--ghost";
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", "Remove this expense row");

    const removeIcon = document.createElement("span");
    removeIcon.setAttribute("aria-hidden", "true");
    removeIcon.textContent = "×";

    const removeText = document.createElement("span");
    removeText.className = "sr-only";
    removeText.textContent = "Remove row";

    removeBtn.appendChild(removeIcon);
    removeBtn.appendChild(removeText);

    row.appendChild(catEl);
    row.appendChild(group);
    row.appendChild(notesEl);
    row.appendChild(removeBtn);

    catEl.addEventListener("input", e => { rows[i].category = e.target.value; draw(); });
    amountEl.addEventListener("input", e => {
      let value = e.target.value;
      if (parseFloat(value) < 0) {
        value = "0";
        e.target.value = value;
      }
      rows[i].amount = value === "" ? "" : parseFloat(value);
      draw();
    });
    notesEl.addEventListener("input", e => { rows[i].notes = e.target.value; draw(); });

    removeBtn.addEventListener("click", ()=>{
      rows.splice(i,1);
      renderRows();
      draw();
    });

    return row;
}

function renderRows(){
  rowsContainer.innerHTML = "";
  rows.forEach((r,i)=>{
    const rowEl = createRowElement(r, i);
    rowsContainer.appendChild(rowEl);
  });
}

function totalExpenses(){
  return rows.reduce((s,r)=> s + (Number(r.amount)||0), 0);
}

function drawSummary(){
  const income = Number(incomeInput.value||0);
  const expenses = totalExpenses();
  const savings = income - expenses;
  const rate = income>0 ? Math.max(0,(savings/income)*100) : 0;

  const elementsToAnimate = [totalExpensesEl, sumIncomeEl, sumExpensesEl, sumSavingsEl, savingsRateEl];
  elementsToAnimate.forEach(el => el.classList.remove('fade-in'));

  totalExpensesEl.textContent = fmt(expenses);
  sumIncomeEl.textContent = fmt(income);
  sumExpensesEl.textContent = fmt(expenses);
  sumSavingsEl.textContent = fmt(savings);
  savingsRateEl.textContent = rate.toFixed(0) + "%";

  elementsToAnimate.forEach(el => el.classList.add('fade-in'));

  sumSavingsEl.classList.remove('highlight-value', 'highlight-value-red');
  sumExpensesEl.classList.remove('highlight-value');
  totalExpensesEl.classList.remove('highlight-value');

  if (savings >= 0) {
    sumSavingsEl.classList.add('highlight-value');
    sumSavingsEl.classList.remove('negative');
    sumSavingsEl.classList.add('positive');
  } else {
    sumSavingsEl.classList.add('highlight-value-red');
    sumSavingsEl.classList.remove('positive');
    sumSavingsEl.classList.add('negative');
  }
  sumExpensesEl.classList.add('highlight-value');
  totalExpensesEl.classList.add('highlight-value');

  setTimeout(() => {
    sumSavingsEl.classList.remove('highlight-value', 'highlight-value-red');
    sumExpensesEl.classList.remove('highlight-value');
    totalExpensesEl.classList.remove('highlight-value');
    elementsToAnimate.forEach(el => el.classList.remove('fade-in'));
  }, 1000);
}

function randomColor(i){
  // deterministic pleasant colors
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

    chart.data.labels = data.map(r => r.category);
    chart.data.datasets[0].data = data.map(r => r.amount);
    chart.data.datasets[0].backgroundColor = data.map((_, i) => randomColor(i));
    chart.update();

    data.forEach((r, i) => {
        const it = document.createElement("div");
        it.className = "item";
        it.setAttribute("role", "listitem");

        const labelLine = document.createElement("span");
        labelLine.className = "legend__label";

        const dot = document.createElement("span");
        dot.className = "dot";
        dot.style.background = randomColor(i);
        labelLine.appendChild(dot);

        const labelText = document.createElement("span");
        labelText.textContent = `${r.category} (${fmt(r.amount)})`;
        labelLine.appendChild(labelText);

        it.appendChild(labelLine);

        const detailText = (r.notes && r.notes.trim()) || r.noteHint || "";
        if (detailText) {
            const detail = document.createElement("span");
            detail.className = "legend__note";
            detail.textContent = `Note: ${detailText}`;
            it.appendChild(detail);
        }
        legend.appendChild(it);
    });
}

function draw(){
  drawSummary();
  drawChart();
  saveState();
}

function addRow(category="", amount="", notes=""){
  const newRow = {category, amount, notes, noteHint: ""};
  rows.push(newRow);
  const newRowEl = createRowElement(newRow, rows.length - 1);
  newRowEl.classList.add("row-enter");
  rowsContainer.appendChild(newRowEl);
  draw();
}

// Events
if (addRowBtn) {
  addRowBtn.addEventListener("click", () => addRow("", 0, ""));
}

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    rows = JSON.parse(JSON.stringify(DEFAULT_ROWS));
    incomeInput.value = "";
    incomeInput.step = "1"; // keep reset consistent
    currencySelect.value = "€";
    renderRows();
    initChart();
    draw();
  });
}

if (loadSampleBtn) {
  loadSampleBtn.addEventListener("click", () => {
    rows = JSON.parse(JSON.stringify(SAMPLE_DATA.rows));
    incomeInput.value = SAMPLE_DATA.income;
    incomeInput.step = "1";
    currencySelect.value = SAMPLE_DATA.currency;
    renderRows();
    draw();
  });
}

if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    const cur = currencySelect.value;
    const income = Number(incomeInput.value||0);
    const header = ["Category","Amount("+cur+")","Notes"].map(sanitizeCsvField);
    const lines = [header.join(",")];
    rows.forEach(r=>{
      lines.push([
        sanitizeCsvField(r.category),
        sanitizeCsvField(r.amount),
        sanitizeCsvField(r.notes)
      ].join(","));
    });
    lines.push("");
    lines.push([sanitizeCsvField("Income"), sanitizeCsvField(income)].join(","));
    const expenses = totalExpenses();
    lines.push([sanitizeCsvField("Total Expenses"), sanitizeCsvField(expenses)].join(","));
    lines.push([sanitizeCsvField("Savings"), sanitizeCsvField(income - expenses)].join(","));

    const blob = new Blob([lines.join("\n")], {type:"text/csv"});
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
    if (e.target.value < 0) {
        e.target.value = 0;
    }
    draw();
});
currencySelect.addEventListener("change", ()=>{ renderRows(); draw(); });

// Init
function initChart() {
    if (chart) {
        chart.destroy();
    }
    const ctx = chartCanvas.getContext("2d");
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += fmt(context.parsed);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function loadState() {
  const savedState = localStorage.getItem(STORAGE_KEY);
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      rows = state.rows || JSON.parse(JSON.stringify(DEFAULT_ROWS));
      incomeInput.value = state.income || "";
      currencySelect.value = state.currency || "€";
    } catch (e) {
      console.error("Failed to parse saved state:", e);
      // If parsing fails, fall back to default state
      rows = JSON.parse(JSON.stringify(DEFAULT_ROWS));
      incomeInput.value = "";
    }
  } else {
    // No saved state, use defaults
    rows = JSON.parse(JSON.stringify(DEFAULT_ROWS));
    incomeInput.value = "";
  }
  renderRows();
  initChart();
  draw();
}

loadState();
