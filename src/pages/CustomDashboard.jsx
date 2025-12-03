import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, Plus, X, Save, LayoutGrid, Settings, 
  Loader2, RefreshCw, GripVertical, Trash2, Eye, EyeOff,
  Zap, Activity, Users, Coins, Clock, TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LineChart, Line, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';
import X1Rpc from '../components/x1/X1RpcService';

// Available widgets
const WIDGET_TYPES = {
  network_stats: { name: 'Network Stats', icon: Zap, size: 'medium' },
  tps_chart: { name: 'TPS Chart', icon: Activity, size: 'large' },
  validators: { name: 'Validator Summary', icon: Users, size: 'medium' },
  supply: { name: 'Supply Info', icon: Coins, size: 'small' },
  epoch: { name: 'Epoch Progress', icon: Clock, size: 'medium' },
  recent_blocks: { name: 'Recent Blocks', icon: LayoutGrid, size: 'large' },
  performance: { name: 'Performance History', icon: TrendingUp, size: 'large' },
};

// Default layouts
const DEFAULT_LAYOUTS = {
  default: {
    name: 'Default',
    widgets: ['network_stats', 'epoch', 'validators', 'tps_chart', 'supply']
  },
  minimal: {
    name: 'Minimal',
    widgets: ['network_stats', 'epoch']
  },
  full: {
    name: 'Full',
    widgets: ['network_stats', 'epoch', 'validators', 'tps_chart', 'supply', 'recent_blocks', 'performance']
  }
};

// Widget components
const NetworkStatsWidget = ({ data }) => (
  <div className="grid grid-cols-2 gap-3">
    <div className="bg-[#1a2436] rounded-lg p-3">
      <p className="text-gray-400 text-xs">Current Slot</p>
      <p className="text-white font-bold text-lg font-mono">{data?.slot?.toLocaleString() || '-'}</p>
    </div>
    <div className="bg-[#1a2436] rounded-lg p-3">
      <p className="text-gray-400 text-xs">Block Height</p>
      <p className="text-white font-bold text-lg font-mono">{data?.blockHeight?.toLocaleString() || '-'}</p>
    </div>
    <div className="bg-[#1a2436] rounded-lg p-3">
      <p className="text-gray-400 text-xs">TPS</p>
      <p className="text-cyan-400 font-bold text-lg">{data?.tps?.toLocaleString() || '-'}</p>
    </div>
    <div className="bg-[#1a2436] rounded-lg p-3">
      <p className="text-gray-400 text-xs">Total TXs</p>
      <p className="text-white font-bold text-lg">{data?.transactionCount ? (data.transactionCount / 1e9).toFixed(2) + 'B' : '-'}</p>
    </div>
  </div>
);

const EpochWidget = ({ data }) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <span className="text-gray-400 text-sm">Epoch {data?.epoch || '-'}</span>
      <span className="text-white font-bold">{data?.epochProgress || 0}%</span>
    </div>
    <div className="h-3 bg-[#1a2436] rounded-full overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500" 
        style={{ width: `${data?.epochProgress || 0}%` }} 
      />
    </div>
    <div className="flex justify-between mt-2 text-xs text-gray-500">
      <span>{data?.slotsRemaining?.toLocaleString() || '-'} slots remaining</span>
      <span>~{Math.round((data?.timeRemaining || 0) / 60)}m</span>
    </div>
  </div>
);

const ValidatorsWidget = ({ data }) => (
  <div className="grid grid-cols-3 gap-3">
    <div className="text-center">
      <p className="text-emerald-400 font-bold text-2xl">{data?.validators?.current || '-'}</p>
      <p className="text-gray-400 text-xs">Active</p>
    </div>
    <div className="text-center">
      <p className="text-red-400 font-bold text-2xl">{data?.validators?.delinquent || '-'}</p>
      <p className="text-gray-400 text-xs">Delinquent</p>
    </div>
    <div className="text-center">
      <p className="text-white font-bold text-2xl">{data?.validators?.totalStake ? (data.validators.totalStake / 1e6).toFixed(0) + 'M' : '-'}</p>
      <p className="text-gray-400 text-xs">Total Stake</p>
    </div>
  </div>
);

const SupplyWidget = ({ data }) => (
  <div className="space-y-2">
    <div className="flex justify-between">
      <span className="text-gray-400 text-sm">Circulating</span>
      <span className="text-cyan-400 font-mono">{data?.supply?.circulating ? (data.supply.circulating / 1e6).toFixed(0) + 'M' : '-'}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-gray-400 text-sm">Total</span>
      <span className="text-white font-mono">{data?.supply?.total ? (data.supply.total / 1e6).toFixed(0) + 'M' : '-'}</span>
    </div>
  </div>
);

