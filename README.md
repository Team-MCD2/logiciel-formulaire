# Centralized Form Microservice (mwcrea Forms)

An open-source, self-hosted alternative to Jotform, Formspree, and EmailJS. 
This microservice lets you centralize form submissions from all your marketing websites (villas, agencies, client showcases) into a single dashboard, sending email notifications to clients and automatic auto-replies to submitters.

---

## ⚡ V2 Migration & Quick Start Resume
This system has been upgraded to V2, featuring React Email dynamic branding, top-tier error handling with remedies, and a Magic UI animated dashboard.

**Quick Setup Steps:**
1. **[Database Setup](#1-database-setup-supabase)**: Run `schema.sql`, `migration_auto_reply.sql`, and the new **`migration_v2_branding.sql`** to support client logos and colors.
2. **[SMTP Configuration](#-smtp-provider-setup-guide-resend-vs-brevo)**: Set up Brevo/Resend. (Disable IP Blocking in Brevo to prevent `525 5.7.1` errors).
3. **[Environment Variables](#2-environment-variables-configuration)**: Configure `.env.local` with Supabase, JWT, and SMTP credentials.
4. **[Frontend Integration & Error Handling](#-frontend-integration-guide)**: Connect via HTML or AJAX. The API now returns detailed JSON error objects with `remedy` instructions for easy debugging.

---

## 🚀 Key Features

*   **Centralized Administration Panel (`/admin`)**: Create forms, link them to specific clients, view submissions, download leads, and toggle auto-replies.
*   **Dynamic CORS Validation**: Forms only accept submissions from allowed domains configured in the dashboard (supports wildcard `*`).
*   **Next-Gen Security & Anti-Spam**:
    *   **Proof-of-Work (PoW)**: AJAX submissions must solve a cryptographic CPU challenge, completely blocking automated API spam.
    *   **Active Honeypot (`_gotcha`)**: Submissions with the honey trap filled instantly ban the sender's IP/Fingerprint.
    *   **Reverse DNS VPN Block**: Automatic background reverse lookups blacklisting hosting providers (AWS, DigitalOcean, OVH, etc.).
    *   **Anti-Scraping / DevTools Blocker**: Protection scripts that disable Right-Click, F12, developer shortcuts, and freeze the browser tab if developer tools are opened.
*   **Automatic SMTP Fallback Rotation**: Never lose a lead. If your main SMTP email credentials fail, the mailer rotates through your backup passwords until success.
*   **Multilingual Auto-Reply**: Sends styled confirmation emails to form submitters in their preferred language (`fr` or `en`) based on the form locale.

---

## 🛠️ Tech Stack

*   **Frontend & Admin Dashboard**: Next.js (App Router), Tailwind CSS.
*   **Backend & DB**: Supabase (PostgreSQL), NextJS Route Handlers (Edge & Node runtime compatible).
*   **Email Engine**: Nodemailer (SMTP) with automatic credential rotation.

---

## 📁 Project Structure

```text
├── app/
│   ├── admin/             # Secured administration panel (Dashboard, Forms, Clients, Submissions)
│   ├── api/
│   │   ├── auth/          # Custom JWT-based authentication handlers
│   │   ├── challenge/     # Proof-of-Work cryptographic challenge generator
│   │   └── submit/[id]/   # Dynamic submission endpoint (handles JSON fetch & urlencoded HTML forms)
│   ├── login/             # Admin portal login page
│   └── page.tsx           # Redirection to admin panel
├── components/            # UI components (sidebar, modals, tables, metrics)
├── lib/
│   ├── actions.ts         # Secure Next.js Server Actions (handling all database transactions)
│   ├── blacklist.ts       # Ban & blacklist controls
│   ├── dnsLookup.ts       # Reverse DNS reverse lookup VPN block
│   ├── email.ts           # Email engine with automatic SMTP fallback rotation & templates
│   ├── jwt.ts             # Web Crypto HMAC-SHA256 JWT sign & verify
│   ├── pow.ts             # Cryptographic Proof-of-Work verifier
│   └── supabase.ts        # Service role Supabase client
├── proxy.ts               # Middleware guard (User-Agent blacklisting & admin path obfuscation)
├── schema.sql             # Primary database tables
└── migration_auto_reply.sql # V2 Auto-reply DB migration
```

---

## ⚡ SMTP Provider Setup Guide (Resend vs Brevo)

Outlook, Gmail, and personal Microsoft 365 accounts block basic SMTP authentication (SMTP AUTH) by default to prevent spam. **App passwords will NOT work for Microsoft 365** because SMTP authentication is disabled at the entire mailbox/tenant level (`535 5.7.1 Authentication unsuccessful`, `SmtpClientAuthentication is disabled`).

You **must** switch to a dedicated transactional mail provider.

Because all client websites submit forms to this **centralized Next.js API**, you only configure SMTP **once** in this project's `.env.local`. Client websites do not need any credentials. The SMTP host, port, username, and API key will be exactly the same for all projects and forms.

**⚠️ CRITICAL WARNING:** You cannot use a `.vercel.app` or `.onrender.com` domain as your `SMTP_FROM` email (e.g. `no-reply@my-app.vercel.app`). Mail providers will reject it because you cannot verify DNS records (SPF/DKIM) for Vercel subdomains. You MUST use a custom domain you own (e.g. `contact@your-agency.com`) or use the default sandbox environments.

### Option A: Brevo (Best for Free Tier - 300 emails/day)
Brevo is free for **300 emails/day** (9,000/month). It is highly recommended if you don't want to mess with domains initially, as it allows sending from single verified emails.
*   **Will credentials vary?** No. One Brevo account handles emails for all your forms across all client websites.

**🚨 CRITICAL FIX FOR ERROR `525 5.7.1 Unauthorized IP address`:**
Brevo recently added an aggressive security feature that blocks API/SMTP from unknown IP addresses. Because platforms like Vercel/Render use **dynamic IP addresses**, your emails will randomly fail with the `525 5.7.1` error.
**To fix this:**
1. Log into Brevo, click your profile (top right) > **Settings** > **Security**.
2. Go to the **Authorized IPs** tab.
3. **DEACTIVATE** "Blocking of unknown IP addresses" (or ensure your Vercel static IPs are whitelisted if on a Pro plan). If you test locally, your home IP will be blocked until you disable this!

#### Step-by-Step Brevo Setup:
1.  **Sign up**: Create a free account at [brevo.com](https://brevo.com).
2.  **Add Sender**: Go to your profile menu > **Senders & IP** > **Senders** > **Add a Sender**. Enter the email you want to send from (even a Gmail works for testing, though a custom domain is better). Verify it via the confirmation email.
3.  **Get SMTP Credentials**: Go to **SMTP & API** in the menu > **SMTP** tab. Copy your SMTP key.
4.  **Configure `.env.local`**:
    ```env
    SMTP_HOST=smtp-relay.brevo.com
    SMTP_PORT=587
    SMTP_SECURE=false
    SMTP_USER=your_brevo_login_email@example.com
    SMTP_PASS=xsmtpsib-your_brevo_smtp_key_here
    SMTP_FROM="Your Agency <your_verified_email@example.com>"
    ```

---

### Option B: Resend (Best Developer Experience - 3,000 emails/month)
Resend is a premium developer-focused mailer. It is free for **100 emails/day** (3,000/month). It requires a custom domain to go to production.

#### Step-by-Step Resend Setup:
1.  **Sign up**: Create a free account at [resend.com](https://resend.com).
2.  **Add Domain**: In the left sidebar, click **Domains** > **Add Domain**. Enter your domain name (e.g., `immopro.cm`).
3.  **Configure DNS**: Resend will show 3 DNS records (DKIM and SPF TXT/MX records). Log into your domain registrar (GoDaddy, Cloudflare, etc.) and add these records to your DNS zone.
4.  **Get API Key**: Go to **API Keys** > **Create API Key**. Copy the key (`re_...`).
5.  **Configure `.env.local`**:
    ```env
    SMTP_HOST=smtp.resend.com
    SMTP_PORT=587
    SMTP_SECURE=false
    SMTP_USER=resend
    SMTP_PASS=re_your_api_key_here
    SMTP_FROM="Your Agency <contact@your-domain.com>"
    ```

---

## 💻 Local Development Setup

### 1. Database Setup (Supabase)
Create a new project on [Supabase](https://supabase.com) and execute the SQL definitions in the SQL Editor:
1.  Run `schema.sql` to initialize tables (`clients`, `forms`, `submissions`, `blacklist`, `refresh_tokens`).
2.  Run `migration_auto_reply.sql` to add auto-reply fields to the `forms` table.

### 2. Environment Variables Configuration
Duplicate `.env.local.template` as `.env.local` in the root folder, and fill in the values:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Administration
# Generate SHA-256 hash of your admin password (e.g. for "admin123", use: 24078923b...)
ADMIN_PASSWORD_HASH=your-sha256-hex-hash
JWT_SECRET=any-long-secure-random-string

# SMTP Config
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=re_your_key
SMTP_PASS_FALLBACK=re_backup_key_if_needed
SMTP_FROM="Agency Forms <no-reply@yourdomain.com>"
```

### 3. Install & Launch
```bash
npm install
npm run dev
```
Open `http://localhost:3000` to access the admin panel. Use your hashed password to sign in.

---

## 🔌 Frontend Integration Guide

To submit data to a form, fetch its form ID (UUID) from the admin panel under **Forms**.

### Option A: Standard HTML Form (No JS / Fallback)
Useful for plain HTML pages or environments where JavaScript is disabled.
```html
<form action="http://localhost:3000/api/submit/VOTRE-UUID-DU-FORMULAIRE" method="POST">
  <!-- Honeypot anti-spam trap (hidden from users) -->
  <input type="text" name="_gotcha" style="display:none !important" tabindex="-1" autocomplete="off" />

  <!-- Language field (fr/en) -->
  <input type="hidden" name="_lang" value="fr" />

  <!-- Optional redirect URL (falls back to Referer site if empty) -->
  <input type="hidden" name="redirect_url" value="https://yourwebsite.com/success" />

  <input type="text" name="nom" required placeholder="Nom complet" />
  <input type="email" name="email" required placeholder="Email" />
  <textarea name="message" required placeholder="Message"></textarea>

  <button type="submit">Envoyer</button>
</form>
```

### Option B: AJAX POST with Proof-of-Work (Recommended)
Required to bypass spambots on high-traffic sites using background challenge resolution.

1.  **Request a Cryptographic Challenge**:
    ```js
    const res = await fetch("http://localhost:3000/api/challenge");
    const { challenge, timestamp, difficulty } = await res.json();
    ```
2.  **Solve the Challenge** in CPU background:
    ```js
    async function sha256(str) {
      const buf = new TextEncoder().encode(str);
      const hashBuf = await crypto.subtle.digest("SHA-256", buf);
      return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    let nonce = 0;
    let hash = "";
    const prefix = "0".repeat(difficulty);

    while (true) {
      hash = await sha256(`${challenge}:${nonce}`);
      if (hash.startsWith(prefix)) break;
      nonce++;
    }
    ```
3.  **POST Payload to Submit API**:
    ```js
    const response = await fetch("http://localhost:3000/api/submit/VOTRE-UUID-DU-FORMULAIRE", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        nom: "Jean Dupont",
        email: "jean@example.com",
        message: "Message content...",
        _lang: "fr", // 'fr' or 'en' for auto-reply localization
        
        // Proof of Work parameters
        pow_challenge: challenge,
        pow_timestamp: timestamp,
        pow_nonce: nonce.toString()
      })
    });
    const result = await response.json();
    ```

---

## 🛡️ Operations & Troubleshooting

*   **Why does the submitter not receive an auto-reply?**
    *   Make sure `auto_reply_enabled` is checked in the form configuration panel.
    *   Auto-replies are restricted to **3 emails per 10 minutes** per email address to prevent form flooding. If you test multiple times, you might hit this limit.
*   **Where are blocked requests logged?**
    *   If a request fails Honeypot or Rate Limits, the source IP/Fingerprint is appended to the `blacklist` table in your database and will reject future connections with `404 Not Found`. You can manually delete blocked rows via `/admin/blacklist`.

---

## 🏗️ V2 Architectural Decisions & Testing Guide

This project was recently upgraded to V2 to ensure it operates at a Senior Developer level, particularly focusing on **World-Class Error Handling**, **Dynamic Multi-Tenant Branding**, and **UI/UX Polish**.

### What Was Done & Why?

1. **Senior Dev-Level API Error Handling:**
   - **What:** The `createErrorResponse` system in `app/api/submit/[id]/route.ts` was entirely refactored. Every error response now includes a specific JSON `remedy` string detailing exactly how to fix the error. The HTML fallback UI also highlights this solution.
   - **Why:** Frontend developers integrating this API on client sites do not have access to server logs. If they configure CORS incorrectly or forget Proof-of-Work parameters, they need immediate, actionable feedback (like Stripe's API), rather than generic "Bad Request" errors.

2. **React Email & Dynamic Branding:**
   - **What:** Replaced basic string-template emails with `@react-email/components`. Added `logo_url`, `primary_color`, and `font_family` to the `clients` database schema (via `migration_v2_branding.sql`). The API dynamically injects these into `LeadNotification` and `AutoReply` emails.
   - **Why:** To make the microservice truly multi-tenant. A form submission for "ImmoPro" looks completely different from another client's form submission. It respects each brand's artistic direction natively.

3. **Magic UI Dashboard Redesign:**
   - **What:** Integrated `framer-motion` and Magic UI components (`BlurFade`, `ShimmerButton`, `BorderBeam`, `NumberTicker`) directly into the Admin Panel (`app/admin/page.tsx` and `[id]/page.tsx`).
   - **Why:** To elevate the UI to a modern, premium feel. *Crucially, no new colors were introduced* to strictly preserve the existing minimalist slate/dark blue theme.

### How to Test the V2 Features

1. **Test the Error Handling DX:**
   - Attempt a `POST` request to an invalid UUID (e.g., `http://localhost:3000/api/submit/1234`).
   - *Expected Result:* A JSON response containing a specific `remedy` like `"Check the Form ID in your fetch URL..."`.

2. **Test React Email Branding:**
   - In Supabase, update a client's `primary_color` (e.g., `#ef4444`) and `logo_url`. Submit a form tied to that client.
   - *Expected Result:* The auto-reply sent to your email will feature the red accent color and the client's logo, rendered flawlessly in HTML.

3. **Test Magic UI:**
   - Navigate to the `/admin` dashboard. 
   - *Expected Result:* The statistics cards will fade in sequentially (`BlurFade`), and the numbers will count up dynamically (`NumberTicker`). Open a form's details page to see the `BorderBeam` highlight the integration code on hover.

#   l o g i c i e l - f o r m u l a i r e  
 