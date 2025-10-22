// src/lib/shortcode.ts
export function generateShortCode(): string {
  // 6-digit zero-padded; avoid leading zeros? If so, use 100000–999999
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, "0");
}
