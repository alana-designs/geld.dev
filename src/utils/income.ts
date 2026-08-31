// Payroll auto-savings entries are generated server-side now — see
// generate_paycheck_entries() in migration 0012 and the daily pg_cron job in
// 0013. payDatesInMonth()/generateAutoEntries() used to compute them live here
// and were removed so the pay-date math has exactly one owner.
import { Deduction, IncomeSource, PayFrequency } from '../types/income';

export const FREQUENCIES: {
  value: PayFrequency;
  label: string;
  short: string;
  perMonth: number;
}[] = [
{ value: 'weekly', label: 'Weekly', short: 'per week', perMonth: 52 / 12 },
{ value: 'biweekly', label: 'Every 2 weeks', short: 'every 2 weeks', perMonth: 26 / 12 },
{ value: 'semimonthly', label: 'Twice a month', short: 'twice a month', perMonth: 2 },
{ value: 'monthly', label: 'Monthly', short: 'per month', perMonth: 1 }];


export function frequencyMeta(frequency: PayFrequency) {
  return FREQUENCIES.find((f) => f.value === frequency) ?? FREQUENCIES[1];
}

export function sumAmounts(rows: {amount: number;}[]) {
  return rows.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0);
}

export function computedNet(source: IncomeSource) {
  return (
    source.grossPay - sumAmounts(source.preTax) - sumAmounts(source.taxes) - sumAmounts(source.postTax));

}

export function netPerPeriod(source: IncomeSource) {
  return source.netOverride ?? computedNet(source);
}

/**
 * Salaried sources project a fixed rate every month, regardless of which
 * month is being viewed. Hourly sources have no rate to project — each one
 * is a single logged paycheck that counts only toward the month it was
 * actually received (`monthKey`), the same way a dated transaction does.
 * Log a new hourly source each payday and each one lands in its own month;
 * averaging several of them together is a follow-up feature.
 */
export function monthlyNet(source: IncomeSource, monthKey: string) {
  if (source.payType === 'hourly') {
    if (!source.paycheckDate || source.paycheckDate.slice(0, 7) !== monthKey) return 0;
    return netPerPeriod(source);
  }
  if (!source.frequency) return 0;
  return netPerPeriod(source) * frequencyMeta(source.frequency).perMonth;
}

export function totalMonthlyNet(sources: IncomeSource[], monthKey: string) {
  return sources.reduce((sum, source) => sum + monthlyNet(source, monthKey), 0);
}

export function retirementDeductions(source: IncomeSource): Deduction[] {
  return [...source.preTax, ...source.postTax].filter((d) => d.tag === 'retirement');
}
