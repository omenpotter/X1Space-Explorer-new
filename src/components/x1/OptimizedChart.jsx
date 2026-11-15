import { memo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { integer } from '@/lib/format';

const TICK = { fill: 'hsl(var(--ink-muted))', fontSize: 11 };
const DEFAULT_SERIES = [{ key: 'tps', name: 'TPS', color: 'hsl(var(--brand))' }];

/**
 * Line chart for measured time series (TPS, slot time). Colours come from the design tokens.
 * `series` is a list of { key, name, color }. Missing points are left as gaps, never interpolated.
 */
const OptimizedChart = memo(function OptimizedChart({
  data,
  xKey = 'time',
  series = DEFAULT_SERIES,
  yLabel,
  formatValue = integer,
  ariaLabel = 'Line chart',
}) {
  return (
    <div role="img" aria-label={ariaLabel} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="hsl(var(--line))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tick={TICK} tickLine={false} axisLine={{ stroke: 'hsl(var(--line))' }} minTickGap={40} />
          <YAxis
            tick={TICK}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={formatValue}
            domain={[0, 'auto']}
            label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: 'hsl(var(--ink-muted))', fontSize: 11, style: { textAnchor: 'middle' } } : undefined}
          />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--line-strong))' }}
            contentStyle={{ backgroundColor: 'hsl(var(--surface-2))', border: '1px solid hsl(var(--line-strong))', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'hsl(var(--ink-muted))' }}
            itemStyle={{ color: 'hsl(var(--ink))' }}
            formatter={(value, name) => [formatValue(value), name]}
          />
          {series.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: 'hsl(var(--ink-muted))' }} />}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export default OptimizedChart;
