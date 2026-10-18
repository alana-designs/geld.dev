import { useEffect, useMemo, useRef, useState } from 'react';
import { ZapIcon } from 'lucide-react';

/**
 * The forest-green stage beside the sign-in card: a looping, fake ledger that
 * shows what Geld does before you're in it. Purely decorative — aria-hidden,
 * and it holds still for anyone who asked for reduced motion.
 *
 * The numbers here are invented. Nothing in this file touches Supabase.
 */

type Parent = 'Needs' | 'Wants' | 'Savings';
type SegKey = 'rent' | 'groceries' | 'dining' | 'transport' | 'subs' | 'else';

const COLORS: Record<Parent, string> = {
  Needs: '#2f4832',
  Wants: '#c4764c',
  Savings: '#3f7a78'
};
const GOALS: Record<Parent, number> = { Needs: 3100, Wants: 800, Savings: 1000 };
const PARENTS: Parent[] = ['Needs', 'Wants', 'Savings'];

const SEGS: { k: SegKey; name: string; color: string }[] = [
  { k: 'rent', name: 'Rent', color: '#2f4832' },
  { k: 'groceries', name: 'Groceries', color: '#3f7a78' },
  { k: 'dining', name: 'Dining out', color: '#c4764c' },
  { k: 'transport', name: 'Transport', color: '#d4b170' },
  { k: 'subs', name: 'Subscriptions', color: '#8a5f7e' },
  { k: 'else', name: 'Everything else', color: '#8fbfa3' }
];

interface Ledger {
  income: number;
  parent: Record<Parent, number>;
  seg: Record<SegKey, number>;
}

const BASE: Ledger = {
  income: 6200,
  parent: { Needs: 2570, Wants: 414, Savings: 500 },
  seg: { rent: 1850, groceries: 420, dining: 240, transport: 160, subs: 64, else: 750 }
};

interface Entry {
  id: number;
  d: string;
  a: number;
  c?: string;
  p?: Parent;
  s?: SegKey;
  income?: boolean;
  auto?: string;
  entering?: boolean;
}

const QUEUE: Omit<Entry, 'id'>[] = [
  { d: 'Trader Joe’s', c: 'Groceries', p: 'Needs', s: 'groceries', a: 68.4 },
  { d: 'Blue Bottle Coffee', c: 'Dining out', p: 'Wants', s: 'dining', a: 6.75 },
  { d: 'Shell', c: 'Gas', p: 'Needs', s: 'transport', a: 52.18 },
  { income: true, d: 'Paycheck', a: 2450 },
  { d: 'Spotify', c: 'Subscriptions', p: 'Wants', s: 'subs', a: 11.99 },
  { d: 'Transfer to emergency fund', c: 'Emergency fund', p: 'Savings', s: 'else', a: 250 },
  { d: 'Dinner with Maya', c: 'Dining out', p: 'Wants', s: 'dining', a: 74.2 },
  { d: 'PG&E', c: 'Utilities', p: 'Needs', s: 'else', a: 96.3 },
  { d: 'Farmers market', c: 'Groceries', p: 'Needs', s: 'groceries', a: 41.5 },
  { d: 'Target', c: 'Shopping', p: 'Wants', s: 'else', a: 38.27 }
];

const SEED: Omit<Entry, 'id'>[] = [
  { d: 'Rent', c: 'Rent', p: 'Needs', a: 1850, auto: 'Auto · from Expense' },
  { d: 'Safeway', c: 'Groceries', p: 'Needs', a: 54.9 },
  { d: 'Peet’s Coffee', c: 'Dining out', p: 'Wants', a: 5.5 },
  { d: 'Netflix', c: 'Subscriptions', p: 'Wants', a: 15.49 },
  { income: true, d: 'Paycheck', a: 2450, auto: 'Auto · from paycheck' }
];

const RADIUS = 56;
const CIRC = 2 * Math.PI * RADIUS;

function money(n: number, dec: number) {
  return (
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
  );
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduce;
}

/** Eases a number toward its new value so totals roll rather than jump. */
function useTween(value: number, reduce: boolean) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef<number>();

  useEffect(() => {
    if (reduce) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      const eased = 1 - Math.pow(1 - k, 3);
      const next = start + (value - start) * eased;
      from.current = next;
      setShown(next);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, reduce]);

  return shown;
}

function Amount({
  value,
  dec = 0,
  prefix = '',
  reduce
}: {
  value: number;
  dec?: number;
  prefix?: string;
  reduce: boolean;
}) {
  return <>{prefix + money(useTween(value, reduce), dec)}</>;
}

