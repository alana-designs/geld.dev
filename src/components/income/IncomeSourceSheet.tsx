import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import { BriefcaseIcon, ClockIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useBudget } from '../../contexts/BudgetContext';
import {
  DeductionDraft,
  IncomeSource,
  PayFrequency,
  PayType,
  SemimonthlySchedule,
  TaxDraft } from
'../../types/income';
import { FREQUENCIES, frequencyMeta, sumAmounts } from '../../utils/income';
import { monthLabel, toMonthKey } from '../../utils/rollups';
import { formatCurrency, parseAmount, sanitizeAmountInput, toAmountInput } from '../../utils/format';
import { DeductionEditor } from './DeductionEditor';

interface IncomeSourceSheetProps {
  open: boolean;
  source: IncomeSource | null;
  onClose: () => void;
}

type Stage = 'payType' | 'form';

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
const today = () => format(new Date(), 'yyyy-MM-dd');

const SEMIMONTHLY_OPTIONS: {value: SemimonthlySchedule;label: string;}[] = [
{ value: '1st_15th', label: '1st & 15th' },
{ value: '15th_last', label: '15th & last day' }];


const defaultDeductions = (savingsCategoryId: string | undefined) => ({
  preTax: [
  {
    id: uid('pt'),
    label: '401(k) contribution',
    amount: '',
    tag: 'retirement' as const,
    categoryId: savingsCategoryId
  }],

  taxes: [
  { id: uid('tx'), label: 'Federal income tax', amount: '' },
  { id: uid('tx'), label: 'State income tax', amount: '' },
  { id: uid('tx'), label: 'FICA', amount: '' }]

});

