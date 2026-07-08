// Stable-ish unique id helper. crypto.randomUUID is available in modern
// browsers and Node 20; the fallback keeps SSR/older engines safe.
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
