import React from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function PerformanceChart({ 
  data, 
  dataKey = 'value', 
  color = '#06b6d4', 
  title, 
  unit = '', 
  type = 'line',
  showGrid = false,
  height = 150
}) {
  const formatValue = (value) => {
    if (unit === ' XNT') {
      if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
      if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
      return value?.toFixed(0);
    }
    return value?.toFixed(2);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1d2d3a] border border-white/10 rounded-lg p-2 text-sm">
          <p className="text-gray-400">{label}</p>
          <p className="text-white font-medium">
            {formatValue(payload[0].value)}{unit}
          </p>
        </div>
      );
    }
    return null;
  };

  const ChartComponent = type === 'area' ? AreaChart : LineChart;
  const DataComponent = type === 'area' ? Area : Line;

  return (
    <div className="bg-[#24384a] rounded-xl p-4">
      <h3 className="text-gray-400 text-xs mb-3">{title}</h3>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
            <XAxis 
              dataKey="label" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6b7280', fontSize: 10 }} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6b7280', fontSize: 10 }}
              width={40}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            {type === 'area' ? (
              <Area 
                type="monotone" 
                dataKey={dataKey} 
                stroke={color} 
                fill={color}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            ) : (
              <Line 
                type="monotone" 
                dataKey={dataKey} 
                stroke={color} 
                strokeWidth={2}
                dot={false}
              />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
}