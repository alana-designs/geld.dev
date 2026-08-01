import React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '../utils/format';

interface SpendTrendProps {
  data: {day: number;spent: number;}[];
  pace: number;
}

export function SpendTrend({ data, pace }: SpendTrendProps) {
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">Spending pace</h2>
        <span className="tabular text-xs text-muted">
          {formatCurrency(pace, false)} / day
        </span>
      </div>
      <div className="mt-3 h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c1743c" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#c1743c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#a39d94' }}
              interval="preserveStartEnd" />
            
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fontSize: 11, fill: '#a39d94' }}
              tickFormatter={(v: number) => `$${Math.round(v / 100) / 10}k`} />
            
            <Tooltip
              cursor={{ stroke: '#eceae5' }}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #eceae5',
                background: '#ffffff',
                fontSize: 12
              }}
              labelFormatter={(label) => `Day ${label}`}
              formatter={(value: number) => [formatCurrency(value, false), 'Cumulative']} />
            
            <Area
              type="monotone"
              dataKey="spent"
              stroke="#c1743c"
              strokeWidth={1.75}
              fill="url(#spendFill)" />
            
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>);

}