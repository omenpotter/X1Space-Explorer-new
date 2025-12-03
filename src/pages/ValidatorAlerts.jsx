import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Bell, Plus, Trash2, Loader2, AlertTriangle,
  TrendingDown, TrendingUp, Mail, Globe,
  Percent, Activity, Play, Pause, Send, ChevronLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import X1Rpc from '../components/x1/X1RpcService';

export default function ValidatorAlerts() {
  const [validators, setValidators] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  const [testingNotification, setTestingNotification] = useState(false);
  const monitoringRef = useRef(null);
  const previousDataRef = useRef({});

  useEffect(() => {
    const saved = localStorage.getItem('x1_alerts');
    const savedConfig = localStorage.getItem('x1_alert_config');
    const savedTriggered = localStorage.getItem('x1_triggered_alerts');
    
    if (saved) setAlerts(JSON.parse(saved));
    if (savedTriggered) setTriggeredAlerts(JSON.parse(savedTriggered));
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setWebhookUrl(config.webhookUrl || '');
      setEmailAddress(config.emailAddress || '');
    }

    const fetchValidators = async () => {
      try {
        const data = await X1Rpc.getValidatorDetails();
        setValidators(data);
        // Store initial data for comparison
        data.forEach(v => {
          previousDataRef.current[v.votePubkey] = {
            uptime: v.uptime,
            commission: v.commission,
            stake: v.activatedStake,
            delinquent: v.delinquent
          };
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchValidators();

    return () => {
      if (monitoringRef.current) clearInterval(monitoringRef.current);
    };
  }, []);

  // Check alerts against current validator data
  const checkAlerts = async () => {
    try {
      const data = await X1Rpc.getValidatorDetails();
      setValidators(data);
      setLastCheck(new Date());

      const newTriggered = [];

      for (const alert of alerts) {
        if (!alert.enabled) continue;

        const validator = data.find(v => v.votePubkey === alert.votePubkey);
        if (!validator) continue;

        const prev = previousDataRef.current[alert.votePubkey] || {};
        let triggered = false;
        let message = '';

        switch (alert.type) {
          case 'uptime':
            if (validator.uptime < alert.threshold) {
              triggered = true;
              message = `Uptime dropped to ${validator.uptime?.toFixed(1)}% (threshold: ${alert.threshold}%)`;
            }
            break;
          case 'commission':
            if (validator.commission > alert.threshold) {
              triggered = true;
              message = `Commission increased to ${validator.commission}% (threshold: ${alert.threshold}%)`;
            }
            break;
          case 'delinquent':
            if (validator.delinquent && !prev.delinquent) {
              triggered = true;
              message = 'Validator became delinquent';
            }
            break;
          case 'stake_increase':
            const stakeIncrease = validator.activatedStake - (prev.stake || validator.activatedStake);
            if (stakeIncrease >= alert.threshold * 1000) {
              triggered = true;
              message = `Stake increased by ${(stakeIncrease / 1000).toFixed(2)}K XNT`;
            }
            break;
          case 'stake_decrease':
            const stakeDecrease = (prev.stake || validator.activatedStake) - validator.activatedStake;
            if (stakeDecrease >= alert.threshold * 1000) {
              triggered = true;
              message = `Stake decreased by ${(stakeDecrease / 1000).toFixed(2)}K XNT`;
            }
            break;
        }

        if (triggered) {
          const alertEvent = {
            id: Date.now(),
            alertId: alert.id,
            validatorName: alert.name || alert.votePubkey.substring(0, 12),
            type: alert.type,
            message,
            timestamp: new Date().toISOString()
          };
          newTriggered.push(alertEvent);
          await sendNotification(alertEvent);
        }

        // Update previous data
        previousDataRef.current[alert.votePubkey] = {
          uptime: validator.uptime,
          commission: validator.commission,
          stake: validator.activatedStake,
          delinquent: validator.delinquent
        };
      }

      if (newTriggered.length > 0) {
        const allTriggered = [...newTriggered, ...triggeredAlerts].slice(0, 50);
        setTriggeredAlerts(allTriggered);
        localStorage.setItem('x1_triggered_alerts', JSON.stringify(allTriggered));
      }
    } catch (err) {
      console.error('Alert check failed:', err);
    }
  };

  // Send notification via email or webhook
  const sendNotification = async (alertEvent) => {
    const config = JSON.parse(localStorage.getItem('x1_alert_config') || '{}');
    
    // Send email notification
    if (config.emailAddress) {
      try {
        await base44.integrations.Core.SendEmail({
          to: config.emailAddress,
          subject: `X1 Alert: ${alertEvent.validatorName}`,
          body: `
Alert Type: ${alertEvent.type}
Validator: ${alertEvent.validatorName}
Message: ${alertEvent.message}
Time: ${new Date(alertEvent.timestamp).toLocaleString()}

View details at X1.space
          `
        });
      } catch (err) {
        console.error('Email notification failed:', err);
      }
    }

    // Send webhook notification
    if (config.webhookUrl) {
      try {
        await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'x1_validator_alert',
            ...alertEvent
          })
        });
      } catch (err) {
        console.error('Webhook notification failed:', err);
      }
    }
  };

  // Toggle monitoring
  const toggleMonitoring = () => {
    if (isMonitoring) {
      if (monitoringRef.current) clearInterval(monitoringRef.current);
      setIsMonitoring(false);
    } else {
      checkAlerts(); // Initial check
      monitoringRef.current = setInterval(checkAlerts, 30000); // Check every 30s
      setIsMonitoring(true);
    }
  };

  // Test notification - Webhook only
  const testNotification = async () => {
    setTestingNotification(true);
    const config = JSON.parse(localStorage.getItem('x1_alert_config') || '{}');
    
    if (!config.webhookUrl) {
      alert('Please configure a webhook URL first (Discord, Slack, etc.)');
      setTestingNotification(false);
      return;
    }
    
    try {
      // Send webhook notification
      // Discord webhook format
      const isDiscord = config.webhookUrl.includes('discord.com');
      const isSlack = config.webhookUrl.includes('slack.com');
      
      let payload;
      if (isDiscord) {
        payload = {
          content: '🔔 **X1Space Alert Test**',
          embeds: [{
            title: 'Test Notification',
            description: 'Your webhook is configured correctly! You will receive validator alerts here.',
            color: 0x06b6d4, // cyan
            fields: [
              { name: 'Status', value: '✅ Working', inline: true },
              { name: 'Source', value: 'X1Space Validator Alerts', inline: true }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'X1Space - X1 Blockchain Explorer' }
          }]
        };
      } else if (isSlack) {
        payload = {
          text: '🔔 X1Space Alert Test',
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: '🔔 X1Space Alert Test' } },
            { type: 'section', text: { type: 'mrkdwn', text: 'Your webhook is configured correctly! You will receive validator alerts here.' } }
          ]
        };
      } else {
        // Generic webhook
        payload = {
          type: 'x1_validator_alert',
          content: '🔔 X1Space Test Notification - Your webhook is configured correctly!',
          validatorName: 'Test',
          message: 'This is a test notification',
          timestamp: new Date().toISOString()
        };
      }
      
      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'no-cors',
        body: JSON.stringify(payload)
      });
      
      alert('Webhook notification sent! Check your Discord/Slack/webhook destination.');
    } catch (err) {
      console.error('Webhook failed:', err);
      alert('Failed to send webhook: ' + err.message);
    } finally {
      setTestingNotification(false);
    }
  };

  const saveConfig = () => {
    localStorage.setItem('x1_alert_config', JSON.stringify({ webhookUrl, emailAddress }));
  };

  const addAlert = (validator, type) => {
    const defaultThresholds = {
      uptime: 99,
      commission: 10,
      delinquent: 0,
      stake_increase: 100,
      stake_decrease: 100
    };
    
    const newAlert = {
      id: Date.now(),
      votePubkey: validator.votePubkey,
      name: validator.name,
      icon: validator.icon,
      type,
      threshold: defaultThresholds[type] || 0,
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
      case 'uptime': return { label: 'Uptime drops below', suffix: '%', icon: Activity, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
      case 'commission': return { label: 'Commission exceeds', suffix: '%', icon: Percent, color: 'text-red-400', bgColor: 'bg-red-500/20' };
      case 'delinquent': return { label: 'Becomes delinquent', suffix: '', icon: AlertTriangle, color: 'text-red-400', bgColor: 'bg-red-500/20' };
      case 'stake_increase': return { label: 'Stake increases by', suffix: 'K XNT', icon: TrendingUp, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' };
      case 'stake_decrease': return { label: 'Stake decreases by', suffix: 'K XNT', icon: TrendingDown, color: 'text-orange-400', bgColor: 'bg-orange-500/20' };
      default: return { label: type, suffix: '', icon: Bell, color: 'text-gray-400', bgColor: 'bg-gray-500/20' };
    }
  };

  const filteredValidators = validators.filter(v => {
    const query = searchQuery.toLowerCase();
    return v.votePubkey.toLowerCase().includes(query) || 
           v.nodePubkey.toLowerCase().includes(query) ||
           (v.name && v.name.toLowerCase().includes(query));
  }).slice(0, 50);

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
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 hover:opacity-80">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
                <span className="font-bold"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
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
          <div className="flex items-center gap-2">
            <Button 
              onClick={toggleMonitoring} 
              variant="outline" 
              className={`border-white/10 ${isMonitoring ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-400'}`}
            >
              {isMonitoring ? <><Pause className="w-4 h-4 mr-2" /> Monitoring</> : <><Play className="w-4 h-4 mr-2" /> Start</>}
            </Button>
            <Button onClick={() => setShowAdd(!showAdd)} className="bg-cyan-500 hover:bg-cyan-600">
              <Plus className="w-4 h-4 mr-2" /> New Alert
            </Button>
          </div>
        </div>

        {/* Monitoring Status */}
        {isMonitoring && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-sm">Real-time monitoring active</span>
            </div>
            {lastCheck && <span className="text-gray-500 text-xs">Last check: {lastCheck.toLocaleTimeString()}</span>}
          </div>
        )}

        {/* Notification Config */}
        <div className="bg-[#24384a] rounded-xl p-4 mb-6">
          <h3 className="text-gray-400 text-sm mb-4">NOTIFICATION SETTINGS</h3>
          
          {/* Email limitation notice */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
            <p className="text-yellow-400 text-sm">
              ⚠️ <strong>Email Limitation:</strong> Email notifications currently only work for registered app users. 
              For external notifications, please use a <strong>Webhook</strong> (Discord, Slack, Telegram bot, etc.)
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Webhook URL (Recommended)</label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://discord.com/api/webhooks/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="bg-[#1d2d3a] border-0 text-white flex-1"
                />
                <Button variant="ghost" size="icon" className="text-gray-400"><Globe className="w-4 h-4" /></Button>
              </div>
              <p className="text-gray-600 text-xs mt-1">Works with Discord, Slack, Telegram bots, etc.</p>
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Email (App Users Only)</label>
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
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button onClick={saveConfig} variant="outline" size="sm" className="border-white/10 text-gray-400">
              Save Settings
            </Button>
            <Button 
              onClick={testNotification} 
              variant="outline" 
              size="sm" 
              className="border-cyan-500/30 text-cyan-400"
              disabled={testingNotification || !webhookUrl}
            >
              {testingNotification ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Test Webhook
            </Button>
          </div>
        </div>

        {/* Add Alert Panel */}
        {showAdd && (
          <div className="bg-[#24384a] rounded-xl p-4 mb-6">
            <h3 className="text-white font-medium mb-3">Create New Alert</h3>
            <Input
              placeholder="Search validators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#1d2d3a] border-0 text-white mb-4"
            />
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredValidators.map((v) => (
                <div key={v.votePubkey} className="p-3 bg-[#1d2d3a] rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg">{v.icon || '🔷'}</span>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{v.name || v.votePubkey.substring(0, 16) + '...'}</p>
                      <p className="text-gray-500 text-xs">{(v.activatedStake / 1000000).toFixed(1)}M XNT • {v.uptime?.toFixed(1)}% uptime</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" className="border-yellow-500/30 text-yellow-400 text-xs h-7" onClick={() => addAlert(v, 'uptime')}>
                      <Activity className="w-3 h-3 mr-1" /> Uptime &lt; 99%
                    </Button>
                    <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 text-xs h-7" onClick={() => addAlert(v, 'commission')}>
                      <Percent className="w-3 h-3 mr-1" /> Commission &gt; 10%
                    </Button>
                    <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 text-xs h-7" onClick={() => addAlert(v, 'delinquent')}>
                      <AlertTriangle className="w-3 h-3 mr-1" /> Delinquent
                    </Button>
                    <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs h-7" onClick={() => addAlert(v, 'stake_increase')}>
                      <TrendingUp className="w-3 h-3 mr-1" /> +100K Stake
                    </Button>
                    <Button size="sm" variant="outline" className="border-orange-500/30 text-orange-400 text-xs h-7" onClick={() => addAlert(v, 'stake_decrease')}>
                      <TrendingDown className="w-3 h-3 mr-1" /> -100K Stake
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Triggered Alerts History */}
        {triggeredAlerts.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
            <h3 className="text-red-400 text-sm mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Recent Alert Events
            </h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {triggeredAlerts.slice(0, 10).map((event) => (
                <div key={event.id} className="flex items-center gap-3 text-sm bg-[#1d2d3a] rounded-lg p-2">
                  <span className="text-red-400 text-xs">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  <span className="text-white">{event.validatorName}</span>
                  <span className="text-gray-400">{event.message}</span>
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
            <p className="text-gray-500 text-sm mt-2">Create alerts to monitor validator performance in real-time</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-gray-400 text-sm">ACTIVE ALERTS ({alerts.length})</h3>
            {alerts.map((alert) => {
              const typeInfo = getAlertTypeInfo(alert.type);
              const IconComponent = typeInfo.icon;
              return (
                <div key={alert.id} className={`bg-[#24384a] rounded-xl p-4 ${!alert.enabled ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-4">
                    <span className="text-xl">{alert.icon || '🔷'}</span>
                    <div className="flex-1">
                      <p className="text-white font-medium">{alert.name || alert.votePubkey.substring(0, 12) + '...'}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={`${typeInfo.bgColor} ${typeInfo.color} border-0 text-xs flex items-center gap-1`}>
                          <IconComponent className="w-3 h-3" />
                          {alert.type.replace('_', ' ')}
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