export function IncomeSourceSheet({ open, source, onClose }: IncomeSourceSheetProps) {
  const { categories, saveIncomeSource, deleteIncomeSource } = useBudget();

  const [stage, setStage] = useState<Stage>('payType');
  const [payType, setPayType] = useState<PayType>('salaried');
  const [name, setName] = useState('');
  const [gross, setGross] = useState('');
  const [frequency, setFrequency] = useState<PayFrequency>('biweekly');
  const [semimonthlySchedule, setSemimonthlySchedule] = useState<SemimonthlySchedule>('1st_15th');
  const [paycheckDate, setPaycheckDate] = useState(today);
  const [preTax, setPreTax] = useState<DeductionDraft[]>([]);
  const [taxes, setTaxes] = useState<TaxDraft[]>([]);
  const [postTax, setPostTax] = useState<DeductionDraft[]>([]);
  const [override, setOverride] = useState('');

  const savingsCategories = useMemo(
    () => categories.filter((c) => c.parent === 'Savings' && !c.archived),
    [categories]
  );

  useEffect(() => {
    if (!open) return;
    if (source) {
      setStage('form');
      setPayType(source.payType);
      setName(source.name);
      setGross(toAmountInput(source.grossPay));
      setFrequency(source.frequency ?? 'biweekly');
      setSemimonthlySchedule(source.semimonthlySchedule ?? '1st_15th');
      setPaycheckDate(source.paycheckDate ?? today());
      setPreTax(
        source.preTax.map((d) => ({ ...d, amount: toAmountInput(d.amount) }))
      );
      setTaxes(source.taxes.map((t) => ({ ...t, amount: toAmountInput(t.amount) })));
      setPostTax(
        source.postTax.map((d) => ({ ...d, amount: toAmountInput(d.amount) }))
      );
      setOverride(source.netOverride != null ? toAmountInput(source.netOverride) : '');
    } else {
      setStage('payType');
      setPayType('salaried');
      setName('My paycheck');
      setGross('');
      setFrequency('biweekly');
      setSemimonthlySchedule('1st_15th');
      setPaycheckDate(today());
      const defaults = defaultDeductions(savingsCategories[0]?.id);
      setPreTax(defaults.preTax);
      setTaxes(defaults.taxes);
      setPostTax([]);
      setOverride('');
    }
  }, [open, source]);

  const choosePayType = (type: PayType) => {
    setPayType(type);
    setStage('form');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const grossValue = parseAmount(gross);
  const preTotal = sumAmounts(preTax.map((d) => ({ amount: parseAmount(d.amount) })));
  const taxTotal = sumAmounts(taxes.map((t) => ({ amount: parseAmount(t.amount) })));
  const postTotal = sumAmounts(postTax.map((d) => ({ amount: parseAmount(d.amount) })));
  const calculatedNet = grossValue - preTotal - taxTotal - postTotal;
  const netValue = override.trim() ? parseAmount(override) : calculatedNet;
  const monthly = payType === 'hourly' ? null : netValue * frequencyMeta(frequency).perMonth;
  const paycheckMonthLabel = payType === 'hourly' && paycheckDate ? monthLabel(toMonthKey(paycheckDate)) : null;
  const retirementTotal =
  sumAmounts(preTax.filter((d) => d.tag === 'retirement').map((d) => ({ amount: parseAmount(d.amount) }))) +
  sumAmounts(postTax.filter((d) => d.tag === 'retirement').map((d) => ({ amount: parseAmount(d.amount) })));

  const canSave =
  name.trim().length > 0 &&
  grossValue > 0 && (
  payType === 'salaried' || Boolean(paycheckDate));

  const save = async () => {
    if (!canSave) return;
    try {
      await saveIncomeSource({
      id: source?.id ?? uid('income'),
      memberId: source?.memberId ?? 'me',
      name: name.trim(),
      payType,
      grossPay: grossValue,
      frequency: payType === 'hourly' ? null : frequency,
      semimonthlySchedule:
      payType === 'salaried' && frequency === 'semimonthly' ? semimonthlySchedule : null,
      paycheckDate: payType === 'hourly' ? paycheckDate : null,
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
      updatedAt: new Date().toISOString()
      });
      onClose();
    } catch (err) {
      console.error(err);
    }
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
          aria-label={
          source ? 'Edit income source' : stage === 'payType' ? 'Choose pay type' : 'Add income source'}
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
                onClick={async () => {
                  try {
                    await deleteIncomeSource(source.id);
                    onClose();
                  } catch (err) {
                    console.error(err);
                  }
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

            {stage === 'payType' &&
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 px-5">
                <div>
                  <h2 className="text-xl font-bold tracking-[-0.03em] text-ink">
                    How are you paid?
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    This changes what we ask for next.
                  </p>
                </div>

                <button
              type="button"
              onClick={() => choosePayType('salaried')}
              className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-ink/30">

                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
                    <BriefcaseIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">Salaried</span>
                    <span className="block text-xs text-muted">
                      Fixed pay on a regular schedule
                    </span>
                  </span>
                </button>

                <button
              type="button"
              onClick={() => choosePayType('hourly')}
              className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-ink/30">

                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas text-ink">
                    <ClockIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">Hourly</span>
                    <span className="block text-xs text-muted">
                      Pay varies — log each paycheck as it comes
                    </span>
                  </span>
                </button>
              </div>
          }

            {stage === 'form' &&
          <>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
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
                        <div className="mt-1.5 flex items-center rounded-control border border-line px-3 focus-within:border-ink">
                          <span className="text-sm text-subtle">$</span>
                          <input
                        id="income-gross"
                        value={gross}
                        inputMode="decimal"
                        onChange={(e) => setGross(sanitizeAmountInput(e.target.value))}
                        placeholder="0"
                        className="tabular w-full bg-transparent px-1.5 py-2.5 text-sm text-ink outline-none" />

                        </div>
                      </div>
                      {payType === 'salaried' ?
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

                          {frequency === 'semimonthly' &&
                      <select
                        id="income-semimonthly-schedule"
                        value={semimonthlySchedule}
                        onChange={(e) => setSemimonthlySchedule(e.target.value as SemimonthlySchedule)}
                        aria-label="Which two days paychecks land on"
                        className="mt-1.5 w-full rounded-control border border-line bg-surface px-2.5 py-2.5 text-sm text-ink outline-none focus:border-ink">

                              {SEMIMONTHLY_OPTIONS.map((opt) =>
                        <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                        )}
                            </select>
                      }
                        </div> :

                  <div className="min-w-0 flex-1">
                          <label htmlFor="income-paycheck-date" className="text-xs font-medium text-muted">
                            Paycheck received
                          </label>
                          <input
                        id="income-paycheck-date"
                        type="date"
                        value={paycheckDate}
                        max={today()}
                        onChange={(e) => setPaycheckDate(e.target.value)}
                        className="mt-1.5 w-full rounded-control border border-line bg-surface px-2.5 py-2.5 text-sm text-ink outline-none focus:border-ink" />

                        </div>
                  }
                    </div>

                    {payType === 'hourly' &&
                <p className="mt-3 text-[11px] leading-relaxed text-subtle">
                        No fixed schedule — log a new income source each time you're paid.
                        {paycheckMonthLabel && ` This one counts toward ${paycheckMonthLabel}'s take-home.`}
                      </p>
                }
                  </section>

                  <DeductionEditor
                title="Pre-tax deductions"
                hint="Tag anything that's really savings — 401(k), HSA — so it feeds your savings rate."
                rows={preTax}
                savingsCategories={savingsCategories}
                onChange={setPreTax} />


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
                  <li key={row.id} className="flex items-center gap-2 px-3 py-2.5">
                          <input
                      value={row.label}
                      onChange={(e) =>
                      setTaxes(
                        taxes.map((t) =>
                        t.id === row.id ? { ...t, label: e.target.value } : t
                        )
                      )
                      }
                      aria-label="Tax label"
                      className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 py-2 text-sm text-ink outline-none focus:border-ink" />

                          <div className="flex w-24 shrink-0 items-center rounded-control border border-line bg-surface px-2 focus-within:border-ink">
                            <span className="text-sm text-subtle">$</span>
                            <input
                        value={row.amount}
                        inputMode="decimal"
                        onChange={(e) =>
                        setTaxes(
                          taxes.map((t) =>
                          t.id === row.id ?
                          { ...t, amount: sanitizeAmountInput(e.target.value) } :
                          t
                          )
                        )
                        }
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
                onChange={setPostTax} />


                  <section className="rounded-card border border-line bg-surface p-4">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
                          {payType === 'hourly' ? 'Take-home this paycheck' : 'Take-home per period'}
                        </p>
                        <p className="tabular text-3xl font-bold tracking-[-0.03em] text-ink">
                          {formatCurrency(netValue)}
                        </p>
                      </div>
                      <p className="tabular text-xs text-muted">
                        {monthly !== null ?
                    `${formatCurrency(monthly, false)} / month` :
                    paycheckMonthLabel ?
                    `Counts toward ${paycheckMonthLabel}` :
                    'Not counted toward monthly take-home yet'}
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

                    {retirementTotal > 0 && payType === 'salaried' &&
                <p className="mt-3 rounded-control bg-savings/8 px-3 py-2 text-[11px] leading-relaxed text-ink">
                        <span className="font-semibold">
                          {formatCurrency(retirementTotal)} per paycheck
                        </span>{' '}
                        is tagged Retirement/Savings. It posts as a Savings entry marked{' '}
                        <span className="font-medium">Auto · from paycheck</span> — counted in your
                        total savings rate, not against take-home.
                      </p>
                }
                    {retirementTotal > 0 && payType === 'hourly' &&
                <p className="mt-3 rounded-control bg-savings/8 px-3 py-2 text-[11px] leading-relaxed text-ink">
                        <span className="font-semibold">
                          {formatCurrency(retirementTotal)} per paycheck
                        </span>{' '}
                        is tagged Retirement/Savings, but with no fixed schedule this won&rsquo;t
                        auto-post as a Savings entry — log it as a manual entry if you want it
                        tracked.
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
                
                    {!name.trim() ?
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