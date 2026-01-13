import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, AlertCircle, CheckCircle, Copy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import X1Api from '../x1/X1ApiClient';

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
      
      const prompt = `Analyze this X1 blockchain token and provide a verification readiness assessment:

Token Details:
- Mint: ${tokenMint}
- Name: ${tokenDetails.data?.token?.name || 'Unknown'}
- Symbol: ${tokenDetails.data?.token?.symbol || 'Unknown'}
- Total Supply: ${tokenDetails.data?.token?.total_supply || 0}
- Holders: ${tokenDetails.data?.token?.holder_count || 0}
- Has Metadata: ${tokenDetails.data?.token?.metadata ? 'Yes' : 'No'}

Provide:
1. Verification readiness score (0-100)
2. Missing requirements for verification
3. Potential red flags or concerns
4. Recommendations for improving chances of verification

Format as JSON with keys: readiness_score, missing_requirements (array), red_flags (array), recommendations (array)`;

      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            readiness_score: { type: 'number' },
            missing_requirements: { type: 'array', items: { type: 'string' } },
            red_flags: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
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
      console.error('Analysis failed:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error analyzing the token. Please try again or provide the token details manually.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const context = `You are an AI assistant helping with X1Space token verification. 
Current token: ${tokenMint}
Verification form data: ${JSON.stringify(verificationForm)}
Previous analysis: ${JSON.stringify(tokenAnalysis)}

User query: ${userMessage}

Provide helpful, specific guidance on token verification. If they ask about documentation, explain what's needed (whitepaper, tokenomics, smart contract verification). If they need help formatting, provide templates. If they mention concerns, address them with factual information.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: context,
        add_context_from_internet: false
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error('AI response failed:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I apologize, I\'m having trouble responding right now. Please try rephrasing your question.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const generateVerificationRequest = async () => {
    setLoading(true);
    try {
      const prompt = `Generate a professional X1Space token verification request based on this information:

${JSON.stringify(verificationForm, null, 2)}

Analysis: ${JSON.stringify(tokenAnalysis)}

Create a well-formatted verification request that includes:
1. Token overview
2. Project description
3. Team information (if available)
4. Tokenomics summary
5. Use case and utility
6. Community and social proof
7. Technical details
8. Roadmap (if applicable)

Make it professional, concise, and compelling. Format with markdown.`;

      const request = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Here's your verification request:\n\n${request}\n\nYou can copy this and submit it for verification. Would you like me to make any adjustments?`
      }]);
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1d2d3a] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h3 className="text-white font-bold">AI Verification Assistant</h3>
            <Badge className="bg-purple-500/20 text-purple-400 border-0 text-xs">Powered by AI</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400">Close</Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === 'user' 
                  ? 'bg-cyan-500 text-white' 
                  : 'bg-[#24384a] text-gray-100'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#24384a] rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              </div>
            </div>
          )}
        </div>

        {tokenAnalysis && (
          <div className="p-4 border-t border-white/10 bg-[#24384a]">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <p className="text-gray-400 text-xs">Readiness</p>
                <p className={`text-2xl font-bold ${
                  tokenAnalysis.readiness_score >= 80 ? 'text-emerald-400' :
                  tokenAnalysis.readiness_score >= 50 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {tokenAnalysis.readiness_score}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-xs">Missing</p>
                <p className="text-2xl font-bold text-yellow-400">{tokenAnalysis.missing_requirements.length}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-xs">Red Flags</p>
                <p className="text-2xl font-bold text-red-400">{tokenAnalysis.red_flags.length}</p>
              </div>
            </div>
            <Button onClick={generateVerificationRequest} disabled={loading} className="w-full bg-purple-500 hover:bg-purple-600">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Verification Request
            </Button>
          </div>
        )}

        <div className="p-4 border-t border-white/10">
          <div className="flex gap-2">
            <Input
              placeholder="Ask me anything about token verification..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              className="bg-[#24384a] border-0 text-white"
              disabled={loading}
            />
            <Button onClick={sendMessage} disabled={loading || !input.trim()} className="bg-cyan-500 hover:bg-cyan-600">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}