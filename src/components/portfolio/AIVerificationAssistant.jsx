import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { invokeAi, signIn } from '@/lib/x1/ai';
import X1Api from '../x1/X1ApiClient';

function aiFailureMessage(error, fallback) {
  if (error?.code === 'sign_in_required') {
    signIn();
    return 'Sign in to use the AI assistant. Redirecting to sign-in…';
  }
  return error?.message && error.name === 'AiError' ? error.message : fallback;
}

export default function AIVerificationAssistant({ tokenMint, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your AI verification assistant. I can help you verify your token on X1Space. First, let me analyze this token...' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenAnalysis, setTokenAnalysis] = useState(null);
  const [verificationForm, setVerificationForm] = useState({
    name: '',
    symbol: '',
    description: '',
    website: '',
    twitter: '',
    logoUrl: '',
    documentation: ''
  });

  React.useEffect(() => {
    if (tokenMint) {
      analyzeToken();
    }
  }, [tokenMint]);

  const analyzeToken = async () => {
    setLoading(true);
    try {
      const tokenDetails = await X1Api.getTokenDetails(tokenMint);
      
      const { result: analysis } = await invokeAi('tokenVerificationAssistant', {
        action: 'analyze',
        tokenMint,
        tokenDetails: tokenDetails.data?.token
      });

      setTokenAnalysis(analysis);
      
      if (tokenDetails.data?.token) {
        setVerificationForm({
          name: tokenDetails.data.token.name || '',
          symbol: tokenDetails.data.token.symbol || '',
          description: tokenDetails.data.token.description || '',
          website: tokenDetails.data.token.website || '',
          twitter: tokenDetails.data.token.twitter || '',
          logoUrl: tokenDetails.data.token.logo_uri || '',
          documentation: ''
        });
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Analysis complete! Here's what I found:

**Readiness Score: ${analysis.readiness_score}/100**

${analysis.missing_requirements.length > 0 ? `**Missing Requirements:**\n${analysis.missing_requirements.map(r => `• ${r}`).join('\n')}` : '✅ All requirements met!'}

${analysis.red_flags.length > 0 ? `**⚠️ Potential Issues:**\n${analysis.red_flags.map(r => `• ${r}`).join('\n')}` : ''}

**Recommendations:**
${analysis.recommendations.map(r => `• ${r}`).join('\n')}

How can I help you prepare your verification request?`
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: aiFailureMessage(error, 'Sorry, I could not analyze the token. You can fill in the details manually.') }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.slice(0, 1500);
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const { result: { response } } = await invokeAi('tokenVerificationAssistant', {
        action: 'chat',
        tokenMint,
        verificationForm,
        tokenAnalysis,
        userMessage
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: aiFailureMessage(error, 'I could not respond just now. Please try again.') }]);
    } finally {
      setLoading(false);
    }
  };

  const generateVerificationRequest = async () => {
    setLoading(true);
    try {
      const { result: { response: request } } = await invokeAi('tokenVerificationAssistant', {
        action: 'generate',
        verificationForm,
        tokenAnalysis
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Here's your verification request:\n\n${request}\n\nYou can copy this and submit it for verification. Would you like me to make any adjustments?`
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: aiFailureMessage(error, 'I could not generate the request. Please try again.') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-1 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand" />
            <h3 className="text-ink font-bold">AI Verification Assistant</h3>
            <Badge className="bg-violet/15 text-violet border-0 text-xs">Powered by AI</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-ink-muted">Close</Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === 'user' 
                  ? 'bg-brand text-brand-ink' 
                  : 'bg-surface-2 text-ink'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface-2 rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin text-brand" />
              </div>
            </div>
          )}
        </div>

        {tokenAnalysis && (
          <div className="p-4 border-t border-line bg-surface-2">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <p className="text-ink-muted text-xs">Readiness</p>
                <p className={`text-2xl font-bold ${
                  tokenAnalysis.readiness_score >= 80 ? 'text-positive' :
                  tokenAnalysis.readiness_score >= 50 ? 'text-warning' : 'text-negative'
                }`}>
                  {tokenAnalysis.readiness_score}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-ink-muted text-xs">Missing</p>
                <p className="text-2xl font-bold text-warning">{tokenAnalysis.missing_requirements.length}</p>
              </div>
              <div className="text-center">
                <p className="text-ink-muted text-xs">Red Flags</p>
                <p className="text-2xl font-bold text-negative">{tokenAnalysis.red_flags.length}</p>
              </div>
            </div>
            <Button onClick={generateVerificationRequest} disabled={loading} className="w-full bg-brand text-brand-ink hover:bg-brand-strong">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Verification Request
            </Button>
          </div>
        )}

        <div className="p-4 border-t border-line">
          <div className="flex gap-2">
            <Input
              placeholder="Ask me anything about token verification..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              className="bg-surface-2 border-0 text-ink"
              disabled={loading}
            />
            <Button onClick={sendMessage} disabled={loading || !input.trim()} className="bg-brand hover:bg-brand-strong">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}