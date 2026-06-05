import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isBlacklisted, blacklistTarget } from '@/lib/blacklist';
import { handleHoneypotTrigger, resolveHostDomain } from '@/lib/dnsLookup';
import { verifyChallenge } from '@/lib/pow';
import { sendLeadEmail, sendAutoReplyEmail } from '@/lib/email';

// Basic in-memory cache for anti-replay (holds challenges for 5 mins)
const challengeReplayCache = new Set<string>();

// Rate limiting in-memory store (cleared every 1 minute)
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

function checkRateLimit(key: string, limit = 5): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  
  if (!entry) {
    rateLimitMap.set(key, { count: 1, timestamp: now });
    return true;
  }
  
  // Clear counts older than 1 minute
  if (now - entry.timestamp > 60 * 1000) {
    rateLimitMap.set(key, { count: 1, timestamp: now });
    return true;
  }
  
  entry.count++;
  return entry.count <= limit;
}

// In-memory rate limiting store for auto-replies (holds timestamps of e-mails sent within 10 mins)
const autoReplyRateLimitMap = new Map<string, number[]>();

function checkAutoReplyRateLimit(email: string, limit = 3, timeframeMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const normalizedEmail = email.toLowerCase().trim();
  const timestamps = autoReplyRateLimitMap.get(normalizedEmail) || [];
  
  // Filter out timestamps older than 10 minutes
  const recentTimestamps = timestamps.filter(t => now - t < timeframeMs);
  
  if (recentTimestamps.length >= limit) {
    return false;
  }
  
  recentTimestamps.push(now);
  autoReplyRateLimitMap.set(normalizedEmail, recentTimestamps);
  return true;
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

async function logFailure(formId: string | null, errorType: string, errorMessage: string, payload: any = {}) {
  try {
    await supabase.from('failures_log').insert([{
      form_id: formId || null,
      error_type: errorType,
      error_message: errorMessage,
      payload: payload
    }]);
  } catch (e) {
    console.error('[LOG FAILURE ERROR]', e);
  }
}

/**
 * Creates a structured error response.
 * If origin is present (AJAX/Fetch request), it returns a JSON response with proper CORS headers.
 * Otherwise, it returns a user-friendly HTML error page.
 */
function createErrorResponse(
  status: number,
  code: string,
  message: string,
  remedy: string | null,
  origin: string | null,
  isJson: boolean,
  redirectUrl: string
): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, x-client-fingerprint';
  }

  if (isJson || origin) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        code,
        error: message,
        ...(remedy ? { remedy } : {})
      }),
      { status, headers }
    );
  } else {
    // Return friendly HTML error page for native submissions
    return new NextResponse(
      `<!DOCTYPE html>
       <html>
         <head>
           <meta charset="utf-8">
           <title>Erreur de soumission / Submission Error</title>
           <style>
             body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #FFF5F5; color: #9B2C2C; }
             .card { background: white; padding: 2.5rem; border-radius: 1.5rem; border: 1px solid #FED7D7; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); text-align: center; max-width: 450px; }
             .icon { font-size: 3rem; margin-bottom: 1rem; color: #E53E3E; }
             h1 { color: #9B2C2C; font-size: 1.25rem; font-weight: 700; margin: 0 0 0.5rem 0; }
             p { font-size: 0.875rem; color: #C53030; line-height: 1.6; margin: 0; }
             .code { font-family: monospace; background: #FEEBC8; color: #C05621; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-size: 0.75rem; display: inline-block; margin-top: 0.5rem; }
             .remedy { margin-top: 1rem; font-size: 0.875rem; color: #742A2A; background: #FED7D7; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid #FC8181; }
             .back-btn { display: inline-block; margin-top: 1.5rem; padding: 0.625rem 1.25rem; background: #E53E3E; color: white; text-decoration: none; border-radius: 0.75rem; font-size: 0.875rem; font-weight: 600; transition: opacity 0.2s; }
             .back-btn:hover { opacity: 0.9; }
           </style>
         </head>
         <body>
           <div class="card">
             <div class="icon">⚠</div>
             <h1>Erreur de soumission</h1>
             <p>${escapeHtml(message)}</p>
             ${remedy ? `<div class="remedy"><strong>Solution :</strong> ${escapeHtml(remedy)}</div>` : ''}
             <div class="code">Code: ${escapeHtml(code)}</div>
             <br />
             <a href="javascript:history.back()" class="back-btn">Retour / Back</a>
           </div>
         </body>
       </html>`,
      {
        status,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }
    );
  }
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: formId } = await params;
  
  // CORS Preflight request
  const origin = request.headers.get('origin');
  if (!origin) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Missing Origin header', code: 'MISSING_ORIGIN' }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Lookup form in Supabase to verify CORS dynamically
  const { data: form, error } = await supabase
    .from('forms')
    .select('allowed_origins, is_active')
    .eq('id', formId)
    .single();

  if (error || !form) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Form not found', code: 'FORM_NOT_FOUND' }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
        }
      }
    );
  }

  if (!form.is_active) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Form is deactivated', code: 'FORM_INACTIVE' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
        }
      }
    );
  }

  // Check origins
  if (!form.allowed_origins.includes(origin) && !form.allowed_origins.includes('*')) {
    return new NextResponse(
      JSON.stringify({ success: false, error: `Origin '${origin}' is not authorized`, code: 'CORS_NOT_ALLOWED' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
        }
      }
    );
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-client-fingerprint',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: formId } = await params;
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // Determine client IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
  
  // Read client fingerprint if present in headers
  const fingerprint = request.headers.get('x-client-fingerprint') || 'no_fingerprint';

  let isJson = false;
  let redirectUrl = referer || '/';

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    isJson = true;
  }

  // 1. General Blacklist Check (IP, Fingerprint, Host)
  if (await isBlacklisted(ipAddress) || (fingerprint !== 'no_fingerprint' && await isBlacklisted(fingerprint))) {
    await logFailure(formId, 'BLACKLIST_TRIGGER', `Blocked IP/Fingerprint: ${ipAddress}`);
    return createErrorResponse(
      403,
      'SENDER_BLACKLISTED',
      'Your IP address or browser signature has been blocked due to suspicious activity.',
      'Ensure you are not using a blacklisted VPN or making abusive requests.',
      origin,
      isJson,
      redirectUrl
    );
  }
  
  // Reverse lookup check for hostname blacklist
  const resolvedHost = await resolveHostDomain(ipAddress);
  if (resolvedHost && await isBlacklisted(resolvedHost)) {
    return createErrorResponse(
      403,
      'HOST_BLACKLISTED',
      'This submission was blocked by security filters (Hosting/VPN block).',
      'Please disable your VPN, proxy, or datacenter IP to submit this form.',
      origin,
      isJson,
      redirectUrl
    );
  }

  const { data: form, error: formError } = await supabase
    .from('forms')
    .select('name, is_active, allowed_origins, notify_email, auto_reply_enabled, auto_reply_subject, auto_reply_message, success_url, client_id, clients(name, email, logo_url, primary_color, font_family)')
    .eq('id', formId)
    .single();

  if (form && form.success_url && form.success_url.trim() !== '') {
    redirectUrl = form.success_url;
  }

  if (formError) {
    console.error('[SUBMIT] Database query error:', formError);
    return createErrorResponse(
      500,
      'DATABASE_QUERY_ERROR',
      `A database error occurred while fetching the form: ${formError.message}`,
      'Check your database schema. Ensure the forms and clients tables exist and contain all required columns (including recent migrations).',
      origin,
      isJson,
      redirectUrl
    );
  }

  if (!form) {
    return createErrorResponse(
      404,
      'FORM_NOT_FOUND',
      `The Form ID '${formId}' is invalid, deactivated, or does not exist.`,
      'Check the Form ID in your fetch URL or form action. You can copy the correct ID from the admin dashboard.',
      origin,
      isJson,
      redirectUrl
    );
  }

  if (!form.is_active) {
    return createErrorResponse(
      403,
      'FORM_INACTIVE',
      'This form has been deactivated by the administrator.',
      'Log into the mwcrea Forms dashboard and toggle "Active" for this form.',
      origin,
      isJson,
      redirectUrl
    );
  }

  // Dynamic CORS Verification (for AJAX submissions)
  if (origin) {
    if (!form.allowed_origins.includes(origin) && !form.allowed_origins.includes('*')) {
      return createErrorResponse(
        403,
        'CORS_NOT_ALLOWED',
        `Origin '${origin}' is not authorized to submit to this form. Please configure it in your form settings.`,
        `Log into the mwcrea Forms dashboard, edit this form, and add "${origin}" to the Allowed Domains list.`,
        origin,
        isJson,
        redirectUrl
      );
    }
  }

  // 3. Rate Limiting Check (5 per minute per IP / Fingerprint)
  const rateLimitKey = `${ipAddress}:${fingerprint}`;
  if (!checkRateLimit(rateLimitKey)) {
    // If rate limit is hit, temporarily block & notify
    await blacklistTarget(ipAddress, 'ip', 'Rate limit exceeded (API Spam)');
    return createErrorResponse(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Rate limit exceeded. Please wait a minute before making another submission.',
      'Stop submitting forms rapidly. Try again in a few minutes.',
      origin,
      isJson,
      redirectUrl
    );
  }

  // Parse Body
  let payload: Record<string, string> = {};
  
  try {
    if (isJson) {
      payload = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // Standard HTML form submission — parse URL-encoded body
      const rawBody = await request.text();
      console.log(`[SUBMIT] Raw urlencoded body: "${rawBody}"`);
      const params = new URLSearchParams(rawBody);
      params.forEach((value, key) => {
        payload[key] = value;
      });
    } else {
      // multipart/form-data or other
      const formData = await request.formData();
      formData.forEach((value, key) => {
        payload[key] = value.toString();
      });
    }
    
    if (payload.redirect_url) {
      redirectUrl = payload.redirect_url;
    }
  } catch (err) {
    console.error('[SUBMIT] Body parsing error:', err);
    return createErrorResponse(
      400,
      'INVALID_REQUEST_BODY',
      'Failed to parse submission body. Make sure the content-type and parameters match.',
      'Ensure your request body matches your Content-Type header. If using fetch, stringify your JSON body or send a valid FormData object.',
      origin,
      isJson,
      redirectUrl
    );
  }

  console.log(`[SUBMIT] Parsed payload keys: [${Object.keys(payload).join(', ')}]`);

  // 4. Honeypot check: "_gotcha"
  // If bots fill this invisible input field, trigger active blacklisting immediately
  if (payload._gotcha !== undefined && payload._gotcha !== '') {
    await logFailure(formId, 'HONEYPOT_TRIGGER', 'Honeypot field was filled out', payload);
    // Flag IP, Fingerprint & resolve VPN host asynchronously
    await handleHoneypotTrigger(ipAddress, fingerprint);
    
    // Deceptive silent success response so bots don't realize they are caught
    const headers: Record<string, string> = {};
    if (origin) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
    if (isJson || origin) {
      return NextResponse.json({ success: true, message: 'Submission logged.' }, { headers });
    } else {
      if (redirectUrl.startsWith('file://') || redirectUrl.startsWith('chrome-error://')) {
        return new NextResponse(
          `<!DOCTYPE html>
           <html>
             <head>
               <meta charset="utf-8">
               <title>Soumission réussie</title>
               <style>
                 body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #F9FAFB; color: #0F172A; }
                 .card { background: white; padding: 2.5rem; border-radius: 1.5rem; border: 1px solid #F1F5F9; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); text-align: center; max-width: 400px; }
                 .icon { font-size: 3rem; margin-bottom: 1rem; }
                 h1 { color: #0F172A; font-size: 1.25rem; font-weight: 700; margin: 0 0 0.5rem 0; }
                 p { font-size: 0.875rem; color: #64748B; line-height: 1.6; margin: 0; }
                 .back-btn { display: inline-block; margin-top: 1.5rem; padding: 0.625rem 1.25rem; background: #0F172A; color: white; text-decoration: none; border-radius: 0.75rem; font-size: 0.875rem; font-weight: 600; transition: opacity 0.2s; }
                 .back-btn:hover { opacity: 0.9; }
               </style>
             </head>
             <body>
               <div class="card">
                 <div class="icon">✓</div>
                 <h1>Message envoyé !</h1>
                 <p>Votre message a été enregistré avec succès. Le destinataire a été notifié.</p>
                 <a href="javascript:history.back()" class="back-btn">Retour au formulaire</a>
               </div>
             </body>
           </html>`,
          {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
            },
          }
        );
      }
      return NextResponse.redirect(new URL(`${redirectUrl}?submitted=true`, request.url), 303);
    }
  }

  // Clean payload by removing utility fields
  const cleanPayload = { ...payload };
  delete cleanPayload._gotcha;
  delete cleanPayload.redirect_url;
  delete cleanPayload.pow_challenge;
  delete cleanPayload.pow_timestamp;
  delete cleanPayload.pow_nonce;

  // Extract submit language if present, then delete it from clean payload
  const lang = payload._lang || payload.lang || 'fr';
  delete cleanPayload._lang;
  delete cleanPayload.lang;

  // 4b. Keyword Spam Filter Check
  // IMPORTANT: Only scan actual user-typed text fields, NOT binary data.
  // Base64 photo blobs (300KB+) statistically guarantee false positives
  // for short keywords like "seo" due to random character sequences.
  const SPAM_KEYWORDS = ['seo', 'crypto', 'viagra', 'enlarge', 'casino', 'bitcoin', 'investment'];
  const textOnlyPayload: Record<string, string> = {};
  for (const [key, value] of Object.entries(cleanPayload)) {
    if (
      typeof value === 'string' &&
      !value.startsWith('data:') &&       // Exclude Base64 data URIs
      value.length < 5000                  // Exclude any abnormally long blob
    ) {
      textOnlyPayload[key] = value;
    }
  }
  const payloadString = JSON.stringify(textOnlyPayload).toLowerCase();
  const isSpam = SPAM_KEYWORDS.some(keyword => payloadString.includes(keyword));
  
  if (isSpam) {
    await logFailure(formId, 'SPAM_KEYWORD', 'Payload contained blacklisted keywords', cleanPayload);
    // Deceptive silent success response
    const headers: Record<string, string> = origin ? { 'Access-Control-Allow-Origin': origin } : {};
    if (isJson || origin) {
      return NextResponse.json({ success: true, message: 'Submission logged successfully' }, { headers });
    } else {
      if (redirectUrl.startsWith('file://') || redirectUrl.startsWith('chrome-error://')) {
        return new NextResponse('<p>Success</p>', { headers: { 'Content-Type': 'text/html' } });
      }
      return NextResponse.redirect(new URL(`${redirectUrl}?submitted=true`, request.url), 303);
    }
  }

  // Process Base64 attachments (upload to Supabase Storage)
  const sanitizeForFilename = (str: string) => str.replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase().substring(0, 30);
  
  const nomKey = Object.keys(cleanPayload).find(k => k.toLowerCase() === 'nom' || k.toLowerCase() === 'name');
  const marqueKey = Object.keys(cleanPayload).find(k => k.toLowerCase() === 'marque' || k.toLowerCase() === 'brand');
  const modeleKey = Object.keys(cleanPayload).find(k => k.toLowerCase() === 'modele' || k.toLowerCase() === 'model');

  const nom = nomKey ? sanitizeForFilename(cleanPayload[nomKey]) : 'user';
  const marque = marqueKey ? sanitizeForFilename(cleanPayload[marqueKey]) : '';
  const modele = modeleKey ? sanitizeForFilename(cleanPayload[modeleKey]) : '';
  const baseNameParts = [nom, marque, modele].filter(Boolean);
  const baseName = baseNameParts.length > 0 ? baseNameParts.join('-') : 'upload';

  for (const [key, value] of Object.entries(cleanPayload)) {
    if (typeof value === 'string' && value.startsWith('data:')) {
      const match = value.match(/^data:(.*?);base64,(.*)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        
        let ext = 'bin';
        if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
        else if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('pdf')) ext = 'pdf';
        else if (mimeType.includes('webp')) ext = 'webp';

        const filename = `${Date.now()}-${baseName}-${sanitizeForFilename(key)}.${ext}`;
        const buffer = Buffer.from(base64Data, 'base64');
        
        try {
          const { data, error } = await supabase.storage
            .from('uploads')
            .upload(filename, buffer, {
              contentType: mimeType,
              upsert: true
            });
            
          if (!error && data) {
            const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(filename);
            if (urlData && urlData.publicUrl) {
              cleanPayload[key] = urlData.publicUrl;
              console.log(`[SUBMIT] Successfully uploaded ${filename}`);
            }
          } else {
            console.error('[SUBMIT] Supabase storage upload error:', error);
          }
        } catch (uploadErr) {
          console.error('[SUBMIT] Buffer upload exception:', uploadErr);
        }
      }
    }
  }

  // 5. Proof-of-Work (PoW) verification for AJAX requests
  // Safe fallback if not AJAX (no CORS headers / normal Form submission)
  if (isJson) {
    const powChallenge = payload.pow_challenge;
    const powTimestamp = parseInt(payload.pow_timestamp || '0', 10);
    const powNonce = payload.pow_nonce;

    if (!powChallenge || !powTimestamp || !powNonce) {
      return createErrorResponse(
        400,
        'POW_PARAMETERS_MISSING',
        'Missing Proof-of-Work cryptographic verification parameters.',
        'Include pow_challenge, pow_timestamp, and pow_nonce in your JSON payload when submitting via AJAX.',
        origin,
        isJson,
        redirectUrl
      );
    }

    // Check challenge replay attack
    if (challengeReplayCache.has(powChallenge)) {
      return createErrorResponse(
        400,
        'POW_REPLAY_DETECTED',
        'Proof-of-Work challenge has already been processed and cannot be reused.',
        'Fetch a new challenge from /api/challenge before each submission. Do not cache the challenge.',
        origin,
        isJson,
        redirectUrl
      );
    }

    const powValid = await verifyChallenge(powChallenge, powTimestamp, powNonce, ipAddress);
    if (!powValid) {
      return createErrorResponse(
        400,
        'POW_SOLUTION_INVALID',
        'Proof-of-Work solution verification failed. Challenge might have expired.',
        'Ensure your client-side proof of work computation matches the difficulty required and submit before the timestamp expires.',
        origin,
        isJson,
        redirectUrl
      );
    }

    // Cache the verified challenge to prevent reuse (evicts after 5 mins)
    challengeReplayCache.add(powChallenge);
    setTimeout(() => challengeReplayCache.delete(powChallenge), 5 * 60 * 1000);
  }

  // 6. Persist Lead in database
  const { error: insertError } = await supabase
    .from('submissions')
    .insert([
      {
        form_id: formId,
        payload: cleanPayload,
        ip_address: ipAddress,
        fingerprint,
      },
    ]);

  if (insertError) {
    console.error('Error inserting submission:', insertError);
    return createErrorResponse(
      500,
      'DATABASE_INSERT_FAILED',
      'An internal database error occurred while registering your submission.',
      'Check your Supabase instance logs. Ensure the submissions table schema is correct.',
      origin,
      isJson,
      redirectUrl
    );
  }

  if (form.notify_email && form.clients) {
    const clientObj = form.clients as unknown as { name: string; email: string; logo_url?: string; primary_color?: string; font_family?: string };
    const clientEmail = clientObj?.email;
    const clientName = clientObj?.name;
    const branding = {
      logo_url: clientObj?.logo_url,
      primary_color: clientObj?.primary_color,
      font_family: clientObj?.font_family,
    };
    
    if (clientEmail) {
      // Asynchronously send SMTP email
      sendLeadEmail(clientEmail, form.name, cleanPayload, ipAddress, clientName, branding).catch(err => {
        console.error('SMTP Background error:', err);
        logFailure(formId, 'SMTP_FAILED', `Failed to send lead email: ${err.message || err}`, cleanPayload);
      });
    }
  }

  // 7b. Send Auto-Reply confirmation to sender if enabled
  if (form.auto_reply_enabled) {
    // Check if the payload contains the sender's email (case-insensitive search)
    const senderEmailKey = Object.keys(cleanPayload).find(k => k.toLowerCase() === 'email');
    const senderEmail = senderEmailKey ? cleanPayload[senderEmailKey] : undefined;

    if (senderEmail && typeof senderEmail === 'string' && senderEmail.trim() !== '') {
      const emailToSubmit = senderEmail.trim();
      const clientObj = form.clients as unknown as { name: string; email: string; logo_url?: string; primary_color?: string; font_family?: string };
      const clientName = clientObj ? clientObj.name : 'Notre Entreprise';
      const branding = clientObj ? {
        logo_url: clientObj.logo_url,
        primary_color: clientObj.primary_color,
        font_family: clientObj.font_family,
      } : {};

      const senderNameKey = Object.keys(cleanPayload).find(k => k.toLowerCase() === 'nom' || k.toLowerCase() === 'name');
      const senderName = senderNameKey ? String(cleanPayload[senderNameKey]).trim() : undefined;

      // Apply anti-reply rate limit for auto-replies
      if (checkAutoReplyRateLimit(emailToSubmit)) {
        sendAutoReplyEmail(
          emailToSubmit,
          form.name,
          clientName,
          form.auto_reply_subject || undefined,
          form.auto_reply_message || undefined,
          lang,
          branding,
          senderName
        ).catch(err => {
          console.error('Auto-reply background error:', err);
          logFailure(formId, 'SMTP_AUTOREPLY_FAILED', `Failed to send auto-reply to ${emailToSubmit}: ${err.message || err}`, cleanPayload);
        });
      } else {
        console.warn(`[AUTOREPLY] Rate limit exceeded for email: ${emailToSubmit}. Skipping auto-reply.`);
      }
    } else {
      console.log('[AUTOREPLY] No valid email field found in payload. Skipping auto-reply.');
    }
  }

  // 8. Output Response
  const headers: Record<string, string> = {};
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  // If the request came via fetch/AJAX (has origin header), always return JSON with CORS headers.
  // Redirects only work for native browser form POSTs (no origin header).
  if (isJson || origin) {
    return NextResponse.json({ success: true, message: 'Submission logged successfully' }, { headers });
  } else {
    // Native HTML Form redirect back to Vitrine (no JS fetch involved)
    if (redirectUrl.startsWith('file://') || redirectUrl.startsWith('chrome-error://')) {
      return new NextResponse(
        `<!DOCTYPE html>
         <html>
           <head>
             <meta charset="utf-8">
             <title>Soumission réussie</title>
             <style>
               body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #F9FAFB; color: #0F172A; }
               .card { background: white; padding: 2.5rem; border-radius: 1.5rem; border: 1px solid #F1F5F9; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); text-align: center; max-width: 400px; }
               .icon { font-size: 3rem; margin-bottom: 1rem; }
               h1 { color: #0F172A; font-size: 1.25rem; font-weight: 700; margin: 0 0 0.5rem 0; }
               p { font-size: 0.875rem; color: #64748B; line-height: 1.6; margin: 0; }
               .back-btn { display: inline-block; margin-top: 1.5rem; padding: 0.625rem 1.25rem; background: #0F172A; color: white; text-decoration: none; border-radius: 0.75rem; font-size: 0.875rem; font-weight: 600; transition: opacity 0.2s; }
               .back-btn:hover { opacity: 0.9; }
             </style>
           </head>
           <body>
             <div class="card">
               <div class="icon">✓</div>
               <h1>Message envoyé !</h1>
               <p>Votre message a été enregistré avec succès. Le destinataire a été notifié.</p>
               <a href="javascript:history.back()" class="back-btn">Retour au formulaire</a>
             </div>
           </body>
         </html>`,
        {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        }
      );
    }
    const url = new URL(redirectUrl, request.url);
    url.searchParams.set('submitted', 'true');
    return NextResponse.redirect(url, 303);
  }
}
