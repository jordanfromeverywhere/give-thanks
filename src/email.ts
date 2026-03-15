import { log } from "@clack/prompts";

export async function sendThankYouEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "thanks@give-thanks.dev";

  if (!apiKey) {
    return false;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from,
      to,
      subject,
      text: body,
    });

    return true;
  } catch (err: any) {
    log.warn(`Could not send email: ${err.message}`);
    return false;
  }
}
