// src/lib/mail.ts
import { Resend } from "resend";

const resendKey = process.env.RESEND_API_KEY;
export const isEmailEnabled = !!resendKey;

const resend = resendKey ? new Resend(resendKey) : null;

type SendArgs = {
  to: string | string[];
  subject: string;
  react?: React.ReactElement;
  html?: string;
};

const FROM = process.env.MAIL_FROM || "no-reply@example.com";
const REPLY_TO = process.env.MAIL_REPLY_TO;

export async function sendEmail({ to, subject, react, html }: SendArgs) {
  // Soft-disable in dev if no key
  if (!isEmailEnabled || !resend) {
    console.warn("[mail] Skipping (no RESEND_API_KEY).", { to, subject });
    return { skipped: true };
  }

  return await resend.emails.send({
    from: FROM,
    to,
    subject,
    react,
    html,
    replyTo: REPLY_TO,
  });
}
