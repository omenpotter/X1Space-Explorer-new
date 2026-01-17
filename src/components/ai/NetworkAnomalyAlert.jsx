import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';
import { base44 } from "@/api/base44Client";

export default function NetworkAnomalyAlert() {
    const [anomaly, setAnomaly] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAnomalies();
        const interval = setInterval(checkAnomalies, 5 * 60 * 1000); // Every 5 minutes
        return () => clearInterval(interval);
    }, []);

    const checkAnomalies = async () => {
        try {
            const { data } = await base44.functions.invoke('detectAnomalies', {});
            if (data.action === 'alert') {
                setAnomaly(data);
            } else {
                setAnomaly(null);
            }
        } catch (error) {
            console.error('Anomaly detection failed:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return null;
    if (!anomaly) return null;

    const severityColors = {
        'Low': 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
        'Medium': 'bg-orange-500/10 border-orange-500/30 text-orange-400',
        'High': 'bg-red-500/10 border-red-500/30 text-red-400'
    };

    const colorClass = severityColors[anomaly.severity] || severityColors.Medium;

    return (
        <div className={`border rounded-lg p-4 ${colorClass} mb-6`}>
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                    <h3 className="font-bold mb-1">Network Anomaly Detected</h3>
                    <p className="text-sm opacity-90">
                        {anomaly.metric} {anomaly.deviation} - {anomaly.cause}
                    </p>
                    <p className="text-xs opacity-70 mt-1">Severity: {anomaly.severity}</p>
                </div>
            </div>
        </div>
    );
}