declare function require(name: string): any;
const assert = require('assert');
import { calculateSavingsScenario } from '../tools/savings-goal-calculator/script';

type Mode = 'time' | 'monthly';

type Frequency = 'monthly' | 'quarterly' | 'yearly';

function futureDate(start: Date, months: number): Date {
  const date = new Date(start.getTime());
  date.setMonth(date.getMonth() + months);
  return date;
}

function runTimeScenario(
  goal: number,
  current: number,
  monthly: number,
  apr: number,
  frequency: Frequency = 'monthly'
) {
  return calculateSavingsScenario({
    mode: 'time',
    goalAmount: goal,
    currentSavings: current,
    monthlyContribution: monthly,
    apr,
    compounding: frequency,
    startDate: new Date(2024, 0, 1),
  });
}

function runMonthlyScenario(
  goal: number,
  current: number,
  monthsAhead: number,
  apr: number,
  frequency: Frequency = 'monthly',
  inflation?: number
) {
  return calculateSavingsScenario({
    mode: 'monthly',
    goalAmount: goal,
    currentSavings: current,
    apr,
    compounding: frequency,
    targetDate: futureDate(new Date(2024, 0, 1), monthsAhead),
    startDate: new Date(2024, 0, 1),
    inflationRate: inflation,
  });
}

(function main() {
  // Test 1
  const test1 = runTimeScenario(10_000, 0, 250, 0);
  assert(test1, 'Test 1 failed to produce a result');
  assert.strictEqual(test1.months, 40, 'Test 1 expected 40 months');

  // Test 2
  const test2 = runTimeScenario(10_000, 2_000, 200, 3);
  assert(test2, 'Test 2 failed to produce a result');
  assert(test2.months >= 39 && test2.months <= 41, 'Test 2 months out of expected range');

  // Test 3
  const test3 = runMonthlyScenario(5_000, 5_500, 6, 3);
  assert(test3, 'Test 3 should produce result');
  assert.strictEqual(test3.requiredMonthlyContribution, 0, 'Test 3 monthly contribution should be 0');

  // Test 4
  const test4 = runMonthlyScenario(20_000, 1_000, 24, 0);
  assert(test4, 'Test 4 failed to produce a result');
  assert(Math.abs(test4.requiredMonthlyContribution - 791.67) < 0.5, 'Test 4 expected ~791.67');

  // Test 5
  const test5 = runMonthlyScenario(20_000, 1_000, 24, 5);
  assert(test5, 'Test 5 failed to produce a result');
  assert(test5.requiredMonthlyContribution >= 780 && test5.requiredMonthlyContribution <= 790, 'Test 5 monthly contribution range');

  // Test 6
  const test6 = runTimeScenario(5_000, 100, 0, 0);
  assert.strictEqual(test6, null, 'Test 6 should be infeasible');

  // Test 7
  const test7 = runMonthlyScenario(15_000, 5_000, 36, 3, 'monthly', 2);
  assert(test7 && test7.inflation, 'Test 7 should include inflation breakdown');
  if (test7 && test7.inflation) {
    assert(test7.inflation.realEndingBalance < test7.projection[test7.projection.length - 1].endingBalance, 'Inflation-adjusted value should be lower');
  }

  console.log('All savings calculator scenarios passed.');
})();
