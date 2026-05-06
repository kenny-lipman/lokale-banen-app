export function passwordResetEmail(resetLink: string): { subject: string; html: string; text: string } {
  const subject = 'Wachtwoord resetten — Lokale Banen'

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:32px;">
          <tr>
            <td>
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;">Wachtwoord resetten</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">
                Je ontvangt deze e-mail omdat er een verzoek is gedaan om het wachtwoord van je Lokale Banen account opnieuw in te stellen.
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">
                Klik op onderstaande knop om een nieuw wachtwoord in te stellen. <strong>De link is 15 minuten geldig en kan eenmalig gebruikt worden.</strong>
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#111827;border-radius:6px;">
                    <a href="${resetLink}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                      Wachtwoord resetten
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Werkt de knop niet? Kopieer deze link naar je browser:</p>
              <p style="margin:0 0 24px;font-size:12px;color:#6b7280;word-break:break-all;">${resetLink}</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                Heb je dit niet zelf aangevraagd? Negeer deze e-mail. Je wachtwoord blijft ongewijzigd.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `Wachtwoord resetten — Lokale Banen

Je ontvangt deze e-mail omdat er een verzoek is gedaan om het wachtwoord van je Lokale Banen account opnieuw in te stellen.

Open de volgende link om een nieuw wachtwoord in te stellen (15 min geldig, eenmalig bruikbaar):

${resetLink}

Heb je dit niet zelf aangevraagd? Negeer deze e-mail; je wachtwoord blijft ongewijzigd.`

  return { subject, html, text }
}
