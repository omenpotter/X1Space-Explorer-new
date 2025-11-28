import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Zap, Bell, Plus, Trash2, Loader2, AlertTriangle,
  TrendingDown, CheckCircle, Mail, Globe
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

export default function ValidatorAlerts() {
  const [validators, setValidators] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [emailAddress, setEmailAddress] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('x1_alerts');
    const savedConfig = localStorage.getItem('x1_alert_config');
    if (saved) setAlerts(JSON.parse(saved));
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setWebhookUrl(config.webhookUrl || '');
      setEmailAddress(config.emailAddress || '');
    }

    const fetchValidators = async () => {
      try {
        const data = await X1Rpc.getValidatorDetails();
        setValidators(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchValidators();
  }, []);

  const saveConfig = () => {
    localStorage.setItem('x1_alert_config', JSON.stringify({ webhookUrl, emailAddress }));
  };

  const addAlert = (validator, type) => {
    const newAlert = {
      id: Date.now(),
      votePubkey: validator.votePubkey,
      name: validator.name,
      icon: validator.icon,
      type,
      threshold: type === 'uptime' ? 99 : type === 'commission' ? 10 : 1000,
      enabled: true,
      createdAt: new Date().toISOString()
    };
    const newAlerts = [...alerts, newAlert];
    setAlerts(newAlerts);
    localStorage.setItem('x1_alerts', JSON.stringify(newAlerts));
  };

  const removeAlert = (id) => {
    const newAlerts = alerts.filter(a => a.id !== id);
    setAlerts(newAlerts);
    localStorage.setItem('x1_alerts', JSON.stringify(newAlerts));
  };

  const toggleAlert = (id) => {
    const newAlerts = alerts.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
    setAlerts(newAlerts);
    localStorage.setItem('x1_alerts', JSON.stringify(newAlerts));
  };

  const updateThreshold = (id, threshold) => {
    const newAlerts = alerts.map(a => a.id === id ? { ...a, threshold: Number(threshold) } : a);
    setAlerts(newAlerts);
    localStorage.setItem('x1_alerts', JSON.stringify(newAlerts));
  };

  const getAlertTypeInfo = (type) => {
    switch (type) {
      case 'uptime': return { label: 'Uptime drops below', suffix: '%', color: 'yellow' };
      case 'commission': return { label: 'Commission exceeds', suffix: '%', color: 'red' };
      case 'delinquent': return { label: 'Becomes delinquent', suffix: '', color: 'red' };
      case 'stake': return { label: 'Stake changes by', suffix: ' XNT', color: 'cyan' };
      default: return { label: type, suffix: '', color: 'gray' };
    }
  };

  const filteredValidators = validators.filter(v => {
    const query = searchQuery.toLowerCase();
    return v.votePubkey.toLowerCase().includes(query) || 
           (v.name && v.name.toLowerCase().includes(query));
  }).slice(0, 20);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-black font-black text-sm">X1</span>
                </div>
                <span className="text-white font-bold hidden sm:inline">X1</span>
                <span className="text-cyan-400 font-bold hidden sm:inline">.space</span>
              </Link>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Mainnet</Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Bell className="w-7 h-7 text-yellow-400" />
            Validator Alerts
          </h1>
          <Button onClick={() => setShowAdd(!showAdd)} className="bg-cyan-500 hover:bg-cyan-600">
            <Plus className="w-4 h-4 mr-2" /> New Alert
          </Button>
        </div>

        {/* Notification Config */}
        <div className="bg-[#24384a] rounded-xl p-4 mb-6">
          <h3 className="text-gray-400 text-sm mb-4">NOTIFICATION SETTINGS</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Email Address</label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="bg-[#1d2d3a] border-0 text-white flex-1"
                />
                <Button variant="ghost" size="icon" className="text-gray-400"><Mail className="w-4 h-4" /></Button>
              </div>
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Webhook URL</label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://your-webhook.com/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="bg-[#1d2d3a] border-0 text-white flex-1"
                />
                <Button variant="ghost" size="icon" className="text-gray-400"><Globe className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
          <Button onClick={saveConfig} variant="outline" size="sm" className="mt-4 border-white/10 text-gray-400">
            Save Settings
          </Button>
        </div>

        {/* Add Alert Panel */}
        {showAdd && (
          <div className="bg-[#24384a] rounded-xl p-4 mb-6">
            <Input
              placeholder="Search validators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#1d2d3a] border-0 text-white mb-4"
            />
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {filteredValidators.map((v) => (
                <div key={v.votePubkey} className="flex items-center gap-3 p-3 bg-[#1d2d3a] rounded-lg">
                  <span>{v.icon || '🔷'}</span>
                  <div className="flex-1">
                    <p className="text-white text-sm">{v.name || v.votePubkey.substring(0, 12) + '...'}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="border-yellow-500/30 text-yellow-400 text-xs" onClick={() => addAlert(v, 'uptime')}>
                      <TrendingDown className="w-3 h-3 mr-1" /> Uptime
                    </Button>
                    <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 text-xs" onClick={() => addAlert(v, 'delinquent')}>
                      <AlertTriangle className="w-3 h-3 mr-1" /> Delinquent
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Alerts */}
        {alerts.length === 0 ? (
          <div className="bg-[#24384a] rounded-xl p-8 text-center">
            <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No alerts configured</p>
            <p className="text-gray-500 text-sm mt-2">Create alerts to monitor validator performance</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const typeInfo = getAlertTypeInfo(alert.type);
              return (
                <div key={alert.id} className="bg-[#24384a] rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    <span className="text-xl">{alert.icon || '🔷'}</span>
                    <div className="flex-1">
                      <p className="text-white font-medium">{alert.name || alert.votePubkey.substring(0, 12) + '...'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`bg-${typeInfo.color}-500/20 text-${typeInfo.color}-400 border-0 text-xs`}>
                          {alert.type}
                        </Badge>
                        <span className="text-gray-500 text-sm">{typeInfo.label}</span>
                        {alert.type !== 'delinquent' && (
                          <Input
                            type="number"
                            value={alert.threshold}
                            onChange={(e) => updateThreshold(alert.id, e.target.value)}
                            className="bg-[#1d2d3a] border-0 text-white w-20 h-6 text-sm"
                          />
                        )}
                        <span className="text-gray-500 text-sm">{typeInfo.suffix}</span>
                      </div>
                    </div>
                    <Switch checked={alert.enabled} onCheckedChange={() => toggleAlert(alert.id)} />
                    <Button variant="ghost" size="icon" onClick={() => removeAlert(alert.id)} className="text-gray-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}