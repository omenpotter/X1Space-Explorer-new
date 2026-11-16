// Calls to the sign-in-protected AI functions. Maps the backend's refusals to plain messages.
import { base44 } from '@/api/base44Client';

export class AiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AiError';
    this.code = code; // 'sign_in_required' | 'daily_quota' | 'rate_limited' | 'too_large' | 'unavailable' | 'failed'
  }
}

/** Invoke an AI function. Resolves to the response body or throws AiError with a user-safe message. */
export async function invokeAi(name, payload) {
  try {
    const res = await base44.functions.invoke(name, payload);
    return res.data;
  } catch (err) {
    const status = err?.status ?? err?.response?.status;
    const body = err?.data ?? err?.response?.data;
    const code = body?.error?.code;
    if (status === 401 || code === 'sign_in_required') throw new AiError('Sign in to use AI features.', 'sign_in_required');
    if (status === 429) throw new AiError(body?.error?.message || 'AI usage limit reached. Try again later.', code === 'daily_quota' ? 'daily_quota' : 'rate_limited');
    if (status === 413) throw new AiError('That input is too long.', 'too_large');
    if (status === 503) throw new AiError('AI features are not available right now.', 'unavailable');
    throw new AiError('The AI request failed. Please try again.', 'failed');
  }
}

export function signIn() {
  try {
    base44.auth.redirectToLogin(window.location.href);
  } catch {
    // Login redirect unavailable in this environment.
  }
}