const TpsChartWidget = ({ data }) => {
  const chartData = data?.tpsHistory || [];
  return (
    <div className="h-[180px]">
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="tpsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}
              formatter={(value) => [`${value.toLocaleString()} TPS`, '']}
            />
            <Area type="monotone" dataKey="tps" stroke="#06b6d4" fill="url(#tpsGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>
      )}
    </div>
  );
};

const RecentBlocksWidget = ({ blocks }) => (
  <div className="space-y-2 max-h-[200px] overflow-y-auto">
    {(blocks || []).slice(0, 5).map(block => (
      <div key={block.slot} className="flex items-center justify-between bg-[#1a2436] rounded-lg p-2">
        <Link to={createPageUrl('BlockDetail') + `?slot=${block.slot}`} className="text-cyan-400 font-mono text-sm hover:underline">
          #{block.slot?.toLocaleString()}
        </Link>
        <span className="text-gray-400 text-sm">{block.txCount} txs</span>
      </div>
    ))}
    {(!blocks || blocks.length === 0) && (
      <div className="text-gray-500 text-center py-4">Loading blocks...</div>
    )}
  </div>
);

const PerformanceWidget = ({ perfData }) => {
  const chartData = (perfData || []).slice(0, 30).reverse().map((s, i) => ({
    minute: i,
    tps: s.tps || 0,
    txns: s.transactions || 0
  }));
  
  return (
    <div className="h-[180px]">
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="minute" hide />
            <YAxis hide />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}
              formatter={(value, name) => [value.toLocaleString(), name === 'txns' ? 'Transactions' : 'TPS']}
            />
            <Bar dataKey="txns" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>
      )}
    </div>
  );
};

