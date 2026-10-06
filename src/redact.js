// Anything that looks like a key or token is hidden before it reaches the page
// or a model. This is a safety net, not a promise: read the output before sharing.
const PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9_]{16,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi,
];

export function redact(text) {
  let out = text;
  for (const re of PATTERNS) out = out.replace(re, (m) => (/^(password|passwd|secret|token|api)/i.test(m) ? m.split(/[:=]/)[0] + '=[hidden]' : '[hidden]'));
  return out;
}
