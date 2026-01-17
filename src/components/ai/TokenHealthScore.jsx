import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import { base44 } from "@/api/base44Client";

export default function TokenHealthScore({ mint, tokenName }) {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const analyzeToken = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await base44.functions.invoke('analyzeToken', { mint });
            setAnalysis(data.analysis);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (level) => {
        const colors = {
            'Low': 'text-emerald-400 bg-emerald-500/20',
            'Medium': 'text-yellow-400 bg-yellow-500/20',
            'High': 'text-red-400 bg-red-500/20'
        };
        return colors[level] || colors.Medium;
    };

    const getHealthColor = (score) => {
        if (score >= 8) return 'text-emerald-400';
        if (score >= 5) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <Card className="bg-[#24384a] border-purple-500/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span className="text-white">AI Health Analysis</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {!analysis && !loading && (
                    <Button onClick={analyzeToken} className="w-full bg-purple-600 hover:bg-purple-700">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Analyze Token Health
                    </Button>
                )}

                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                        <span className="ml-2 text-gray-400">Analyzing...</span>
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
                        {error}
                    </div>
                )}

                {analysis && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#1d2d3a] rounded-lg p-4">
                                <p className="text-gray-400 text-sm mb-2">Health Score</p>
                                <p className={`text-3xl font-bold ${getHealthColor(analysis.health_score)}`}>
                                    {analysis.health_score}/10
                                </p>
                            </div>
                            <div className="bg-[#1d2d3a] rounded-lg p-4">
                                <p className="text-gray-400 text-sm mb-2">Risk Level</p>
                                <Badge className={getRiskColor(analysis.risk_level)}>
                                    {analysis.risk_level}
                                </Badge>
                            </div>
                        </div>

                        <div className="bg-[#1d2d3a] rounded-lg p-4">
                            <p className="text-white font-medium mb-3">Key Factors:</p>
                            <ul className="space-y-2">
                                {analysis.summary.map((factor, i) => (
                                    <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                                        <CheckCircle className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                                        <span>{factor}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}