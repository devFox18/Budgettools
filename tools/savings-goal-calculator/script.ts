/*
 * BudgetTools Savings Goal Calculator
 * All calculations happen on the client.
 */

type CalculatorMode = 'time' | 'monthly';
type CompoundingFrequency = 'monthly' | 'quarterly' | 'yearly';
type SupportedCurrency = 'EUR' | 'USD' | 'GBP';

interface ProjectionRow {
  monthIndex: number;
  date: Date;
  startingBalance: number;
  contribution: number;
  interestEarned: number;
  endingBalance: number;
}

interface InflationBreakdown {
  realGoalValue: number;
  realEndingBalance: number;
  realContributions: number;
  realInterest: number;
}

export interface CalculatedSummary {
  mode: CalculatorMode;
  months: number;
  finishDate?: Date;
  requiredMonthlyContribution?: number;
  totalContributions: number;
  totalInterest: number;
  projection: ProjectionRow[];
  inflation?: InflationBreakdown;
}

export interface SavingsCalculatorProps {
  mode?: CalculatorMode;
  defaultCurrency?: SupportedCurrency;
  defaultLocale?: string;
  onCalculated?(summary: CalculatedSummary | null): void;
  sendReport?(email: string, csv: Blob, pdf: Blob): Promise<void>;
}

interface CalculatorState {
  mode: CalculatorMode;
  goalAmount: number | null;
  currentSavings: number;
  monthlyContribution: number | null;
  targetDate: string;
  apr: number;
  compounding: CompoundingFrequency;
  inflationRate: number | null;
  currency: SupportedCurrency;
  locale: string;
  rememberInputs: boolean;
}

interface ModeAResult extends CalculatedSummary {
  mode: 'time';
  finishDate: Date;
  months: number;
  requiredMonthlyContribution?: number;
}

interface ModeBResult extends CalculatedSummary {
  mode: 'monthly';
  requiredMonthlyContribution: number;
}

interface ScenarioInput {
  mode: CalculatorMode;
  goalAmount: number;
  currentSavings: number;
  monthlyContribution?: number | null;
  targetDate?: Date | null;
  apr: number;
  compounding: CompoundingFrequency;
  inflationRate?: number | null;
  startDate?: Date;
}

const STORAGE_KEY = 'bt-savings-calculator';
const MAX_MONTHS = 600; // 50 years

const DEFAULT_STATE: CalculatorState = {
  mode: 'time',
  goalAmount: null,
  currentSavings: 0,
  monthlyContribution: null,
  targetDate: '',
  apr: 0,
  compounding: 'monthly',
  inflationRate: null,
  currency: 'EUR',
  locale: 'nl-NL',
  rememberInputs: false,
};

const LOCALES = [
  'nl-NL',
  'en-US',
  'en-GB',
  'de-DE',
  'fr-FR',
  'es-ES',
];

const CURRENCIES: SupportedCurrency[] = ['EUR', 'USD', 'GBP'];

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function safeParseNumber(value: string): number | null {
  if (value === '') {
    return null;
  }
  const normalised = value.replace(/[^0-9,\.\-]/g, '').replace(',', '.');
  if (normalised === '' || normalised === '-' || normalised === '.') {
    return null;
  }
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : null;
}

function addMonths(date: Date, count: number): Date {
  const copy = new Date(date.getTime());
  const day = copy.getDate();
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + count);
  const lastDay = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(day, lastDay));
  return copy;
}

function monthsBetween(start: Date, end: Date): number {
  const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  const diff = (endMonth.getFullYear() - startMonth.getFullYear()) * 12 + (endMonth.getMonth() - startMonth.getMonth());
  return diff;
}

export function computeMonthlyRate(aprPercent: number, frequency: CompoundingFrequency): number {
  const aprDecimal = Math.max(aprPercent, 0) / 100;
  if (aprDecimal === 0) {
    return 0;
  }
  const periodsPerYear = frequency === 'monthly' ? 12 : frequency === 'quarterly' ? 4 : 1;
  return Math.pow(1 + aprDecimal / periodsPerYear, 1 / periodsPerYear) - 1;
}

