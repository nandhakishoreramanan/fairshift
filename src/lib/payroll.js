'use strict';

/**
 * Transparent payslip calculation.
 *
 * Every line is returned as a machine-readable `code` plus `params` so the
 * client can explain it in the worker's own language (and read it aloud),
 * e.g. code "overtime" -> "6.5 extra hours × ₹125 × 2 = ₹1,625".
 */
const { summarise } = require('./hours');

const STANDARD_MONTH_DAYS = 26;
const PF_RATE = 0.12;
const ESI_RATE = 0.0075;
const ESI_WAGE_CEILING = 21000;

function money(n) {
  return Math.round(n);
}

/**
 * @param {object} worker  { payType: 'daily'|'monthly', dailyWage?, monthlySalary?, allowances?, pf?, esi? }
 * @param {Array}  records attendance records within the pay period
 * @param {object} rules   labour rules
 * @param {object} [extra] { advances?: number }
 */
function calculatePayslip(worker, records, rules, extra = {}) {
  const hours = summarise(records, rules.standardDailyHours);
  const dailyRate =
    worker.payType === 'monthly' ? worker.monthlySalary / STANDARD_MONTH_DAYS : worker.dailyWage;
  const hourlyRate = dailyRate / rules.standardDailyHours;

  const earnings = [];
  const deductions = [];

  let basic;
  if (worker.payType === 'monthly') {
    const payableDays = Math.min(hours.daysWorked, STANDARD_MONTH_DAYS);
    basic = money(dailyRate * payableDays);
    earnings.push({
      code: 'basic_monthly',
      amount: basic,
      params: { salary: worker.monthlySalary, days: payableDays, standardDays: STANDARD_MONTH_DAYS },
    });
  } else {
    basic = money(hours.regularHours * hourlyRate);
    earnings.push({
      code: 'basic_daily',
      amount: basic,
      params: { hours: hours.regularHours, days: hours.daysWorked, rate: money(dailyRate), hourly: money(hourlyRate) },
    });
  }

  const overtimePay = money(hours.overtimeHours * hourlyRate * rules.overtimeMultiplier);
  earnings.push({
    code: 'overtime',
    amount: overtimePay,
    params: { hours: hours.overtimeHours, hourly: money(hourlyRate), multiplier: rules.overtimeMultiplier },
  });

  for (const a of worker.allowances || []) {
    earnings.push({ code: `allowance_${a.key}`, amount: money(a.amount), params: {} });
  }

  const gross = earnings.reduce((s, e) => s + e.amount, 0);

  if (worker.pf) {
    deductions.push({ code: 'pf', amount: money(basic * PF_RATE), params: { percent: PF_RATE * 100, basic } });
  }
  // Statutory ESI Wage Ceiling: workers earning > ₹21,000/month are exempt from ESI
  const monthlyWageEquivalent = worker.payType === 'monthly' ? worker.monthlySalary : dailyRate * STANDARD_MONTH_DAYS;
  if (worker.esi && monthlyWageEquivalent <= ESI_WAGE_CEILING) {
    deductions.push({ code: 'esi', amount: money(gross * ESI_RATE), params: { percent: ESI_RATE * 100, gross } });
  }
  if (extra.advances) {
    deductions.push({ code: 'advance', amount: money(extra.advances), params: {} });
  }

  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);

  return {
    hours,
    rates: { daily: money(dailyRate), hourly: money(hourlyRate), overtimeMultiplier: rules.overtimeMultiplier },
    earnings,
    deductions,
    gross,
    totalDeductions,
    net: gross - totalDeductions,
  };
}

module.exports = { calculatePayslip, STANDARD_MONTH_DAYS };
