import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, Loader2 } from 'lucide-react';
import { invokeAi, signIn } from "@/lib/x1/ai";
import { classifyQuery } from "@/lib/x1/search";
import { toast } from "sonner";

/** @param {{ onResult?: any, [key: string]: any }} props */
export default function SmartSearchBar({ onResult }) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        const q = query.trim().slice(0, 300);
        if (!q) return;

        setLoading(true);
        try {
            const data = await invokeAi('smartSearch', { query: q });
            const interp = data.interpretation;
            if (interp.action === 'clarify') {
                toast.info(interp.question);
            } else {
                // Model output is untrusted: it only reaches the page through validated values.
                const p = interp.parameters || {};
                const safe = { ...interp, parameters: {} };
                for (const key of ['mint', 'vote_account', 'identity_pubkey']) {
                    if (typeof p[key] === 'string' && classifyQuery(p[key]).some((o) => o.type === 'address')) safe.parameters[key] = p[key];
                }
                for (const key of ['name', 'symbol', 'metric']) if (typeof p[key] === 'string') safe.parameters[key] = p[key].slice(0, 64);
                if (Number.isFinite(p.hours)) safe.parameters.hours = Math.min(168, Math.max(1, Math.round(p.hours)));
                onResult(safe);
            }
        } catch (error) {
            if (error.code === 'sign_in_required') {
                toast.error('Sign in to use AI search', { action: { label: 'Sign in', onClick: signIn } });
            } else {
                toast.error(error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative">
            <div className="flex items-center gap-2 bg-gradient-to-r from-purple-500/10 to-brand/10 p-1 rounded-lg border border-purple-500/20">
                <Sparkles className="w-4 h-4 text-purple-400 ml-2" />
                <Input
                    placeholder="Ask anything: 'show me Bitcoin token' or 'current network TPS'"
                    className="flex-1 bg-transparent border-0 text-white placeholder:text-ink-muted"
                    value={query}
                    maxLength={300}
                    aria-label="Ask a question about X1"
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