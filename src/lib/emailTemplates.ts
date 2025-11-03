// src/lib/emailTemplates.ts
export function formatCents(cents: number) {
  return (cents / 100).toFixed(2) + " €";
}

export function formatVienna(dt: Date | null | undefined) {
  if (!dt) return null;
  return dt.toLocaleString("de-AT", { timeZone: "Europe/Vienna" });
}

// --- Order Confirmation (after checkout) ---
export function orderConfirmationHtml(args: {
  shortCode: string;
  pickupGymName: string | null;
  pickupWhen: Date | null;
  lines: Array<{ qty: number; name: string; unit: string | null }>;
  totalCents: number;
}) {
  const when = formatVienna(args.pickupWhen);
  const linesHtml = args.lines
    .map(
      (l) =>
        `<li>${l.qty}× ${escapeHtml(l.name)}${
          l.unit ? ` · ${escapeHtml(l.unit)}` : ""
        }</li>`
    )
    .join("");

  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111; line-height:1.5">
    <h2 style="margin:0 0 12px">Thanks for your order!</h2>
    <p style="margin:0 0 12px">Your order code: <strong>#${escapeHtml(
      args.shortCode
    )}</strong></p>
    <p style="margin:0 0 12px">Pickup location: <strong>${
      args.pickupGymName ? escapeHtml(args.pickupGymName) : "Gym"
    }</strong></p>
    ${
      when
        ? `<p style="margin:0 0 12px">Preferred pickup time: <strong>${when}</strong></p>`
        : ""
    }
    <p style="margin:8px 0">Items:</p>
    <ul style="margin:0 0 12px; padding-left:18px">${linesHtml}</ul>
    <p style="margin:0 0 12px"><strong>Total:</strong> ${formatCents(
      args.totalCents
    )}</p>
    <p style="margin:0">Show your code <strong>#${escapeHtml(
      args.shortCode
    )}</strong> at pickup.</p>
  </div>`;
}

// --- Ready for Pickup (sent when gym marks AT_GYM) ---
export function readyForPickupHtml(args: {
  shortCode: string;
  pickupGymName: string | null;
  pickupWhen: Date | null;
}) {
  const when = formatVienna(args.pickupWhen);
  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111; line-height:1.5">
    <h2 style="margin:0 0 12px">Your order is ready for pickup</h2>
    <p style="margin:0 0 12px">Order code: <strong>#${escapeHtml(
      args.shortCode
    )}</strong></p>
    <p style="margin:0 0 12px">Location: <strong>${
      args.pickupGymName ? escapeHtml(args.pickupGymName) : "Gym"
    }</strong></p>
    ${
      when
        ? `<p style="margin:0 0 12px">Arrived at: <strong>${when}</strong></p>`
        : ""
    }
    <p style="margin:0">Please show your code <strong>#${escapeHtml(
      args.shortCode
    )}</strong> at the desk.</p>
  </div>`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