export function computeMonthlyInflation(ratePercent: number | null): number | null {
  if (ratePercent === null) {
    return null;
  }
  const decimal = Math.max(ratePercent, 0) / 100;
  if (decimal === 0) {
    return 0;
  }
  return Math.pow(1 + decimal, 1 / 12) - 1;
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdf(summaryLines: string[]): Blob {
  const header = '%PDF-1.4\n';
  const objects: string[] = [];
  const textLines = ['BT', '/F1 12 Tf', '14 TL', '1 0 0 1 50 800 Tm'];
  summaryLines.forEach((line, index) => {
    textLines.push(`(${escapePdfText(line)}) Tj`);
    if (index < summaryLines.length - 1) {
      textLines.push('T*');
    }
  });
  textLines.push('ET');
  const textStream = textLines.join('\n');
  const streamContent = `BT\n/F1 12 Tf\n14 TL\n1 0 0 1 50 800 Tm\n${summaryLines
    .map((line, idx) => `(${escapePdfText(line)}) Tj${idx < summaryLines.length - 1 ? '\nT*' : ''}`)
    .join('\n')}\nET`;
  const length = streamContent.length;
  const xref: string[] = [];
  const objectOffsets: number[] = [];
  let body = header;
  const pushObject = (definition: string) => {
    objectOffsets.push(body.length);
    body += definition + '\n';
  };
  pushObject('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
  pushObject('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
  pushObject('3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj');
  pushObject(`4 0 obj << /Length ${length} >> stream\n${streamContent}\nendstream endobj`);
  pushObject('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
  const xrefOffset = body.length;
  body += 'xref\n0 6\n0000000000 65535 f \n';
  objectOffsets.forEach((offset) => {
    const padded = offset.toString().padStart(10, '0');
    body += `${padded} 00000 n \n`;
  });
  body += 'trailer << /Size 6 /Root 1 0 R >>\nstartxref\n';
  body += `${xrefOffset}\n%%EOF`;
  return new Blob([body], { type: 'application/pdf' });
}

function buildCsv(summaryLines: string[], projection: ProjectionRow[], locale: string): Blob {
  const dateFormatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short' });
  const rows: string[][] = [];
  summaryLines.forEach((line) => {
    rows.push([line]);
  });
  rows.push([]);
  rows.push(['Month', 'Date', 'Starting Balance', 'Contribution', 'Interest', 'Ending Balance']);
  projection.forEach((row) => {
    rows.push([
      (row.monthIndex + 1).toString(),
      dateFormatter.format(row.date),
      row.startingBalance.toFixed(2),
      row.contribution.toFixed(2),
      row.interestEarned.toFixed(2),
      row.endingBalance.toFixed(2),
    ]);
  });
  const csvContent = '\ufeff' + rows.map((cols) => cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  return new Blob([csvContent], { type: 'text/csv' });
}

function formatCurrency(value: number, locale: string, currency: SupportedCurrency): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

function describeDuration(months: number, locale: string): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  }
  if (remainingMonths > 0) {
    parts.push(`${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`);
  }
  if (parts.length === 0) {
    return '0 months';
  }
  return parts.join(' ');
}

function summariseProjection(
  projection: ProjectionRow[],
  totalContributions: number,
  totalInterest: number,
  locale: string,
  currency: SupportedCurrency,
  finishDate?: Date,
  requiredMonthlyContribution?: number,
  mode: CalculatorMode = 'time',
  inflation?: InflationBreakdown
): string[] {
  const summaryLines: string[] = [];
  summaryLines.push(`Mode: ${mode === 'time' ? 'Time to reach goal' : 'Monthly savings needed'}`);
  if (finishDate) {
    const dateFormatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' });
    summaryLines.push(`Projected finish date: ${dateFormatter.format(finishDate)}`);
  }
  if (requiredMonthlyContribution !== undefined) {
    summaryLines.push(`Required monthly savings: ${formatCurrency(requiredMonthlyContribution, locale, currency)}`);
  }
  summaryLines.push(`Total contributions: ${formatCurrency(totalContributions, locale, currency)}`);
  summaryLines.push(`Total interest: ${formatCurrency(totalInterest, locale, currency)}`);
  if (inflation) {
    summaryLines.push(`Real (today's money) finish: ${formatCurrency(inflation.realEndingBalance, locale, currency)}`);
    summaryLines.push(`Real contributions: ${formatCurrency(inflation.realContributions, locale, currency)}`);
    summaryLines.push(`Real interest: ${formatCurrency(inflation.realInterest, locale, currency)}`);
  }
  return summaryLines;
}

function resolveInflation(
  goalAmount: number,
  endingBalance: number,
  inflationMonthlyRate: number | null,
  months: number,
  totalContributions: number,
  totalInterest: number
): InflationBreakdown | undefined {
  if (inflationMonthlyRate === null || months === undefined) {
    return undefined;
  }
  const divisor = Math.pow(1 + (inflationMonthlyRate || 0), months);
  if (divisor === 0) {
    return undefined;
  }
  const realEnding = endingBalance / divisor;
  const realContributions = totalContributions / divisor;
  const realInterest = totalInterest / divisor;
  const realGoal = goalAmount / divisor;
  return {
    realGoalValue: realGoal,
    realEndingBalance: realEnding,
    realContributions,
    realInterest,
  };
}

function accumulate(projection: ProjectionRow[]): { totalContributions: number; totalInterest: number } {
  let totalContributions = 0;
  let totalInterest = 0;
  projection.forEach((row) => {
    totalContributions += row.contribution;
    totalInterest += row.interestEarned;
  });
  return {
    totalContributions,
    totalInterest,
  };
}

function generateProjection(
  months: number,
  startingBalance: number,
  monthlyContribution: number,
  monthlyRate: number,
  goal: number,
  startDate: Date,
  allowOverGoal = false
): ProjectionRow[] {
  const rows: ProjectionRow[] = [];
  let balance = startingBalance;
  for (let month = 0; month < months; month++) {
    const date = addMonths(startDate, month + 1);
    const interest = balance * monthlyRate;
    let contribution = monthlyContribution;
    if (!allowOverGoal && goal > 0) {
      const projected = balance + interest + contribution;
      if (projected > goal) {
        contribution = Math.max(0, goal - (balance + interest));
      }
    }
    const endingBalance = balance + interest + contribution;
    rows.push({
      monthIndex: month,
      date,
      startingBalance: balance,
      contribution,
      interestEarned: interest,
      endingBalance,
    });
    balance = endingBalance;
    if (!allowOverGoal && balance >= goal) {
      break;
    }
  }
  return rows;
}

function solveMonths(goal: number, current: number, monthlyContribution: number, monthlyRate: number): number | null {
  if (goal <= current) {
    return 0;
  }
  if (monthlyRate === 0) {
    if (monthlyContribution <= 0) {
      return null;
    }
    return Math.ceil((goal - current) / monthlyContribution);
  }
  if (monthlyContribution === 0) {
    if (current <= 0) {
      return null;
    }
    const ratio = goal / current;
    if (ratio <= 1) {
      return 0;
    }
    const months = Math.log(ratio) / Math.log(1 + monthlyRate);
    if (!Number.isFinite(months)) {
      return null;
    }
    return Math.max(0, Math.ceil(months));
  }
  const numerator = goal * monthlyRate + monthlyContribution;
  const denominator = current * monthlyRate + monthlyContribution;
  if (numerator <= 0 || denominator <= 0) {
    return null;
  }
  const months = Math.log(numerator / denominator) / Math.log(1 + monthlyRate);
  if (!Number.isFinite(months) || months < 0) {
    return null;
  }
  return Math.ceil(months);
}

function solveContribution(goal: number, current: number, months: number, monthlyRate: number): number | null {
  if (months <= 0) {
    return null;
  }
  if (goal <= current) {
    return 0;
  }
  if (monthlyRate === 0) {
    return Math.max(0, (goal - current) / months);
  }
  const pow = Math.pow(1 + monthlyRate, months);
  const denominator = (pow - 1) / monthlyRate;
  if (denominator === 0) {
    return null;
  }
  const numerator = goal - current * pow;
  const result = numerator / denominator;
  if (!Number.isFinite(result) || result < 0) {
    return null;
  }
  return result;
}

function parseTargetDate(value: string): Date | null {
  if (!value) return null;
  const [yearStr, monthStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }
  return new Date(year, month - 1, 1);
}

export function calculateSavingsScenario(input: ScenarioInput): ModeAResult | ModeBResult | null {
  const today = input.startDate ?? new Date();
  const goal = input.goalAmount;
  const current = input.currentSavings;
  const monthlyRate = computeMonthlyRate(input.apr, input.compounding);
  const inflationMonthlyRate = computeMonthlyInflation(input.inflationRate ?? null);

  if (goal <= current) {
    const inflation = resolveInflation(goal, current, inflationMonthlyRate, 0, 0, 0);
    if (input.mode === 'time') {
      return {
        mode: 'time',
        months: 0,
        finishDate: today,
        totalContributions: 0,
        totalInterest: 0,
        projection: [],
        inflation,
      };
    }
    return {
      mode: 'monthly',
      months: 0,
      requiredMonthlyContribution: 0,
      totalContributions: 0,
      totalInterest: 0,
      projection: [],
      inflation,
    };
  }

  if (input.mode === 'time') {
    const monthlyContribution = input.monthlyContribution ?? 0;
    if (monthlyRate === 0 && monthlyContribution <= 0) {
      return null;
    }
    const monthsNeeded = solveMonths(goal, current, monthlyContribution, monthlyRate);
    if (monthsNeeded === null || monthsNeeded > MAX_MONTHS) {
      return null;
    }
    const projection = generateProjection(monthsNeeded, current, monthlyContribution, monthlyRate, goal, today);
    const finishDate = addMonths(today, monthsNeeded);
    const totals = accumulate(projection);
    const inflation = resolveInflation(goal, projection[projection.length - 1]?.endingBalance ?? current, inflationMonthlyRate, monthsNeeded, totals.totalContributions, totals.totalInterest);
    return {
      mode: 'time',
      months: monthsNeeded,
      finishDate,
      totalContributions: totals.totalContributions,
      totalInterest: totals.totalInterest,
      projection,
      inflation,
    };
  }

  const targetDate = input.targetDate;
  if (!targetDate) {
    return null;
  }
  const monthsUntilTarget = monthsBetween(today, targetDate);
  if (monthsUntilTarget <= 0 || monthsUntilTarget > MAX_MONTHS) {
    return null;
  }
  const monthlyContribution = solveContribution(goal, current, monthsUntilTarget, monthlyRate);
  if (monthlyContribution === null) {
    return null;
  }
  const projection = generateProjection(monthsUntilTarget, current, monthlyContribution, monthlyRate, goal, today, true);
  const totals = accumulate(projection);
  const inflation = resolveInflation(goal, projection[projection.length - 1]?.endingBalance ?? current, inflationMonthlyRate, monthsUntilTarget, totals.totalContributions, totals.totalInterest);
  return {
    mode: 'monthly',
    months: monthsUntilTarget,
    requiredMonthlyContribution: monthlyContribution,
    totalContributions: totals.totalContributions,
    totalInterest: totals.totalInterest,
    projection,
    finishDate: targetDate,
    inflation,
  };
}

class SavingsCalculatorUI {
  private container: HTMLElement;
  private props: SavingsCalculatorProps;
  private state: CalculatorState;
  private resultSummary: CalculatedSummary | null = null;
  private showAllRows = false;
  private root!: HTMLElement;
  private summaryRegion!: HTMLElement;
  private tableBody!: HTMLElement;
  private showAllButton!: HTMLButtonElement;
  private messageRegion!: HTMLElement;
  private rememberToggle!: HTMLInputElement;

  constructor(container: HTMLElement, props: SavingsCalculatorProps) {
    this.container = container;
    this.props = props;
    this.state = this.loadState(props);
    this.buildUI();
    this.populateFields();
    this.calculate();
  }

  private loadState(props: SavingsCalculatorProps): CalculatorState {
    const base: CalculatorState = { ...DEFAULT_STATE };
    if (props.mode) {
      base.mode = props.mode;
    }
    if (props.defaultCurrency) {
      base.currency = props.defaultCurrency;
    }
    if (props.defaultLocale) {
      base.locale = props.defaultLocale;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<CalculatorState>;
        Object.assign(base, parsed);
      }
    } catch (error) {
      // Ignore storage errors
    }
    return base;
  }

  private persistState(): void {
    if (!this.state.rememberInputs) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        // ignore
      }
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      // ignore persistence errors
    }
  }

  private buildUI(): void {
    this.root = document.createElement('section');
    this.root.className = 'bt-savings-card';
    this.root.innerHTML = `
      <header class="bt-savings-header">
        <div>
          <h2>Savings goal calculator</h2>
          <p class="bt-demo__lede">Switch between finding out how long it may take to reach your goal or the monthly amount needed by a target date.</p>
        </div>
        <div class="bt-mode-toggle" role="group" aria-label="Calculation mode">
          <button type="button" data-mode="time" aria-pressed="false">Time to reach goal</button>
          <button type="button" data-mode="monthly" aria-pressed="false">Monthly savings by date</button>
        </div>
      </header>
      <form class="bt-grid" novalidate>
        <div class="bt-field">
          <label for="goalAmount">Goal amount</label>
          <input id="goalAmount" name="goalAmount" type="number" inputmode="decimal" min="0" step="0.01" class="bt-input" placeholder="10000" />
        </div>
        <div class="bt-field">
          <label for="currentSavings">Current savings</label>
          <input id="currentSavings" name="currentSavings" type="number" inputmode="decimal" min="0" step="0.01" class="bt-input" placeholder="0" />
        </div>
        <div class="bt-field" data-field="monthlyContribution">
          <label for="monthlyContribution">Monthly contribution</label>
          <input id="monthlyContribution" name="monthlyContribution" type="number" inputmode="decimal" min="0" step="0.01" class="bt-input" placeholder="250" />
          <small>Required for time-to-goal calculations.</small>
        </div>
        <div class="bt-field" data-field="targetDate">
          <label for="targetDate">Target date</label>
          <input id="targetDate" name="targetDate" type="month" class="bt-input" />
          <small>Required for target-date calculations.</small>
        </div>
        <div class="bt-field">
          <label for="apr">Annual interest rate (APR %)</label>
          <input id="apr" name="apr" type="number" inputmode="decimal" min="0" max="50" step="0.01" class="bt-input" placeholder="3" />
        </div>
        <div class="bt-field">
          <label for="compounding">Compounding frequency</label>
          <select id="compounding" name="compounding" class="bt-input">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div class="bt-field">
          <label for="inflation">Inflation rate (optional %)</label>
          <input id="inflation" name="inflation" type="number" inputmode="decimal" min="0" max="20" step="0.01" class="bt-input" placeholder="2" />
        </div>
        <div class="bt-field">
          <label for="currency">Currency</label>
          <select id="currency" name="currency" class="bt-input"></select>
        </div>
        <div class="bt-field">
          <label for="locale">Locale</label>
          <select id="locale" name="locale" class="bt-input"></select>
        </div>
        <div class="bt-remember">
          <input type="checkbox" id="rememberInputs" />
          <label for="rememberInputs">Remember my last inputs on this device</label>
        </div>
      </form>
      <div id="bt-message" aria-live="polite"></div>
      <section class="bt-output" aria-live="polite" aria-atomic="true">
        <div id="bt-summary" class="bt-summary"></div>
        <div class="bt-actions">
          <button type="button" class="bt-button" data-action="reset">Reset</button>
          <button type="button" class="bt-button" data-action="copy">Copy results</button>
          <button type="button" class="bt-button" data-action="download-pdf">Download PDF</button>
          <button type="button" class="bt-button" data-action="download-csv">Download CSV</button>
          <button type="button" class="bt-button" data-action="email">Email me my report</button>
        </div>
        <div class="bt-table-wrapper">
          <table class="bt-projection-table">
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Date</th>
                <th scope="col">Starting balance</th>
                <th scope="col">Contribution</th>
                <th scope="col">Interest</th>
                <th scope="col">Ending balance</th>
              </tr>
            </thead>
            <tbody id="bt-table-body"></tbody>
          </table>
        </div>
        <button type="button" class="bt-button" data-action="toggle-rows">Show all</button>
        <p class="bt-footer">BudgetTools — calculations run in your browser. No data stored. Estimates only. Returns are not guaranteed.</p>
      </section>
    `;
    this.container.innerHTML = '';
    this.container.appendChild(this.root);

    this.summaryRegion = this.root.querySelector('#bt-summary') as HTMLElement;
    this.tableBody = this.root.querySelector('#bt-table-body') as HTMLElement;
    this.showAllButton = this.root.querySelector('[data-action="toggle-rows"]') as HTMLButtonElement;
    this.messageRegion = this.root.querySelector('#bt-message') as HTMLElement;
    this.rememberToggle = this.root.querySelector('#rememberInputs') as HTMLInputElement;

    const modeButtons = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.bt-mode-toggle button'));
    modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode as CalculatorMode;
        if (mode !== this.state.mode) {
          this.state.mode = mode;
          this.showAllRows = false;
          this.updateModeToggle();
          this.persistState();
          this.calculate();
        }
      });
    });

    const currencySelect = this.root.querySelector<HTMLSelectElement>('#currency');
    CURRENCIES.forEach((currency) => {
      const option = document.createElement('option');
      option.value = currency;
      option.textContent = currency;
      currencySelect?.appendChild(option);
    });

    const localeSelect = this.root.querySelector<HTMLSelectElement>('#locale');
    LOCALES.forEach((locale) => {
      const option = document.createElement('option');
      option.value = locale;
      option.textContent = locale;
      localeSelect?.appendChild(option);
    });

    const form = this.root.querySelector('form');
    form?.addEventListener('input', (event) => this.handleInput(event));
    form?.addEventListener('change', (event) => this.handleInput(event));

    this.rememberToggle.addEventListener('change', () => {
      this.state.rememberInputs = this.rememberToggle.checked;
      this.persistState();
    });

    const actionButtons = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.bt-actions .bt-button'));
    actionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        this.handleAction(action ?? '');
      });
    });

    this.showAllButton.addEventListener('click', () => {
      this.showAllRows = !this.showAllRows;
      this.showAllButton.textContent = this.showAllRows ? 'Show first 24 months' : 'Show all';
      this.renderProjection();
    });

    this.updateModeToggle();
  }

  private populateFields(): void {
    const goalField = this.root.querySelector<HTMLInputElement>('#goalAmount');
    const currentField = this.root.querySelector<HTMLInputElement>('#currentSavings');
    const monthlyField = this.root.querySelector<HTMLInputElement>('#monthlyContribution');
    const targetField = this.root.querySelector<HTMLInputElement>('#targetDate');
    const aprField = this.root.querySelector<HTMLInputElement>('#apr');
    const inflationField = this.root.querySelector<HTMLInputElement>('#inflation');
    const compoundingField = this.root.querySelector<HTMLSelectElement>('#compounding');
    const currencyField = this.root.querySelector<HTMLSelectElement>('#currency');
    const localeField = this.root.querySelector<HTMLSelectElement>('#locale');

    if (goalField && this.state.goalAmount !== null) goalField.value = String(this.state.goalAmount);
    if (currentField) currentField.value = String(this.state.currentSavings ?? 0);
    if (monthlyField && this.state.monthlyContribution !== null) monthlyField.value = String(this.state.monthlyContribution);
    if (targetField && this.state.targetDate) targetField.value = this.state.targetDate;
    if (aprField) aprField.value = String(this.state.apr ?? 0);
    if (inflationField && this.state.inflationRate !== null) inflationField.value = String(this.state.inflationRate);
    if (compoundingField) compoundingField.value = this.state.compounding;
    if (currencyField) currencyField.value = this.state.currency;
    if (localeField) localeField.value = this.state.locale;
    this.rememberToggle.checked = this.state.rememberInputs;
    this.toggleFieldVisibility();
  }

  private updateModeToggle(): void {
    const modeButtons = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.bt-mode-toggle button'));
    modeButtons.forEach((btn) => {
      const pressed = btn.dataset.mode === this.state.mode;
      btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    });
    this.toggleFieldVisibility();
  }

  private toggleFieldVisibility(): void {
    const monthlyField = this.root.querySelector('[data-field="monthlyContribution"]') as HTMLElement;
    const targetField = this.root.querySelector('[data-field="targetDate"]') as HTMLElement;
    if (monthlyField) {
      monthlyField.style.display = this.state.mode === 'time' ? 'flex' : 'none';
    }
    if (targetField) {
      targetField.style.display = this.state.mode === 'monthly' ? 'flex' : 'none';
    }
  }

  private handleInput(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (!target) return;
    const { name, value } = target;
    switch (name) {
      case 'goalAmount':
        this.state.goalAmount = clampNumber(safeParseNumber(value) ?? 0, 0, Number.MAX_SAFE_INTEGER);
        break;
      case 'currentSavings':
        this.state.currentSavings = clampNumber(safeParseNumber(value) ?? 0, 0, Number.MAX_SAFE_INTEGER);
        break;
      case 'monthlyContribution':
        this.state.monthlyContribution = clampNumber(safeParseNumber(value) ?? 0, 0, Number.MAX_SAFE_INTEGER);
        break;
      case 'targetDate':
        this.state.targetDate = value;
        break;
      case 'apr':
        this.state.apr = clampNumber(safeParseNumber(value) ?? 0, 0, 50);
        break;
      case 'inflation':
        this.state.inflationRate = safeParseNumber(value);
        if (this.state.inflationRate !== null) {
          this.state.inflationRate = clampNumber(this.state.inflationRate, 0, 20);
        }
        break;
      case 'compounding':
        this.state.compounding = (value as CompoundingFrequency) || 'monthly';
        break;
      case 'currency':
        this.state.currency = (value as SupportedCurrency) || 'EUR';
        break;
      case 'locale':
        this.state.locale = value || 'nl-NL';
        break;
      default:
        break;
    }
    this.persistState();
    this.calculate();
  }

  private handleAction(action: string): void {
    switch (action) {
      case 'reset':
        this.state = { ...DEFAULT_STATE, rememberInputs: this.state.rememberInputs };
        if (this.props.mode) {
          this.state.mode = this.props.mode;
        }
        if (this.props.defaultCurrency) {
          this.state.currency = this.props.defaultCurrency;
        }
        if (this.props.defaultLocale) {
          this.state.locale = this.props.defaultLocale;
        }
        this.populateFields();
        this.persistState();
        this.calculate();
        break;
      case 'copy':
        this.copyResults();
        break;
      case 'download-pdf':
        this.downloadPdf();
        break;
      case 'download-csv':
        this.downloadCsv();
        break;
      case 'email':
        this.emailReport();
        break;
      default:
        break;
    }
  }

  private copyResults(): void {
    if (!this.resultSummary) return;
    const lines = this.buildSummaryLines();
    const text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showMessage('Summary copied to clipboard.');
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  }

  private fallbackCopy(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      this.showMessage('Summary copied to clipboard.');
    } catch (error) {
      this.showMessage('Unable to copy to clipboard.');
    }
    document.body.removeChild(textArea);
  }

  private downloadPdf(): void {
    if (!this.resultSummary) return;
    const lines = this.buildSummaryLines(true);
    const blob = buildPdf(lines);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'budgettools-savings-report.pdf';
    link.click();
    URL.revokeObjectURL(url);
  }

  private downloadCsv(): void {
    if (!this.resultSummary) return;
    const lines = this.buildSummaryLines(true);
    const blob = buildCsv(lines, this.resultSummary.projection, this.state.locale);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'budgettools-savings-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  private async emailReport(): Promise<void> {
    if (!this.resultSummary) return;
    const email = prompt('Where should we send your report?');
    if (!email) {
      return;
    }
    const lines = this.buildSummaryLines(true);
    const csvBlob = buildCsv(lines, this.resultSummary.projection, this.state.locale);
    const pdfBlob = buildPdf(lines);
    const subject = encodeURIComponent('My BudgetTools savings goal report');
    const body = encodeURIComponent(lines.join('\n'));
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
    if (typeof this.props.sendReport === 'function') {
      try {
        await this.props.sendReport(email, csvBlob, pdfBlob);
      } catch (error) {
        console.warn('sendReport hook failed', error);
      }
    }
  }

  private showMessage(message: string): void {
    this.messageRegion.innerHTML = '';
    if (!message) return;
    const div = document.createElement('div');
    div.className = 'bt-alert';
    div.textContent = message;
    this.messageRegion.appendChild(div);
  }

  private buildSummaryLines(includeTableHint = false): string[] {
    if (!this.resultSummary) return [];
    const { totalContributions, totalInterest, finishDate, requiredMonthlyContribution, projection, mode, inflation } = this.resultSummary;
    const lines = summariseProjection(
      projection,
      totalContributions,
      totalInterest,
      this.state.locale,
      this.state.currency,
      finishDate,
      requiredMonthlyContribution,
      mode,
      inflation
    );
    if (includeTableHint) {
      lines.push('');
      lines.push('Projection (first rows shown in tool). Download CSV for full history.');
    }
    return lines;
  }

  private calculate(): void {
    this.messageRegion.innerHTML = '';
    this.summaryRegion.innerHTML = '';
    this.tableBody.innerHTML = '';
    this.resultSummary = null;
    if (!this.state.goalAmount || this.state.goalAmount <= 0) {
      this.showMessage('Enter a goal amount to begin.');
      this.notify(null);
      return;
    }

    if (this.state.mode === 'time') {
      const result = calculateSavingsScenario({
        mode: 'time',
        goalAmount: this.state.goalAmount ?? 0,
        currentSavings: this.state.currentSavings ?? 0,
        monthlyContribution: this.state.monthlyContribution ?? 0,
        apr: this.state.apr,
        compounding: this.state.compounding,
        inflationRate: this.state.inflationRate ?? undefined,
        startDate: new Date(),
      }) as ModeAResult | null;
      if (!result) {
        this.showMessage('Increase monthly savings or adjust your goal to get a result.');
        this.notify(null);
        return;
      }
      this.resultSummary = result;
    } else {
      const targetDate = this.state.targetDate ? parseTargetDate(this.state.targetDate) : null;
      const result = calculateSavingsScenario({
        mode: 'monthly',
        goalAmount: this.state.goalAmount ?? 0,
        currentSavings: this.state.currentSavings ?? 0,
        apr: this.state.apr,
        compounding: this.state.compounding,
        inflationRate: this.state.inflationRate ?? undefined,
        targetDate,
        startDate: new Date(),
      }) as ModeBResult | null;
      if (!result) {
        this.showMessage('Goal may already be met or the target date is too soon.');
        this.notify(null);
        return;
      }
      this.resultSummary = result;
    }

    this.renderSummary();
    this.renderProjection();
    this.notify(this.resultSummary);
  }


  private renderSummary(): void {
    if (!this.resultSummary) return;
    const { mode, months, totalContributions, totalInterest, finishDate, requiredMonthlyContribution, inflation } = this.resultSummary;
    const locale = this.state.locale;
    const currency = this.state.currency;
    const rows: HTMLElement[] = [];

    const addRow = (label: string, value: string) => {
      const div = document.createElement('div');
      div.className = 'bt-summary__row';
      const labelSpan = document.createElement('span');
      labelSpan.className = 'bt-summary__label';
      labelSpan.textContent = label;
      const valueSpan = document.createElement('span');
      valueSpan.textContent = value;
      div.append(labelSpan, valueSpan);
      rows.push(div);
    };

    if (mode === 'time') {
      addRow('Estimated time', describeDuration(months, locale));
      if (finishDate) {
        const formatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' });
        addRow('Projected finish date', formatter.format(finishDate));
      }
    } else if (mode === 'monthly' && requiredMonthlyContribution !== undefined) {
      addRow('Required monthly savings', formatCurrency(requiredMonthlyContribution, locale, currency));
      addRow('Months until target', describeDuration(months, locale));
    }

    addRow('Total contributions', formatCurrency(totalContributions, locale, currency));
    addRow('Total interest', formatCurrency(totalInterest, locale, currency));

    if (inflation) {
      addRow('Goal in today\'s money', formatCurrency(inflation.realGoalValue, locale, currency));
      addRow('Projected finish (real)', formatCurrency(inflation.realEndingBalance, locale, currency));
      addRow('Contributions (real)', formatCurrency(inflation.realContributions, locale, currency));
      addRow('Interest (real)', formatCurrency(inflation.realInterest, locale, currency));
    }

    this.summaryRegion.replaceChildren(...rows);
  }

  private renderProjection(): void {
    if (!this.resultSummary) return;
    const projection = this.resultSummary.projection;
    const locale = this.state.locale;
    const currency = this.state.currency;
    const dateFormatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short' });
    const rowsToShow = this.showAllRows ? projection.length : Math.min(24, projection.length);
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < rowsToShow; i++) {
      const row = projection[i];
      const tr = document.createElement('tr');
      const cells = [
        (row.monthIndex + 1).toString(),
        dateFormatter.format(row.date),
        formatCurrency(row.startingBalance, locale, currency),
        formatCurrency(row.contribution, locale, currency),
        formatCurrency(row.interestEarned, locale, currency),
        formatCurrency(row.endingBalance, locale, currency),
      ];
      cells.forEach((value, index) => {
        const td = document.createElement('td');
        td.textContent = value;
        if (index === 0) {
          td.style.textAlign = 'left';
        }
        tr.appendChild(td);
      });
      fragment.appendChild(tr);
    }
    this.tableBody.replaceChildren(fragment);
    this.showAllButton.style.display = projection.length > 24 ? 'inline-flex' : 'none';
    if (!this.showAllRows && projection.length > 24) {
      this.showAllButton.textContent = 'Show all';
    } else if (projection.length > 24) {
      this.showAllButton.textContent = 'Show first 24 months';
    }
  }

  private notify(summary: CalculatedSummary | null): void {
    if (typeof this.props.onCalculated === 'function') {
      this.props.onCalculated(summary);
    }
  }
}

export function initSavingsCalculator(el: HTMLElement, props: SavingsCalculatorProps = {}): void {
  if (!el) {
    throw new Error('Container element is required');
  }
  new SavingsCalculatorUI(el, props);
}

// Attach to window for embedding without bundlers.
declare global {
  interface Window {
    initSavingsCalculator?: typeof initSavingsCalculator;
  }
}

if (typeof window !== 'undefined') {
  window.initSavingsCalculator = initSavingsCalculator;
}
