import nodemailer from 'nodemailer';
import { render } from 'react-email';
import * as React from 'react';
import LeadNotificationEmail from '@/emails/LeadNotification';
import AutoReplyEmail from '@/emails/AutoReply';

const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT || '465', 10);
const secure = process.env.SMTP_SECURE === 'true';
const user = process.env.SMTP_USER;

/**
 * Resolves the final From header.
 * Extracts the email address from the SMTP_FROM environment variable,
 * and attaches the custom display name if provided.
 */
function getSenderAddress(displayName?: string): string {
  const envFrom = process.env.SMTP_FROM || '"mwcrea Forms" <devv80@outlook.com>';
  const match = envFrom.match(/<([^>]+)>/);
  const email = match ? match[1].trim() : envFrom.trim();
  
  if (displayName) {
    const sanitizedName = displayName.replace(/["\\]/g, '');
    return `"${sanitizedName}" <${email}>`;
  }
  return envFrom;
}

/**
 * Collects all SMTP passwords from environment variables.
 * Looks for SMTP_PASS, SMTP_PASS_FALLBACK, SMTP_PASS_FALLBACK_1, etc.
 */
function getSmtpPasswords(): string[] {
  const passwords: string[] = [];
  if (process.env.SMTP_PASS) passwords.push(process.env.SMTP_PASS);
  if (process.env.SMTP_PASS_FALLBACK) passwords.push(process.env.SMTP_PASS_FALLBACK);
  // Support numbered fallbacks: SMTP_PASS_FALLBACK_1, SMTP_PASS_FALLBACK_2, etc.
  for (let i = 1; i <= 10; i++) {
    const envKey = `SMTP_PASS_FALLBACK_${i}`;
    if (process.env[envKey]) passwords.push(process.env[envKey]!);
  }
  return passwords;
}

/**
 * Sends an email using nodemailer with automatic password fallback rotation.
 * Tries each configured SMTP password until one succeeds or all fail.
 */
async function sendWithFallback(mailOptions: nodemailer.SendMailOptions): Promise<{ success: boolean; messageId?: string }> {
  const passwords = getSmtpPasswords();

  if (!host || !user || passwords.length === 0) {
    console.error('[SMTP] Credentials missing in env. Email sending aborted.');
    return { success: false };
  }

  for (let i = 0; i < passwords.length; i++) {
    const currentPass = passwords[i];
    const label = i === 0 ? 'primary' : `fallback-${i}`;
    
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass: currentPass,
      },
    });

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[SMTP] Email sent successfully using ${label} password: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err: unknown) {
      const isAuthError = err instanceof Error && (
        (err as { code?: string }).code === 'EAUTH' ||
        err.message.includes('Authentication unsuccessful') ||
        err.message.includes('Invalid login')
      );

      if (isAuthError && i < passwords.length - 1) {
        console.warn(`[SMTP] Auth failed with ${label} password, trying next fallback...`);
        continue;
      }

      // Either not an auth error (some other issue) or we've exhausted all passwords
      console.error(`[SMTP] Failed to send email with ${label} password:`, err);
      return { success: false };
    }
  }

  return { success: false };
}

/**
 * Sends a HTML/text email notification for a new lead.
 * Directly communicates with the SMTP mail server configured in .env.local.
 */
export async function sendLeadEmail(
  toEmail: string,
  formName: string,
  payload: Record<string, string>,
  ipAddress: string,
  companyName?: string,
  branding?: any
): Promise<boolean> {
  const senderEmailKey = Object.keys(payload).find(k => k.toLowerCase() === 'email');
  const senderEmail = senderEmailKey ? payload[senderEmailKey] : undefined;

  console.log(`[EMAIL] Preparing lead email notification for client: ${toEmail}, Form: "${formName}"`);

  // Render React Email
  const htmlContent = await render(
    React.createElement(LeadNotificationEmail, {
      clientName: companyName || 'Client',
      formName,
      payload: { ...payload, 'IP Address': ipAddress },
      branding: branding || {}
    })
  );

  const textContent = `Nouveau lead reçu\nFormulaire : ${formName}\nIP : ${ipAddress}\n\nDonnées :\n${Object.entries(payload).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;

  const result = await sendWithFallback({
    from: getSenderAddress(companyName ? `${companyName} Forms` : undefined),
    to: toEmail,
    subject: `[Lead] ${formName}`,
    text: textContent,
    html: htmlContent,
    ...(senderEmail ? { replyTo: senderEmail } : {}),
  });

  return result.success;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
}

/**
 * Sends an automatic confirmation/thank-you email to the form submitter.
 */
export async function sendAutoReplyEmail(
  toEmail: string,
  formName: string,
  clientName: string,
  customSubject?: string,
  customMessage?: string,
  lang: string = 'fr',
  branding?: any,
  senderName?: string
): Promise<boolean> {
  const isEn = lang.toLowerCase() === 'en';
  
  const parseTemplate = (text: string) => {
    if (!text) return text;
    const nameToUse = senderName && senderName.trim() !== '' ? senderName.trim() : (isEn ? 'Client' : 'Client');
    return text.replace(/\{\{name\}\}/gi, nameToUse).replace(/\{\{nom\}\}/gi, nameToUse);
  };

  const defaultSubject = isEn
    ? `Confirmation of receipt - ${formName}`
    : `Confirmation de réception - ${formName}`;

  const subject = customSubject && customSubject.trim() !== '' 
    ? parseTemplate(customSubject)
    : defaultSubject;

  const parsedCustomMessage = customMessage ? parseTemplate(customMessage) : undefined;

  // Render React Email AutoReply
  const htmlContent = await render(
    React.createElement(AutoReplyEmail, {
      clientName,
      formName,
      customMessage: parsedCustomMessage,
      branding: branding || {}
    })
  );

  const textContent = parsedCustomMessage && parsedCustomMessage.trim() !== ''
    ? parsedCustomMessage.trim()
    : (isEn 
      ? `Thank you for your message, ${senderName || 'Client'}. We have received your request and will get back to you as soon as possible.`
      : `Merci pour votre message, ${senderName || 'Client'}. Nous avons bien reçu votre demande et vous répondrons dans les meilleurs délais.`);

  const result = await sendWithFallback({
    from: getSenderAddress(clientName),
    to: toEmail,
    subject: subject,
    text: textContent,
    html: htmlContent,
  });

  if (result.success) {
    console.log(`[AUTOREPLY] Email successfully sent to ${toEmail}: ${result.messageId}`);
  } else {
    console.error(`[AUTOREPLY] All SMTP passwords exhausted. Failed to send auto-reply to ${toEmail}`);
  }

  return result.success;
}
