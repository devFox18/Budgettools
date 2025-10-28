// ===== Monthly Budget Calculator (vanilla JS) =====

// Default categories (you can edit these names below)
const DEFAULT_ROWS = [
  { category: "Rent / Mortgage", amount: 900, notes: "" },
  { category: "Utilities", amount: 150, notes: "" },
  { category: "Groceries", amount: 350, notes: "" },
  { category: "Transport", amount: 120, notes: "" },
  { category: "Insurance", amount: 120, notes: "" },
  { category: "Entertainment", amount: 100, notes: "" },
  { category: "Savings", amount: 200, notes: "" }
];

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
const exportBtn = document.getElementById("export");
const printBtn = document.getElementById("print");

const chartCanvas = document.getElementById("chart");
const ctx = chartCanvas.getContext("2d");
const legend = document.getElementById("legend");

let rows = [];

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

function renderRows(){
  rowsContainer.innerHTML = "";
  rows.forEach((r,i)=>{
    const row = document.createElement("div");
    row.className = "row";

    const catEl = document.createElement("input");
    catEl.type = "text";
    catEl.value = r.category;
    catEl.placeholder = "Category";
    catEl.setAttribute("aria-label", "Expense category");

    const group = document.createElement("div");
    group.className = "input-group";

    const prefix = document.createElement("span");
    prefix.className = "prefix";
    prefix.textContent = currencySelect.value;

    const amountEl = document.createElement("input");
    amountEl.type = "number";
    amountEl.value = r.amount;
    amountEl.min = "0";
    amountEl.step = "0.01";
    amountEl.setAttribute("aria-label", "Amount");

    group.appendChild(prefix);
    group.appendChild(amountEl);

    const notesEl = document.createElement("input");
    notesEl.type = "text";
    notesEl.value = r.notes;
    notesEl.placeholder = "Notes (optional)";
    notesEl.setAttribute("aria-label", "Notes");

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove";
    removeBtn.type = "button";
    removeBtn.title = "Remove";
    removeBtn.setAttribute("aria-label", "Remove this expense row");
    removeBtn.textContent = "×";

    row.appendChild(catEl);
    row.appendChild(group);
    row.appendChild(notesEl);
    row.appendChild(removeBtn);

    catEl.addEventListener("input", e => { rows[i].category = e.target.value; draw(); });
    amountEl.addEventListener("input", e => { rows[i].amount = parseFloat(e.target.value||0); draw(); });
    notesEl.addEventListener("input", e => { rows[i].notes = e.target.value; });

    removeBtn.addEventListener("click", ()=>{
      rows.splice(i,1);
      renderRows();
      draw();
    });

    rowsContainer.appendChild(row);
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

  totalExpensesEl.textContent = fmt(expenses);
  sumIncomeEl.textContent = fmt(income);
  sumExpensesEl.textContent = fmt(expenses);
  sumSavingsEl.textContent = fmt(savings);
  savingsRateEl.textContent = rate.toFixed(0) + "%";
  sumSavingsEl.classList.toggle("positive", savings >= 0);
}

function randomColor(i){
  // deterministic pleasant colors
  const hues = [210, 260, 190, 20, 340, 120, 280, 45, 160, 0, 300, 200];
  const h = hues[i % hues.length];
  return `hsl(${h} 70% 55%)`;
}

function drawChart(){
  const data = rows.filter(r => Number(r.amount)>0);
  const total = data.reduce((s,r)=> s + Number(r.amount), 0);
  ctx.clearRect(0,0,chartCanvas.width, chartCanvas.height);
  legend.innerHTML = "";

  if (total <= 0){ return; }

  let start = -Math.PI/2;
  const cx = chartCanvas.width/2, cy = chartCanvas.height/2;
  const radius = Math.min(cx, cy) - 10;

  data.forEach((r, i) => {
    const val = Number(r.amount);
    const angle = (val/total) * Math.PI*2;
    const end = start + angle;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = randomColor(i);
    ctx.fill();

    // label
    const mid = (start+end)/2;
    const lx = cx + Math.cos(mid) * (radius*0.6);
    const ly = cy + Math.sin(mid) * (radius*0.6);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const pct = Math.round((val/total)*100);
    ctx.fillText(pct + "%", lx, ly);

    // legend
    const it = document.createElement("div");
    it.className = "item";
    it.setAttribute("role", "listitem");
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = randomColor(i);
    it.appendChild(dot);
    const label = document.createElement("span");
    label.textContent = `${r.category} (${fmt(val)})`;
    it.appendChild(label);
    legend.appendChild(it);

    start = end;
  });
}

function draw(){
  drawSummary();
  drawChart();
}

function addRow(category="", amount=0, notes=""){
  rows.push({category, amount, notes});
  renderRows();
  draw();
}

// Events
if (addRowBtn) {
  addRowBtn.addEventListener("click", () => addRow("", 0, ""));
}

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    rows = JSON.parse(JSON.stringify(DEFAULT_ROWS));
    incomeInput.value = 2500;
    currencySelect.value = "€";
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

incomeInput.addEventListener("input", draw);
currencySelect.addEventListener("change", ()=>{ renderRows(); draw(); });

// Init
rows = JSON.parse(JSON.stringify(DEFAULT_ROWS));
renderRows();
draw();
