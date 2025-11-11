// src/lib/emailTemplates.ts
import { formatHuf, formatDateBudapestISO } from "./format";

export function formatCents(amountHuf: number) {
  return formatHuf(amountHuf);
}

// --- Order Confirmation (after checkout) ---
export function orderConfirmationHtml(args: {
  shortCode: string;
  pickupGymName: string | null;
  pickupWhen: Date | null;
  lines: Array<{ qty: number; name: string; unit: string | null }>;
  totalCents: number;
}) {
  const when = args.pickupWhen
    ? formatDateBudapestISO(args.pickupWhen, {
        dateSep: "/",
        includeTime: true,
      })
    : null;
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
    <p style="margin:0 0 12px">Rendeles kodja: <strong>#${escapeHtml(
      args.shortCode
    )}</strong></p>
    <p style="margin:0 0 12px">Hus pont: <strong>${
      args.pickupGymName ? escapeHtml(args.pickupGymName) : "Gym"
    }</strong></p>
    ${
      when
        ? `<p style="margin:0 0 12px">Preferred pickup time: <strong>${when}</strong></p>`
        : ""
    }
    <p style="margin:8px 0">Tetelek:</p>
    <ul style="margin:0 0 12px; padding-left:18px">${linesHtml}</ul>
    <p style="margin:0 0 12px"><strong>Vegosszeg:</strong> ${formatCents(
      args.totalCents
    )}</p>
    <p style="margin:0">Mutasd a <strong>#${escapeHtml(
      args.shortCode
    )}</strong> kodot a csomag atvetelehez.</p>
  </div>`;
}

// --- Ready for Pickup (sent when gym marks AT_GYM) ---
export function readyForPickupHtml(args: {
  shortCode: string;
  pickupGymName: string | null;
  pickupWhen: Date | null;
  lines: Array<{ qty: number; name: string; unit: string | null }>;
  totalCents: number;
}) {
  const when = args.pickupWhen
    ? formatDateBudapestISO(args.pickupWhen, {
        dateSep: "/",
        includeTime: true,
      })
    : null;
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
    <h2 style="margin:0 0 12px">Your order is ready for pickup</h2>
    <p style="margin:0 0 12px">Rendeles kodja: <strong>#${escapeHtml(
      args.shortCode
    )}</strong></p>
    <p style="margin:0 0 12px">Hus pont: <strong>${
      args.pickupGymName ? escapeHtml(args.pickupGymName) : "Gym"
    }</strong></p>
    ${
      when
        ? `<p style="margin:0 0 12px">Arrived at: <strong>${when}</strong></p>`
        : ""
    }
    <p style="margin:8px 0">Tetelek:</p>
    <ul style="margin:0 0 12px; padding-left:18px">${linesHtml}</ul>
    <p style="margin:0 0 12px"><strong>Vegosszeg:</strong> ${formatCents(
      args.totalCents
    )}</p>
    <p style="margin:0">Mutasd a <strong>#${escapeHtml(
      args.shortCode
    )}</strong> kodot a csomag atvetelehez.</p>
  </div>`;
}

// --- Email verification On sign up
export function verifyEmailHtml(args: { link: string }) {
  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.4">
      <h2>Verify your email</h2>
      <p>Click the button below to verify your email address.</p>
      <p>
        <a href="${args.link}"
           style="display:inline-block;background:#111;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">
          Verify Email
        </a>
      </p>
      <p style="font-size:12px;color:#666">If the button doesn't work, copy & paste this link:<br/>${args.link}</p>
    </div>
  `;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
