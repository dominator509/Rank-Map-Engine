import { logger as rootLogger } from "./logger.js";

const logger = rootLogger.child({ module: "email" });

export function parseSmtpPort(value: string | undefined): number {
  if (value === undefined || !/^[1-9]\d*$/.test(value)) {
    return 587;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : 587;
}

export interface EmailPayload {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

async function sendViaSMTP(payload: EmailPayload): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error("SMTP not configured");

  const nodemailer = await import("nodemailer");
  const port = parseSmtpPort(SMTP_PORT);
  const transporter = nodemailer.default.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: EMAIL_FROM ?? SMTP_USER,
    to: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { SMTP_HOST } = process.env;
  if (!SMTP_HOST) {
    logger.info({ to: payload.to, subject: payload.subject }, "[email-mock] Would send email");
    return;
  }
  try {
    await sendViaSMTP(payload);
    logger.info({ to: payload.to, subject: payload.subject }, "Email sent");
  } catch (err) {
    logger.error({ err, to: payload.to, subject: payload.subject }, "Failed to send email");
  }
}

export function inviteEmailHtml(
  inviteUrl: string,
  inviterName: string,
  workspaceName: string,
): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px">
  <h2>You've been invited to ${workspaceName}</h2>
  <p>${inviterName} has invited you to join their RankMap workspace.</p>
  <p>
    <a href="${inviteUrl}" style="background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
      Accept Invitation
    </a>
  </p>
  <p style="color:#666;font-size:12px">This link expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.</p>
</body>
</html>`.trim();
}

export function reportReadyEmailHtml(
  projectName: string,
  reportType: string,
  appUrl: string,
): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px">
  <h2>Your RankMap report is ready</h2>
  <p>Your <strong>${reportType}</strong> report for project <strong>${projectName}</strong> has been generated.</p>
  <p>
    <a href="${appUrl}" style="background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
      View Report
    </a>
  </p>
</body>
</html>`.trim();
}
