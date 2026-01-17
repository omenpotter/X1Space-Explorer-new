import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, Loader2 } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function SmartSearchBar({ onResult }) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setLoading(true);
        try {
            const { data } = await base44.functions.invoke('smartSearch', { query });
            
            if (data.interpretation.action === 'clarify') {
                toast.info(data.interpretation.question);
            } else {
                onResult(data.interpretation);
            }
        } catch (error) {
            toast.error('Search failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative">
            <div className="flex items-center gap-2 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 p-1 rounded-lg border border-purple-500/20">
                <Sparkles className="w-4 h-4 text-purple-400 ml-2" />
                <Input
                    placeholder="Ask anything: 'show me Bitcoin token' or 'current network TPS'"
                    className="flex-1 bg-transparent border-0 text-white placeholder:text-gray-400"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    disabled={loading}
                />
                <Button 
                    size="sm" 
                    onClick={handleSearch}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
            </div>
        </div>
    );
}