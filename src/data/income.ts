import { IncomeSource } from '../types/income';

export const seedIncomeSources: IncomeSource[] = [
{
  id: 'income-main',
  memberId: 'me',
  name: 'Main paycheck',
  grossPay: 4200,
  frequency: 'biweekly',
  preTax: [
  { id: 'pt-401k', label: '401(k) contribution', amount: 380, tag: 'retirement', categoryId: 'retirement' },
  { id: 'pt-hsa', label: 'HSA', amount: 100, tag: 'retirement', categoryId: 'emergency' },
  { id: 'pt-health', label: 'Health premium', amount: 145, tag: 'other' }],

  taxes: [
  { id: 'tx-fed', label: 'Federal income tax', amount: 520 },
  { id: 'tx-state', label: 'State income tax', amount: 180 },
  { id: 'tx-fica', label: 'FICA (Social Security + Medicare)', amount: 245 }],

  postTax: [
  { id: 'po-roth', label: 'Roth IRA transfer', amount: 150, tag: 'retirement', categoryId: 'brokerage' },
  { id: 'po-life', label: 'Life insurance', amount: 15, tag: 'other' }],

  netOverride: null,
  origin: 'paystub',
  updatedAt: new Date().toISOString()
}];


/**
 * Stand-in for OCR output. Claude Code swaps this for a real parser —
 * the review-and-confirm step around it stays exactly the same.
 */
export const sampleParsedPaystub = {
  name: 'Acme Corp paycheck',
  grossPay: 3150,
  frequency: 'biweekly' as const,
  preTax: [
  { label: '401(k) EE contribution', amount: 252, tag: 'retirement' as const },
  { label: 'Dental + vision premium', amount: 42.5, tag: 'other' as const }],

  taxes: [
  { label: 'Federal income tax', amount: 388.2 },
  { label: 'State income tax', amount: 131.75 },
  { label: 'Social Security', amount: 179.8 },
  { label: 'Medicare', amount: 42.05 }],

  postTax: [{ label: 'Roth 401(k)', amount: 90, tag: 'retirement' as const }]
};