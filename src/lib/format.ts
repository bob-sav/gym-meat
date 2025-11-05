// src/lib/format.ts

export const formatHuf = (amount: number) =>
  new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);

export function formatDateBudapest(
  d: string | Date | null | undefined
): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("hu-HU", { timeZone: "Europe/Budapest" });
}

export function formatDateBudapestISO(
  d: string | Date | null | undefined,
  opts: { dateSep?: "-" | "/"; includeTime?: boolean } = {}
): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";

  const { dateSep = "/", includeTime = true } = opts;

  // Build parts in the Budapest time zone
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : {}),
  })
    .formatToParts(dt)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});

  const yyyy = parts.year ?? "";
  const mm = parts.month ?? "";
  const dd = parts.day ?? "";
  const hh = parts.hour ?? "";
  const mi = parts.minute ?? "";

  const dateStr = [yyyy, mm, dd].join(dateSep);
  if (!includeTime) return dateStr;
  return `${dateStr} ${hh}:${mi}`;
}
