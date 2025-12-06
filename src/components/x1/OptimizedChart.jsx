import React, { memo } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

const OptimizedChart = memo(({ data, dataKey, stroke, name }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <XAxis dataKey="time" stroke="#6b7280" style={{ fontSize: '12px' }} />
        <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#1d2d3a', 
            border: '1px solid rgba(255,255,255,0.1)', 
            borderRadius: '8px' 
          }} 
        />
        <Line 
          type="monotone" 
          dataKey={dataKey} 
          stroke={stroke} 
          strokeWidth={2} 
          dot={false} 
          name={name}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

OptimizedChart.displayName = 'OptimizedChart';

export default OptimizedChart;