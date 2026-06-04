# mwcrea Forms — Guide d'utilisation et d'administration

Ce document centralise toutes les informations nécessaires à l'administration, au déploiement et à l'intégration du micro-service interne de formulaires.

---

## 1. Description du fonctionnement

Le système fait office de relais entre les formulaires HTML de nos sites vitrines et les boîtes mails de nos clients. Il permet d'éliminer l'utilisation de services tiers payants (comme Jotform ou EmailJS) et d'héberger l'intégralité de nos soumissions.

### Workflow technique
1. Le visiteur soumet un formulaire sur un site vitrine.
2. La requête `POST` est envoyée à `https://votre-app-domain.com/api/submit/[id-formulaire]`.
3. Le serveur Next.js intercepte la soumission et effectue les contrôles de sécurité :
   - Vérifie si l'origine CORS est autorisée.
   - S'assure que l'IP/Empreinte/Hôte n'est pas blacklisté.
   - Vérifie le **Honeypot** : si le champ caché `_gotcha` est rempli, l'IP est instantanément bannie de façon définitive et un reverse DNS cherche à bloquer tout l'hébergeur/VPN associé.
   - Vérifie la preuve de travail (**Proof of Work**) si c'est une requête AJAX.
   - Effectue un rate-limiting temporaire.
4. Les données nettoyées sont stockées en BDD dans Supabase.
5. Une notification est envoyée au client configuré via notre serveur SMTP (Nodemailer).

---

## 2. Guide d'intégration sur un site vitrine

### Option A : Soumission HTML Standard (Sans JavaScript)
C'est la méthode la plus simple. Elle utilise la redirection HTTP automatique vers le site d'origine.

```html
<form action="https://votre-app-domain.com/api/submit/VOTRE-UUID-FORMULAIRE" method="POST">
  <!-- Honeypot de sécurité (invisible) -->
  <input type="text" name="_gotcha" style="display:none !important" tabindex="-1" autocomplete="off" />

  <!-- URL de redirection après soumission (optionnel, fallbacks sur Referer) -->
  <input type="hidden" name="redirect_url" value="https://mon-site-vitrine.com/merci.html" />

  <label>Nom :</label>
  <input type="text" name="nom" required />

  <label>Email :</label>
  <input type="email" name="email" required />

  <label>Message :</label>
  <textarea name="message" required></textarea>

  <button type="submit">Envoyer</button>
</form>
```

### Option B : Soumission AJAX avec Proof-of-Work (Recommandé)
Cette méthode est recommandée pour les formulaires asynchrones. Elle exige la résolution du défi Proof of Work afin de bloquer à 100% les bots de spam.

1. **Étape 1 : Demander un défi PoW** :
   ```js
   const res = await fetch("https://votre-app-domain.com/api/challenge");
   const { challenge, timestamp, difficulty } = await res.json();
   ```
2. **Étape 2 : Résoudre le défi dans le navigateur** :
   ```js
   let nonce = 0;
   let hash = "";
   
   // Fonction de hashage sha-256 standard
   async function sha256(str) {
     const buf = new TextEncoder().encode(str);
     const hashBuf = await crypto.subtle.digest("SHA-256", buf);
     return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
   }

   const prefix = "0".repeat(difficulty); // "0000"
   while (true) {
     hash = await sha256(\`\${challenge}:\${nonce}\`);
     if (hash.startsWith(prefix)) break;
     nonce++;
   }
   ```
3. **Étape 3 : Soumettre les données + le résultat PoW** :
   ```js
   const response = await fetch("https://votre-app-domain.com/api/submit/VOTRE-UUID-FORMULAIRE", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       "x-client-fingerprint": "votre-fingerprint-generateur-optionnel"
     },
     body: JSON.stringify({
       nom: "Jean Dupont",
       email: "jean@example.com",
       message: "Texte",
       
       // Données de PoW obligatoires
       pow_challenge: challenge,
       pow_timestamp: timestamp,
       pow_nonce: nonce.toString()
     })
   });
   ```

---

## 3. Emplacement des Identifiants & Configuration

Les credentials du projet sont centralisés exclusivement dans les variables d'environnement (`.env.local` en local ou dans les paramètres secrets de Vercel/hébergeur). Elles ne doivent **jamais** être écrites en dur dans le code.

| Paramètre | Emplacement | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Endpoint de l'API Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Clé secrète d'administration Supabase (RLS bypass) |
| `ADMIN_PASSWORD_HASH` | `.env.local` | Hash SHA-256 hexadécimal du mot de passe admin unique |
| `JWT_SECRET` | `.env.local` | Clé secrète de signature des tokens d'accès (JWT) |
| `SMTP_HOST` | `.env.local` | Serveur SMTP (ex: `smtp-mail.outlook.com`) |
| `SMTP_PORT` | `.env.local` | Port du serveur SMTP (ex: `587`) |
| `SMTP_SECURE` | `.env.local` | Utilisation de SSL (mettre `false` pour utiliser TLS/STARTTLS sur 587) |
| `SMTP_USER` | `.env.local` | Utilisateur SMTP de l'agence (ex: `devv80@outlook.com`) |
| `SMTP_PASS` | `.env.local` | Mot de passe d'application Outlook |
| `SMTP_FROM` | `.env.local` | En-tête de l'expéditeur (ex: `"mwcrea Forms" <devv80@outlook.com>`) |

---

## 4. Administration du Système

L'administration s'effectue sur `/admin`.
L'accès nécessite la saisie du mot de passe de l'agence (sans identifiant).

### Tâches d'administration courantes
1. **Ajouter un Client destinataire** :
   - Aller sur l'onglet **Clients**.
   - Cliquer sur **Nouveau Client**, renseigner son nom et son email de destination.
2. **Créer un nouveau Formulaire** :
   - Aller sur l'onglet **Formulaires**.
   - Cliquer sur **Nouveau Formulaire**, choisir le client destinataire, puis renseigner la liste des domaines d'origines autorisés (CORS) séparés par une virgule (ex: `https://mon-client.com`). Mettre `*` pour tout autoriser au début.
   - Copier le code HTML d'intégration généré dans les détails du formulaire.
3. **Consulter les Leads** :
   - Tous les messages reçus et stockés sont disponibles sur l'onglet **Leads** (Dashboard) ou en détail dans la fiche du formulaire.
4. **Débannir une IP / Fingerprint** :
   - Si une IP légitime a déclenché le Honeypot par erreur, aller sur l'onglet **Blacklist** et cliquer sur **Retirer** à côté de la cible concernée.