function EntryRow({ entry }: { entry: Entry }) {
  return (
    <li className={'row' + (entry.entering ? ' enter' : '')}>
      <div className="row-in">
        <div className="row-main">
          <p className="row-title">{entry.d}</p>
          <div className="row-meta">
            {entry.income ? (
              <span className="auto">
                <ZapIcon className="h-2.5 w-2.5" aria-hidden="true" />
                {entry.auto ?? 'Auto · from paycheck'}
              </span>
            ) : (
              <>
                <span className={'badge ' + entry.p}>
                  <span className="dot" />
                  {entry.p}
                </span>
                <span className="cn">{entry.c}</span>
                {entry.auto && (
                  <span className="auto">
                    <ZapIcon className="h-2.5 w-2.5" aria-hidden="true" />
                    {entry.auto}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <span className={'row-amt tabular' + (entry.income ? ' in' : '')}>
          {(entry.income ? '+' : '') + money(entry.a, 2)}
        </span>
      </div>
    </li>
  );
}

export function LoginShowcase() {
  const reduce = usePrefersReducedMotion();
  const [ledger, setLedger] = useState<Ledger>(BASE);
  const [feed, setFeed] = useState<Entry[]>(() =>
    SEED.map((t, i) => ({ ...t, id: -i - 1 })).reverse()
  );
  const [toast, setToast] = useState<number | null>(null);
  const [pulse, setPulse] = useState(0);

  const cursor = useRef(0);
  const nextId = useRef(1);

  useEffect(() => {
    if (reduce) return;

    const tick = () => {
      const t = QUEUE[cursor.current % QUEUE.length];
      cursor.current += 1;
      const lap = cursor.current % QUEUE.length === 0;

      setFeed((prev) => [{ ...t, id: nextId.current++, entering: true }, ...prev].slice(0, 8));

      if (t.income) {
        setLedger((p) => ({ ...p, income: p.income + t.a }));
        setToast(t.a);
        setPulse((n) => n + 1);
      } else {
        setLedger((p) => ({
          ...p,
          parent: { ...p.parent, [t.p!]: p.parent[t.p!] + t.a },
          seg: { ...p.seg, [t.s!]: p.seg[t.s!] + t.a }
        }));
      }

      // A full lap through the queue, then the month resets and it runs again.
      if (lap) setTimeout(() => setLedger(BASE), 2400);
    };

    let interval: ReturnType<typeof setInterval> | undefined;
    const kickoff = setTimeout(() => {
      tick();
      interval = setInterval(tick, 2900);
    }, 1800);

    return () => {
      clearTimeout(kickoff);
      if (interval) clearInterval(interval);
    };
  }, [reduce]);

  useEffect(() => {
    if (toast === null) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const spent = ledger.parent.Needs + ledger.parent.Wants + ledger.parent.Savings;
  const left = ledger.income - spent;
  const total = Math.max(ledger.income, spent);

  // Each bucket's arc picks up where the last one left off, with a hairline gap
  // so touching segments stay legible.
  const arcs = useMemo(() => {
    let start = 0;
    return PARENTS.map((p) => {
      const len = (ledger.parent[p] / total) * CIRC;
      const shown = Math.max(0, len - (len > 3 ? 2 : 0));
      const arc = { p, dash: `${shown} ${CIRC - shown}`, offset: -start };
      start += len;
      return arc;
    });
  }, [ledger, total]);

  return (
    <section className="showcase" aria-label="Preview of Geld">
      <div className="showcase-inner">
        <div className="pitch">
          <h2>Type it in. Know where it went.</h2>
          <p>
            Geld never connects to your bank. Every dollar you log is one you actually noticed.
          </p>
        </div>

        <div className="stage" aria-hidden="true">
          <div className="col">
            <section className="card">
              <div className="card-head">
                <h3>Overview</h3>
                <span>October</span>
              </div>
              <div className="ov-body">
                <div className="donut">
                  <svg viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r={RADIUS} stroke="var(--line)" />
                    {arcs.map(({ p, dash, offset }) => (
                      <circle
                        key={p}
                        cx="70"
                        cy="70"
                        r={RADIUS}
                        stroke={COLORS[p]}
                        style={{ strokeDasharray: dash, strokeDashoffset: offset }}
                      />
                    ))}
                  </svg>
                  <div className="donut-center">
                    <small>Left to spend</small>
                    <b className="tabular">
                      <Amount value={left} reduce={reduce} />
                    </b>
                  </div>
                </div>
                <div className="buckets">
                  {PARENTS.map((p) => {
                    const over = ledger.parent[p] > GOALS[p];
                    return (
                      <div key={p}>
                        <div className="bucket-top">
                          <span className="bucket-name">
                            <span className="dot" style={{ background: COLORS[p] }} />
                            {p}
                          </span>
                          <span className="bucket-amt tabular">
                            <Amount value={ledger.parent[p]} reduce={reduce} />
                          </span>
                        </div>
                        <div className="goal">
                          <i
                            style={{
                              width: Math.min((ledger.parent[p] / GOALS[p]) * 100, 100) + '%',
                              background: over ? '#b1462d' : COLORS[p]
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="ov-foot">
                <div key={pulse} className={pulse ? 'pulse' : undefined}>
                  <small>Income</small>
                  <b className="tabular plus">
                    <Amount value={ledger.income} prefix="+" reduce={reduce} />
                  </b>
                </div>
                <div>
                  <small>Spent</small>
                  <b className="tabular">
                    <Amount value={spent} reduce={reduce} />
                  </b>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h3>Top categories</h3>
                <span>Biggest first</span>
              </div>
              <div className="cat-body">
                <div className="stack">
                  {SEGS.map((g) => (
                    <i key={g.k} style={{ background: g.color, flexGrow: ledger.seg[g.k] }} />
                  ))}
                </div>
                <ul className="legend">
                  {SEGS.map((g) => (
                    <li key={g.k}>
                      <span className="dot" style={{ background: g.color }} />
                      <span className="nm">{g.name}</span>
                      <span className="am tabular">
                        <Amount value={ledger.seg[g.k]} reduce={reduce} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <div className="col">
            <div className={'toast' + (toast !== null ? ' show' : '')}>
              <span className="ic">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 19V5" />
                  <path d="m5 12 7-7 7 7" />
                </svg>
              </span>
              <div>
                <b className="tabular">+{money(toast ?? 2450, 2)}</b> <span>Paycheck added</span>
              </div>
            </div>
            <section className="card">
              <div className="card-head">
                <h3>Recent entries</h3>
                <span>Newest first</span>
              </div>
              <ul className="feed">
                {feed.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} />
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
