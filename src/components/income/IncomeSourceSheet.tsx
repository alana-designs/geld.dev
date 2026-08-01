import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FileTextIcon,
  KeyboardIcon,
  LoaderIcon,
  PlusIcon,
  ScanLineIcon,
  Trash2Icon,
  UploadIcon,
  XIcon } from
'lucide-react';
import { useBudget } from '../../contexts/BudgetContext';
import {
  DeductionDraft,
  IncomeSource,
  PayFrequency,
  TaxDraft } from
'../../types/income';
import { sampleParsedPaystub } from '../../data/income';
import { FREQUENCIES, frequencyMeta, sumAmounts } from '../../utils/income';
import { formatCurrency, parseAmount, sanitizeAmountInput, toAmountInput } from '../../utils/format';
import { DeductionEditor } from './DeductionEditor';

interface IncomeSourceSheetProps {
  open: boolean;
  source: IncomeSource | null;
  onClose: () => void;
}

type Stage = 'choose' | 'scanning' | 'form';

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export function IncomeSourceSheet({ open, source, onClose }: IncomeSourceSheetProps) {
  const { categories, saveIncomeSource, deleteIncomeSource } = useBudget();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('choose');
  const [fileName, setFileName] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [gross, setGross] = useState('');
  const [frequency, setFrequency] = useState<PayFrequency>('biweekly');
  const [preTax, setPreTax] = useState<DeductionDraft[]>([]);
  const [taxes, setTaxes] = useState<TaxDraft[]>([]);
  const [postTax, setPostTax] = useState<DeductionDraft[]>([]);
  const [override, setOverride] = useState('');
  const [review, setReview] = useState<string[]>([]);

  const savingsCategories = useMemo(
    () => categories.filter((c) => c.parent === 'Savings' && !c.archived),
    [categories]
  );

  useEffect(() => {
    if (!open) return;
    setFileName(null);
    setReview([]);
    if (source) {
      setStage('form');
      setName(source.name);
      setGross(toAmountInput(source.grossPay));
      setFrequency(source.frequency);
      setPreTax(
        source.preTax.map((d) => ({ ...d, amount: toAmountInput(d.amount) }))
      );
      setTaxes(source.taxes.map((t) => ({ ...t, amount: toAmountInput(t.amount) })));
      setPostTax(
        source.postTax.map((d) => ({ ...d, amount: toAmountInput(d.amount) }))
      );
      setOverride(source.netOverride != null ? toAmountInput(source.netOverride) : '');
    } else {
      setStage('choose');
      setName('');
      setGross('');
      setFrequency('biweekly');
      setPreTax([]);
      setTaxes([]);
      setPostTax([]);
      setOverride('');
    }
  }, [open, source]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const startManual = () => {
    setStage('form');
    setName('My paycheck');
    setPreTax([{ id: uid('pt'), label: '401(k) contribution', amount: '', tag: 'retirement', categoryId: savingsCategories[0]?.id }]);
    setTaxes([
    { id: uid('tx'), label: 'Federal income tax', amount: '' },
    { id: uid('tx'), label: 'State income tax', amount: '' },
    { id: uid('tx'), label: 'FICA', amount: '' }]
    );
    setPostTax([]);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStage('scanning');
    // Stand-in for OCR. Nothing is saved until the user confirms each line.
    setTimeout(() => {
      const pre = sampleParsedPaystub.preTax.map((d) => ({
        id: uid('pt'),
        label: d.label,
        amount: toAmountInput(d.amount),
        tag: d.tag,
        categoryId: d.tag === 'retirement' ? savingsCategories[0]?.id : undefined
      }));
      const tax = sampleParsedPaystub.taxes.map((t) => ({
        id: uid('tx'),
        label: t.label,
        amount: toAmountInput(t.amount)
      }));
      const post = sampleParsedPaystub.postTax.map((d) => ({
        id: uid('po'),
        label: d.label,
        amount: toAmountInput(d.amount),
        tag: d.tag,
        categoryId: d.tag === 'retirement' ? savingsCategories[0]?.id : undefined
      }));
      setName(sampleParsedPaystub.name);
      setGross(toAmountInput(sampleParsedPaystub.grossPay));
      setFrequency(sampleParsedPaystub.frequency);
      setPreTax(pre);
      setTaxes(tax);
      setPostTax(post);
      setReview(['gross', ...pre.map((r) => r.id), ...tax.map((r) => r.id), ...post.map((r) => r.id)]);
      setStage('form');
    }, 1700);
  };

  const confirmField = (id: string) => setReview((prev) => prev.filter((f) => f !== id));

  const grossValue = parseAmount(gross);
  const preTotal = sumAmounts(preTax.map((d) => ({ amount: parseAmount(d.amount) })));
  const taxTotal = sumAmounts(taxes.map((t) => ({ amount: parseAmount(t.amount) })));
  const postTotal = sumAmounts(postTax.map((d) => ({ amount: parseAmount(d.amount) })));
  const calculatedNet = grossValue - preTotal - taxTotal - postTotal;
  const netValue = override.trim() ? parseAmount(override) : calculatedNet;
  const monthly = netValue * frequencyMeta(frequency).perMonth;
  const retirementTotal =
  sumAmounts(preTax.filter((d) => d.tag === 'retirement').map((d) => ({ amount: parseAmount(d.amount) }))) +
  sumAmounts(postTax.filter((d) => d.tag === 'retirement').map((d) => ({ amount: parseAmount(d.amount) })));

  const canSave = name.trim().length > 0 && grossValue > 0 && review.length === 0;

  const save = () => {
    if (!canSave) return;
    saveIncomeSource({
      id: source?.id ?? uid('income'),
      memberId: source?.memberId ?? 'me',
      name: name.trim(),
      grossPay: grossValue,
      frequency,
      preTax: preTax.
      filter((d) => d.label.trim() && parseAmount(d.amount) > 0).
      map((d) => ({
        id: d.id,
        label: d.label.trim(),
        amount: parseAmount(d.amount),
        tag: d.tag,
        categoryId: d.tag === 'retirement' ? d.categoryId ?? savingsCategories[0]?.id : undefined
      })),
      taxes: taxes.
      filter((t) => t.label.trim() && parseAmount(t.amount) > 0).
      map((t) => ({ id: t.id, label: t.label.trim(), amount: parseAmount(t.amount) })),
      postTax: postTax.
      filter((d) => d.label.trim() && parseAmount(d.amount) > 0).
      map((d) => ({
        id: d.id,
        label: d.label.trim(),
        amount: parseAmount(d.amount),
        tag: d.tag,
        categoryId: d.tag === 'retirement' ? d.categoryId ?? savingsCategories[0]?.id : undefined
      })),
      netOverride: override.trim() ? parseAmount(override) : null,
      origin: fileName ? 'paystub' : source?.origin ?? 'manual',
      updatedAt: new Date().toISOString()
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open &&
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}>
        
          <div
          className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true" />
        
          <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={source ? 'Edit income source' : 'Add income source'}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 360, damping: 36 }}
          className="relative flex h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-line bg-canvas sm:h-[min(46rem,92vh)] sm:rounded-2xl">
          
            <header className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                {source ? 'Edit income' : 'Add income'}
              </span>
              <div className="flex items-center gap-1">
                {source &&
              <button
                type="button"
                onClick={() => {
                  deleteIncomeSource(source.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-alert hover:bg-alert/5">
                
                    <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </button>
              }
                <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-subtle transition-colors hover:bg-canvas hover:text-ink">
                
                  <XIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </header>

            {stage === 'choose' &&
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 px-5">
                <div>
                  <h2 className="text-xl font-bold tracking-[-0.03em] text-ink">
                    Where does your pay come from?
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    A paystub is a one-time document you hand over — not a bank connection. Nothing
                    saves until you confirm every line.
                  </p>
                </div>

                <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-ink/30">
              
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
                    <UploadIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">Upload a paystub</span>
                    <span className="block text-xs text-muted">
                      Image or PDF — we pre-fill, you review
                    </span>
                  </span>
                </button>
                <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFile}
              className="sr-only"
              aria-label="Upload paystub" />
            

                <button
              type="button"
              onClick={startManual}
              className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-ink/30">
              
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas text-ink">
                    <KeyboardIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">Enter it manually</span>
                    <span className="block text-xs text-muted">Same fields, typed in by hand</span>
                  </span>
                </button>
              </div>
          }

            {stage === 'scanning' &&
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/8 text-primary">
                  <ScanLineIcon className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-ink">Reading {fileName}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <LoaderIcon className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Pulling out gross pay, deductions, and taxes&hellip;
                </p>
              </div>
          }

            {stage === 'form' &&
          <>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
                  {review.length > 0 &&
              <div className="flex items-start gap-2.5 rounded-card border border-alert/25 bg-alert/5 px-3 py-2.5">
                      <FileTextIcon className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden="true" />
                      <p className="text-[12px] leading-relaxed text-ink">
                        Parsed from <span className="font-medium">{fileName}</span>.{' '}
                        <span className="font-medium text-alert">
                          {review.length} field{review.length === 1 ? '' : 's'} need review
                        </span>{' '}
                        — check each amount, then confirm.
                      </p>
                    </div>
              }

                  <section className="rounded-card border border-line bg-surface p-4">
                    <label htmlFor="income-name" className="text-xs font-medium text-muted">
                      Source name
                    </label>
                    <input
                  id="income-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Corp paycheck"
                  className="mt-1.5 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-ink" />
                

                    <div className="mt-3 flex gap-2">
                      <div className="min-w-0 flex-1">
                        <label htmlFor="income-gross" className="text-xs font-medium text-muted">
                          Gross pay
                        </label>
                        <div
                      className={`mt-1.5 flex items-center rounded-control border px-3 focus-within:border-ink ${
                      review.includes('gross') ? 'border-alert/35 bg-alert/[0.04]' : 'border-line'}`
                      }>
                      
                          <span className="text-sm text-subtle">$</span>
                          <input
                        id="income-gross"
                        value={gross}
                        inputMode="decimal"
                        onChange={(e) => {
                          setGross(sanitizeAmountInput(e.target.value));
                          confirmField('gross');
                        }}
                        placeholder="0"
                        className="tabular w-full bg-transparent px-1.5 py-2.5 text-sm text-ink outline-none" />
                      
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <label htmlFor="income-frequency" className="text-xs font-medium text-muted">
                          Pay frequency
                        </label>
                        <select
                      id="income-frequency"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as PayFrequency)}
                      className="mt-1.5 w-full rounded-control border border-line bg-surface px-2.5 py-2.5 text-sm text-ink outline-none focus:border-ink">
                      
                          {FREQUENCIES.map((f) =>
                      <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                      )}
                        </select>
                      </div>
                    </div>

                    {review.includes('gross') &&
                <button
                  type="button"
                  onClick={() => confirmField('gross')}
                  className="mt-2 rounded-full border border-alert/25 bg-alert/10 px-2.5 py-1 text-[11px] font-medium text-alert">
                  
                        Gross pay looks right
                      </button>
                }
                  </section>

                  <DeductionEditor
                title="Pre-tax deductions"
                hint="Tag anything that's really savings — 401(k), HSA — so it feeds your savings rate."
                rows={preTax}
                savingsCategories={savingsCategories}
                reviewIds={review}
                onChange={setPreTax}
                onConfirm={confirmField} />
              

                  <section className="rounded-card border border-line bg-surface">
                    <div className="border-b border-line px-4 py-2.5">
                      <h3 className="text-sm font-semibold tracking-[-0.01em] text-ink">
                        Taxes withheld
                      </h3>
                      <p className="mt-0.5 text-[11px] text-subtle">
                        Informational line items — never categories.
                      </p>
                    </div>
                    <ul className="divide-y divide-line">
                      {taxes.map((row) =>
                  <li
                    key={row.id}
                    className={`flex items-center gap-2 px-3 py-2.5 ${
                    review.includes(row.id) ? 'bg-alert/[0.04]' : ''}`
                    }>
                    
                          <input
                      value={row.label}
                      onChange={(e) => {
                        setTaxes(
                          taxes.map((t) =>
                          t.id === row.id ? { ...t, label: e.target.value } : t
                          )
                        );
                        confirmField(row.id);
                      }}
                      aria-label="Tax label"
                      className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 py-2 text-sm text-ink outline-none focus:border-ink" />
                    
                          <div className="flex w-24 shrink-0 items-center rounded-control border border-line bg-surface px-2 focus-within:border-ink">
                            <span className="text-sm text-subtle">$</span>
                            <input
                        value={row.amount}
                        inputMode="decimal"
                        onChange={(e) => {
                          setTaxes(
                            taxes.map((t) =>
                            t.id === row.id ?
                            { ...t, amount: sanitizeAmountInput(e.target.value) } :
                            t
                            )
                          );
                          confirmField(row.id);
                        }}
                        aria-label="Tax amount"
                        className="tabular w-full bg-transparent px-1 py-2 text-right text-sm text-ink outline-none" />
                      
                          </div>
                          <button
                      type="button"
                      onClick={() => setTaxes(taxes.filter((t) => t.id !== row.id))}
                      aria-label={`Remove ${row.label || 'tax line'}`}
                      className="shrink-0 rounded-full p-1.5 text-subtle hover:bg-canvas hover:text-ink">
                      
                            <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </li>
                  )}
                    </ul>
                    <button
                  type="button"
                  onClick={() =>
                  setTaxes([...taxes, { id: uid('tx'), label: '', amount: '' }])
                  }
                  className="flex w-full items-center justify-center gap-1.5 border-t border-line py-2.5 text-xs font-medium text-muted hover:text-ink">
                  
                      <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      Add tax line
                    </button>
                  </section>

                  <DeductionEditor
                title="Post-tax deductions"
                hint="Roth transfers count as Retirement/Savings; garnishments and benefits are Other."
                rows={postTax}
                savingsCategories={savingsCategories}
                reviewIds={review}
                onChange={setPostTax}
                onConfirm={confirmField} />
              

                  <section className="rounded-card border border-line bg-surface p-4">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
                          Take-home per period
                        </p>
                        <p className="tabular text-3xl font-bold tracking-[-0.03em] text-ink">
                          {formatCurrency(netValue)}
                        </p>
                      </div>
                      <p className="tabular text-xs text-muted">
                        {formatCurrency(monthly, false)} / month
                      </p>
                    </div>

                    <dl className="tabular mt-3 space-y-1 border-t border-line pt-3 text-xs text-muted">
                      <Row label="Gross" value={formatCurrency(grossValue)} />
                      <Row label="Pre-tax deductions" value={`− ${formatCurrency(preTotal)}`} />
                      <Row label="Taxes withheld" value={`− ${formatCurrency(taxTotal)}`} />
                      <Row label="Post-tax deductions" value={`− ${formatCurrency(postTotal)}`} />
                      <Row
                    label="Calculated net"
                    value={formatCurrency(calculatedNet)}
                    strong />
                  
                    </dl>

                    <label htmlFor="income-override" className="mt-3 block text-xs font-medium text-muted">
                      Override take-home <span className="text-subtle">(optional)</span>
                    </label>
                    <div className="mt-1.5 flex items-center rounded-control border border-line px-3 focus-within:border-ink">
                      <span className="text-sm text-subtle">$</span>
                      <input
                    id="income-override"
                    value={override}
                    inputMode="decimal"
                    onChange={(e) => setOverride(sanitizeAmountInput(e.target.value))}
                    placeholder={toAmountInput(calculatedNet) || '0'}
                    className="tabular w-full bg-transparent px-1.5 py-2.5 text-sm text-ink outline-none" />
                  
                    </div>

                    {retirementTotal > 0 &&
                <p className="mt-3 rounded-control bg-savings/8 px-3 py-2 text-[11px] leading-relaxed text-ink">
                        <span className="font-semibold">
                          {formatCurrency(retirementTotal)} per paycheck
                        </span>{' '}
                        is tagged Retirement/Savings. It posts as a Savings entry marked{' '}
                        <span className="font-medium">Auto · from paycheck</span> — counted in your
                        total savings rate, not against take-home.
                      </p>
                }
                  </section>
                </div>

                <div
              className="shrink-0 border-t border-line bg-surface px-4 py-3"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              
                  <button
                type="button"
                onClick={save}
                disabled={!canSave}
                className="h-12 w-full rounded-control bg-primary text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:bg-line disabled:text-subtle">
                
                    {review.length > 0 ?
                `Confirm ${review.length} field${review.length === 1 ? '' : 's'} to save` :
                !name.trim() ?
                'Name this income source' :
                grossValue <= 0 ?
                'Enter gross pay' :
                source ?
                'Save changes' :
                'Save income source'}
                  </button>
                </div>
              </>
          }
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}

function Row({ label, value, strong }: {label: string;value: string;strong?: boolean;}) {
  return (
    <div className={`flex justify-between ${strong ? 'text-ink' : ''}`}>
      <dt className={strong ? 'font-medium' : ''}>{label}</dt>
      <dd className={strong ? 'font-semibold' : ''}>{value}</dd>
    </div>);

}