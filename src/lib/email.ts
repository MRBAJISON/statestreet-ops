// Minimal email sender. Uses Resend if configured; otherwise logs to the server
// console (dev fallback) so flows are testable without an email provider.
// Set RESEND_API_KEY and EMAIL_FROM in the environment for real delivery.

interface Mail {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'StateStreet Ops <onboarding@resend.dev>';

  if (!key) {
    // Dev fallback — never throws, just logs so you can copy the link locally.
    console.log(`\n[email:dev] To: ${to}\n[email:dev] Subject: ${subject}\n[email:dev] ${html}\n`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    console.error(`[email] send failed (${res.status}): ${msg}`);
  }
}
