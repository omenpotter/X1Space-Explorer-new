// Returns the URL only if it uses an http(s) scheme or is a relative path;
// otherwise returns '#' to prevent javascript: / data: URI XSS via href.
export function safeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  if (/^(https?:\/\/)/i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return '#'; // any other scheme (javascript:, data:, etc.)
  if (trimmed.startsWith('//') || trimmed.startsWith('/')) return trimmed; // protocol-relative / root-relative
  if (/^[a-z0-9_~!$&'()*+,;=:@.-]+(\/|$)/i.test(trimmed) && !trimmed.startsWith('#')) return trimmed; // relative path
  return '#';
}