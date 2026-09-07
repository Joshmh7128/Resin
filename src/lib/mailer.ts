/**
 * Outbound email, kept behind one function so the rest of the app never cares
 * how a message is delivered.
 *
 * There is no SMTP dependency: if `RESEND_API_KEY` and `MAIL_FROM` are set the
 * message goes out over Resend's HTTP API, and otherwise it is written to the
 * server log. Logging is the deliberate default rather than an error, because
 * the one thing that sends mail today (password resets) has to keep working on
 * a deployment with no mail provider configured. The admin backend surfaces the
 * reset link directly for exactly that case.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export type MailTransport = "resend" | "log";

export interface MailResult {
  /** False when the provider rejected the message; `error` says why. */
  delivered: boolean;
  transport: MailTransport;
  error?: string;
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  if (!isMailConfigured()) {
    console.info(
      [
        "",
        "── email (no provider configured, logged only) ──",
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        "",
        message.text,
        "────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { delivered: false, transport: "log" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        delivered: false,
        transport: "resend",
        error: `Mail provider returned ${response.status}: ${body.slice(0, 200)}`,
      };
    }

    return { delivered: true, transport: "resend" };
  } catch (error) {
    return {
      delivered: false,
      transport: "resend",
      error: error instanceof Error ? error.message : "Unknown mail error",
    };
  }
}