// Widget wrapper
const Widget = ({ type, data, blocks, perfData, onRemove, isEditing }) => {
  const widgetInfo = WIDGET_TYPES[type];
  if (!widgetInfo) return null;
  
  const Icon = widgetInfo.icon;
  
  return (
    <div className={`bg-[#0d1525] border border-white/10 rounded-xl p-4 ${widgetInfo.size === 'large' ? 'col-span-2' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isEditing && <GripVertical className="w-4 h-4 text-gray-600 cursor-move" />}
          <Icon className="w-4 h-4 text-cyan-400" />
          <span className="text-white font-medium text-sm">{widgetInfo.name}</span>
        </div>
        {isEditing && (
          <Button variant="ghost" size="icon" onClick={onRemove} className="h-6 w-6 text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {type === 'network_stats' && <NetworkStatsWidget data={data} />}
      {type === 'epoch' && <EpochWidget data={data} />}
      {type === 'validators' && <ValidatorsWidget data={data} />}
      {type === 'supply' && <SupplyWidget data={data} />}
      {type === 'tps_chart' && <TpsChartWidget data={data} />}
      {type === 'recent_blocks' && <RecentBlocksWidget blocks={blocks} />}
      {type === 'performance' && <PerformanceWidget perfData={perfData} />}
    </div>
  );
};

export default function CustomDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [perfData, setPerfData] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [widgets, setWidgets] = useState([]);
  const [savedLayouts, setSavedLayouts] = useState({});
  const [currentLayout, setCurrentLayout] = useState('default');
  const [newLayoutName, setNewLayoutName] = useState('');
  const [showAddWidget, setShowAddWidget] = useState(false);

  // Load saved layouts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('x1_dashboard_layouts');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSavedLayouts(parsed);
      // Load last used layout
      const lastLayout = localStorage.getItem('x1_dashboard_current');
      if (lastLayout && (parsed[lastLayout] || DEFAULT_LAYOUTS[lastLayout])) {
        setCurrentLayout(lastLayout);
        setWidgets((parsed[lastLayout] || DEFAULT_LAYOUTS[lastLayout]).widgets);
      } else {
        setWidgets(DEFAULT_LAYOUTS.default.widgets);
      }
    } else {
      setWidgets(DEFAULT_LAYOUTS.default.widgets);
    }
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [dashData, recentBlocks, perfHistory] = await Promise.all([
        X1Rpc.getDashboardData(),
        X1Rpc.getRecentBlocks(10),
        X1Rpc.getPerformanceHistory(60)
      ]);
      setData(dashData);
      setBlocks(recentBlocks);
      setPerfData(perfHistory);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Save layout
  const saveLayout = () => {
    const name = newLayoutName || `Layout ${Object.keys(savedLayouts).length + 1}`;
    const newLayouts = {
      ...savedLayouts,
      [name]: { name, widgets }
    };
    setSavedLayouts(newLayouts);
    setCurrentLayout(name);
    localStorage.setItem('x1_dashboard_layouts', JSON.stringify(newLayouts));
    localStorage.setItem('x1_dashboard_current', name);
    setNewLayoutName('');
  };

  // Load layout
  const loadLayout = (layoutKey) => {
    const layout = savedLayouts[layoutKey] || DEFAULT_LAYOUTS[layoutKey];
    if (layout) {
      setWidgets(layout.widgets);
      setCurrentLayout(layoutKey);
      localStorage.setItem('x1_dashboard_current', layoutKey);
    }
  };

  // Add widget
  const addWidget = (type) => {
    if (!widgets.includes(type)) {
      setWidgets([...widgets, type]);
    }
    setShowAddWidget(false);
  };

  // Remove widget
  const removeWidget = (type) => {
    setWidgets(widgets.filter(w => w !== type));
  };

  // Delete layout
  const deleteLayout = (layoutKey) => {
    const newLayouts = { ...savedLayouts };
    delete newLayouts[layoutKey];
    setSavedLayouts(newLayouts);
    localStorage.setItem('x1_dashboard_layouts', JSON.stringify(newLayouts));
    if (currentLayout === layoutKey) {
      setWidgets(DEFAULT_LAYOUTS.default.widgets);
      setCurrentLayout('default');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <header className="border-b border-white/10">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 hover:opacity-80">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
                <span className="font-bold text-xl"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
              </Link>
              <span className="text-gray-400">|</span>
              <span className="text-white text-xl font-light">Custom Dashboard</span>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0">{currentLayout}</Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsEditing(!isEditing)}
                className={`border-white/20 ${isEditing ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
              >
                <Settings className="w-4 h-4 mr-2" />
                {isEditing ? 'Done' : 'Edit'}
              </Button>
              <Button variant="outline" size="sm" onClick={fetchData} className="border-white/20 text-gray-400">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Layout Selector */}
        {isEditing && (
          <div className="bg-[#0d1525] border border-white/10 rounded-xl p-4 mb-6">
            <h3 className="text-white font-medium mb-3">Layouts</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.keys(DEFAULT_LAYOUTS).map(key => (
                <Button 
                  key={key} 
                  variant="outline" 
                  size="sm"
                  onClick={() => loadLayout(key)}
                  className={`border-white/20 ${currentLayout === key ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
                >
                  {DEFAULT_LAYOUTS[key].name}
                </Button>
              ))}
              {Object.keys(savedLayouts).map(key => (
                <div key={key} className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => loadLayout(key)}
                    className={`border-white/20 ${currentLayout === key ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
                  >
                    {savedLayouts[key].name}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteLayout(key)} className="h-7 w-7 text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input 
                placeholder="New layout name..." 
                value={newLayoutName}
                onChange={(e) => setNewLayoutName(e.target.value)}
                className="bg-[#1a2436] border-white/10 text-white w-48"
              />
              <Button onClick={saveLayout} className="bg-cyan-500 hover:bg-cyan-600">
                <Save className="w-4 h-4 mr-2" /> Save Layout
              </Button>
              <Button variant="outline" onClick={() => setShowAddWidget(!showAddWidget)} className="border-white/20 text-gray-400">
                <Plus className="w-4 h-4 mr-2" /> Add Widget
              </Button>
            </div>
            
            {/* Widget Picker */}
            {showAddWidget && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(WIDGET_TYPES).map(([key, info]) => {
                  const Icon = info.icon;
                  const isAdded = widgets.includes(key);
                  return (
                    <Button 
                      key={key}
                      variant="outline"
                      onClick={() => addWidget(key)}
                      disabled={isAdded}
                      className={`border-white/10 justify-start ${isAdded ? 'opacity-50' : 'text-gray-400 hover:text-white'}`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {info.name}
                      {isAdded && <span className="ml-auto text-xs">✓</span>}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Widgets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {widgets.map(type => (
            <Widget 
              key={type}
              type={type}
              data={data}
              blocks={blocks}
              perfData={perfData}
              onRemove={() => removeWidget(type)}
              isEditing={isEditing}
            />
          ))}
        </div>

        {widgets.length === 0 && (
          <div className="text-center py-20">
            <LayoutGrid className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No widgets added</p>
            <p className="text-gray-500 text-sm mt-2">Click Edit to add widgets to your dashboard</p>
          </div>
        )}
      </main>
    </div>
  );
}