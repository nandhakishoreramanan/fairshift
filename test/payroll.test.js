'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePayslip } = require('../src/lib/payroll');

const rules = {
  standardDailyHours: 8,
  overtimeMultiplier: 2,
};

test('payroll: daily wage worker receives 2x overtime rate and statutory deductions', () => {
  const worker = {
    payType: 'daily',
    dailyWage: 800, // 800 / 8 = 100/hour
    allowances: [{ key: 'food', amount: 500 }],
    pf: true,
    esi: true,
  };

  const records = [
    { checkIn: '2026-10-20T08:00:00.000Z', checkOut: '2026-10-20T18:00:00.000Z' }, // 10h (8 reg + 2 ot)
    { checkIn: '2026-10-21T08:00:00.000Z', checkOut: '2026-10-21T16:00:00.000Z' }, // 8h reg
  ];

  const slip = calculatePayslip(worker, records, rules);

  assert.equal(slip.hours.regularHours, 16);
  assert.equal(slip.hours.overtimeHours, 2);

  // basic: 16 * 100 = 1600
  const basic = slip.earnings.find((e) => e.code === 'basic_daily');
  assert.equal(basic.amount, 1600);

  // overtime: 2h * 100 * 2 = 400
  const ot = slip.earnings.find((e) => e.code === 'overtime');
  assert.equal(ot.amount, 400);

  // allowances: 500
  const food = slip.earnings.find((e) => e.code === 'allowance_food');
  assert.equal(food.amount, 500);

  // Gross: 1600 + 400 + 500 = 2500
  assert.equal(slip.gross, 2500);

  // PF: 12% of basic (1600) = 192
  const pf = slip.deductions.find((d) => d.code === 'pf');
  assert.equal(pf.amount, 192);

  // Net = Gross - deductions
  assert.equal(slip.net, slip.gross - slip.totalDeductions);
});

test('payroll: monthly salaried employee in college pro-rates by worked days', () => {
  const worker = {
    payType: 'monthly',
    monthlySalary: 26000, // 26000 / 26 = 1000/day
    allowances: [],
    pf: true,
    esi: false,
  };

  // 10 shifts worked
  const records = [];
  for (let i = 1; i <= 10; i++) {
    records.push({
      checkIn: `2026-10-${String(i).padStart(2, '0')}T09:00:00.000Z`,
      checkOut: `2026-10-${String(i).padStart(2, '0')}T17:00:00.000Z`,
    });
  }

  const slip = calculatePayslip(worker, records, rules);
  assert.equal(slip.hours.daysWorked, 10);

  const basic = slip.earnings.find((e) => e.code === 'basic_monthly');
  assert.equal(basic.amount, 10000); // 10 days * 1000
});

test('payroll: zero attendance produces zero wage with no NaN values', () => {
  const worker = {
    payType: 'daily',
    dailyWage: 700,
    allowances: [],
    pf: true,
    esi: true,
  };

  const slip = calculatePayslip(worker, [], rules);
  assert.equal(slip.gross, 0);
  assert.equal(slip.net, 0);
  assert.equal(Number.isNaN(slip.net), false);
  assert.equal(slip.hours.daysWorked, 0);
});

test('payroll: wages exceeding statutory ESI ceiling exempt worker from ESI deduction', () => {
  const highSalaryWorker = {
    payType: 'monthly',
    monthlySalary: 45000, // Exceeds ESI ceiling of ₹21,000
    allowances: [],
    pf: true,
    esi: true,
  };

  const records = [{ checkIn: '2026-10-01T09:00:00.000Z', checkOut: '2026-10-01T17:00:00.000Z' }];
  const slip = calculatePayslip(highSalaryWorker, records, rules);

  const esi = slip.deductions.find((d) => d.code === 'esi');
  assert.equal(esi, undefined); // Excluded due to statutory wage ceiling
});
