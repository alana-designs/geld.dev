export function formatCurrency(amount: number, showCents = true): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0
  });
}

/**
 * Keeps a raw amount string typeable: digits, at most one manually-typed
 * decimal point, and no more than two decimal places. "17" stays $17 — we
 * never shift digits into cents on the user's behalf.
 */
export function sanitizeAmountInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  const trimmedWhole = whole.replace(/^0+(?=\d)/, '').slice(0, 9);
  if (rest.length === 0) return trimmedWhole;
  return `${trimmedWhole}.${rest.join('').slice(0, 2)}`;
}

export function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Turns a stored amount back into something the user could have typed. */
export function toAmountInput(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}