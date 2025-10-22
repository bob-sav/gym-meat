// src/lib/shortcode.ts
export function generateShortCode(len = 6): string {
  // digits only, avoid leading zeros bias
  let s = "";
  while (s.length < len) {
    const n = Math.floor(Math.random() * 10);
    if (s.length === 0 && n === 0) continue;
    s += String(n);
  }
  return s;
}
