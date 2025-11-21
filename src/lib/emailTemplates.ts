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
  lines: Array<{
    qty: number;
    name: string;
    unit: string | null;
    unitCents: number;
    totalCents: number;
  }>;
  totalCents: number;
  recipientName?: string | null;
}) {
  const name = args.recipientName?.trim();
  const greeting = name ? `Kedves ${escapeHtml(name)},` : "Hello,";

  const when = args.pickupWhen
    ? formatDateBudapestISO(args.pickupWhen, {
        dateSep: "/",
        includeTime: true,
      })
    : null;

  const linesHtml = args.lines
    .map(
      (l) =>
        `<li>
           ${l.qty}× ${escapeHtml(l.name)}${l.unit ? ` · ${escapeHtml(l.unit)}` : ""}
           <br>
           &nbsp; — &nbsp; ${l.qty} x ${formatCents(l.unitCents)}  
           &nbsp; = &nbsp; <strong>${formatCents(l.totalCents)}</strong>
         </li>`
    )
    .join("");

  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111; line-height:1.5">
    <h2 style="margin:0 0 12px">Sikeres rendelés visszaigazolása.</h2>
    <h3 style="margin:0 0 12px">${greeting}</h3>
    <p style="margin:0 0 12px">Köszönjük, hogy nálunk vásároltál!</p>
    <p style="margin:0 0 12px">A rendelésedet sikeresen megkaptuk, és már elkezdtük feldolgozni.</p>
    <p style="margin:0 0 0">Hamarosan e-mailben értesítünk minden további részletről,</p>
    <p style="margin:0 0 0">beleértve az átvétel időpontját és a pontos információkat.</p>
    <p style="margin:0 0 12px">Ha bármilyen kérdésed felmerül, örömmel segítünk!</p>
    <p style="margin:0 0 12px">Rendelés kódja: <strong>#${escapeHtml(
      args.shortCode
    )}</strong></p>
    <p style="margin:0 0 12px">MeatPoint: <strong>${
      args.pickupGymName ? escapeHtml(args.pickupGymName) : "Gym"
    }</strong></p>
    ${
      when
        ? `<p style="margin:0 0 12px">Preferred pickup time: <strong>${when}</strong></p>`
        : ""
    }
    <p style="margin:8px 0">Tételek:</p>
    <ul style="margin:0 0 12px; padding-left:18px">${linesHtml}</ul>
    <p style="margin:0 0 12px"><strong>Végösszeg:</strong> ${formatCents(
      args.totalCents
    )}</p>
    <p style="margin:0">Mutasd a <strong>#${escapeHtml(
      args.shortCode
    )}</strong> kodot a csomag atvetelehez.</p>
    <p style="margin:0 0 12px">Köszönjük a bizalmat és hogy minket választottál!</p>
    <p style="margin:0 0 0">A MeatPoint csapata</p>
  </div>`;
}

// --- Ready for Pickup (sent when gym marks AT_GYM) ---
export function readyForPickupHtml(args: {
  shortCode: string;
  pickupGymName: string | null;
  pickupWhen: Date | null;
  lines: Array<{ qty: number; name: string; unit: string | null }>;
  totalCents: number;
  recipientName?: string | null;
}) {
  const name = args.recipientName?.trim();
  const greeting = name ? `Kedves ${escapeHtml(name)},` : "Hello,";

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
    <h2 style="margin:0 0 12px">A rendelésed Rád vár!</h2>
    <h3 style="margin:0 0 12px">${greeting}</h3>
    <p style="margin:0 0 12px">Örömmel értesítünk, hogy a rendelésed elkészült, és mostantól </p>
    <p style="margin:0 0 12px">átvehető a választott edzőteremben.</p>

    <p style="margin:0 0 12px">Rendelés kódja: : <strong>#${escapeHtml(
      args.shortCode
    )}</strong></p>
    <p style="margin:0 0 12px">MeatPoint: <strong>${
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
        <p style="margin:0 0 12px">Kérjük, érkezéskor jelezd a neved és ezt a rendelési kódot: <strong>#${escapeHtml(
          args.shortCode
        )}</strong> így, könnyen be tudjuk azonosítani a csomagodat.</p>
    <p style="margin:0 0 12px">Ha bármilyen kérdésed felmerül az átvétellel vagy a rendelés</p>
    <p style="margin:0 0 0">részleteivel kapcsolatban, szívesen segítünk!</p>
    <p style="margin:0 0 12px">Köszönjük, hogy minket választottál!</p>
    <p style="margin:0 0 0">A MeatPoint csapata</p>
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
