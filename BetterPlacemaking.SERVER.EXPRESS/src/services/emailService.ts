import { env } from "../config/env.js";

interface MailjetMessage {
  From: { Email: string; Name: string };
  To: { Email: string }[];
  Subject: string;
  TextPart: string;
  HTMLPart: string;
}

async function sendMail(toEmail: string, subject: string, text: string, html: string): Promise<void> {
  if (!env.mailjetKey || !env.mailjetSecretKey) {
    console.warn("MAILJET_KEY/MAILJET_SECRET_KEY are not configured. Skipping email send.");
    return;
  }

  const message: MailjetMessage = {
    From: { Email: env.mailjetFromEmail, Name: env.mailjetFromName },
    To: [{ Email: toEmail }],
    Subject: subject,
    TextPart: text,
    HTMLPart: html,
  };

  const auth = Buffer.from(`${env.mailjetKey}:${env.mailjetSecretKey}`).toString("base64");
  const response = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ Messages: [message] }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`Mailjet send failed (${response.status}): ${body}`);
  }
}

export async function sendVerificationEmail(toEmail: string, token: string): Promise<void> {
  const link = `${env.apiBaseUrl.replace(/\/$/, "")}/api/email/verify-email?token=${encodeURIComponent(token)}`;
  await sendMail(
    toEmail,
    "Verify your BetterPlacemaking account",
    `Please verify your email by visiting: ${link}`,
    `<p>Please verify your email by clicking <a href="${link}">this link</a>.</p>`,
  );
}

export async function sendPasswordResetEmail(toEmail: string, token: string): Promise<void> {
  // Deviation from the ASP.NET server: that version links directly to the POST-only
  // API endpoint, which was never actually clickable from an email (no confirm page
  // existed). This links to the React app's reset-password page instead (see plan).
  const link = `${env.appBaseUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail(
    toEmail,
    "Reset your BetterPlacemaking password",
    `Reset your password by visiting: ${link}`,
    `<p>Reset your password by clicking <a href="${link}">this link</a>.</p>`,
  );
}
