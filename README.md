# Microservice de Formulaires Centralisé (mwcrea Forms)

Une alternative open-source et auto-hébergée à Jotform, Formspree et EmailJS. 
Ce microservice vous permet de centraliser les soumissions de formulaires de tous vos sites web marketing (villas, agences, vitrines clients) dans un tableau de bord unique, en envoyant des notifications par email aux clients et des accusés de réception automatiques aux expéditeurs.

---

## ⚡ Résumé de la Migration V3 & Démarrage Rapide
Ce système est désormais en **V3**, intégrant un moteur avancé de logs en direct (Live Failure Logs), un filtre anti-spam par mots-clés, des redirections sécurisées en base de données, l'exportation CSV des leads, et des variables dynamiques (`{{name}}`) dans les auto-répondeurs.

**Étapes de Configuration Rapide :**
1. **[Configuration de la Base de Données](#1-configuration-de-la-base-de-données-supabase)** : Exécutez `schema.sql`, `migration_auto_reply.sql`, `migration_v2_branding.sql` et **`migration_v3.sql`**. Créez un bucket public nommé `uploads` dans Storage.
2. **[Configuration SMTP](#-guide-de-configuration-du-fournisseur-smtp-resend-vs-brevo)** : Configurez Brevo/Resend. (Désactivez le blocage d'IP dans Brevo pour éviter l'erreur `525 5.7.1`).
3. **[Variables d'Environnement](#2-configuration-des-variables-denvironnement)** : Configurez `.env.local` avec les identifiants Supabase, JWT et SMTP.
4. **[Intégration Frontend & Gestion des Erreurs](#-guide-dintégration-frontend)** : Connectez-vous via HTML ou AJAX. L'API retourne désormais des objets d'erreur JSON détaillés avec des instructions `remedy` pour un débogage facile.

---

## 🚀 Fonctionnalités Principales

*   **Panneau d'Administration Centralisé (`/admin`)** : Créez des formulaires, liez-les à des clients spécifiques, consultez les soumissions, et exportez facilement vos leads grâce au bouton **Exporter en CSV**.
*   **Logs d'Échecs en Direct (Live Logs)** : Interface dédiée avec "Mode Live" par polling pour surveiller en temps réel les rejets de spam et les pannes SMTP.
*   **Emails Dynamiques en Marque Blanche** : Les emails s'adaptent nativement à la marque du client assigné (Logos, Couleurs, Polices).
*   **Accusé de Réception Dynamique** : Envoie des confirmations stylisées (en `fr` ou `en`). Utilisez `{{name}}` ou `{{nom}}` dans votre message personnalisé pour que le système injecte automatiquement le prénom de l'expéditeur !
*   **Gestion Intelligente des Pièces Jointes** : Uploade les fichiers Base64 massifs directement sur Supabase Storage et injecte des liens de téléchargement propres dans les emails.
*   **Sécurité Next-Gen & Anti-Spam (V3)** :
    *   **Filtre Anti-Spam NLP** : Bloque automatiquement et silencieusement les soumissions contenant des mots-clés de spam (ex: "crypto", "seo", "casino") et les journalise dans le panel Live Logs.
    *   **Redirection Sécurisée en Base de Données** : Force l'URL de succès (`success_url`) depuis le backend, empêchant toute manipulation malveillante via le frontend.
    *   **Validation CORS Dynamique** : Les formulaires n'acceptent que les soumissions provenant des domaines autorisés.
    *   **Preuve de Travail (PoW) & Pot de Miel (`_gotcha`)** : Défis cryptographiques CPU et pièges cachés pour bannir instantanément les bots (IP/Empreinte).
    *   **Blocage VPN par Reverse DNS** : Recherches inversées automatiques pour blacklister l'hébergement cloud.
*   **Rotation Automatique de Secours SMTP** : Bascule sur des mots de passe de secours si les identifiants principaux échouent, garantissant l'envoi du lead.

---

## 🛠️ Stack Technique

*   **Frontend & Tableau de bord Admin** : Next.js (App Router), Tailwind CSS.
*   **Backend & DB** : Supabase (PostgreSQL), NextJS Route Handlers (Compatible Edge & Node).
*   **Moteur d'Emails** : Nodemailer (SMTP) avec rotation automatique des identifiants et `@react-email`.

---

## 📁 Structure du Projet

```text
├── app/
│   ├── admin/             # Panneau d'administration sécurisé (Dashboard, Formulaires, Clients, Soumissions)
│   ├── api/
│   │   ├── auth/          # Gestionnaires d'authentification basés sur JWT
│   │   ├── challenge/     # Générateur de défi cryptographique Proof-of-Work
│   │   └── submit/[id]/   # Endpoint de soumission dynamique (prend en charge JSON et HTML urlencoded)
│   ├── login/             # Page de connexion au portail admin
│   └── page.tsx           # Redirection vers le panneau d'administration
├── components/            # Composants UI (barre latérale, modales, tableaux, métriques)
├── emails/                # Modèles d'emails React Email (AutoReply, LeadNotification)
├── lib/
│   ├── actions.ts         # Actions Serveur Next.js (gérant toutes les transactions DB)
│   ├── blacklist.ts       # Contrôles de bannissement et liste noire
│   ├── dnsLookup.ts       # Blocage VPN par recherche inversée DNS
│   ├── email.ts           # Moteur d'email avec rotation de secours SMTP
│   ├── jwt.ts             # Signature et vérification JWT HMAC-SHA256
│   ├── pow.ts             # Vérificateur cryptographique Proof-of-Work
│   └── supabase.ts        # Client Supabase (Service role)
├── proxy.ts               # Gardien Middleware (Blacklist User-Agent & obfuscation du chemin admin)
├── schema.sql             # Tables principales de la base de données
├── migration_auto_reply.sql # Migration DB pour l'auto-réponse
├── migration_v2_branding.sql # Migration DB pour les logos et couleurs clients
└── migration_v3.sql       # Migration DB (Filtre Spam, Redirections, Live Logs)
```

---

## ⚡ Guide de Configuration du Fournisseur SMTP (Resend vs Brevo)

Outlook, Gmail et les comptes Microsoft 365 personnels bloquent par défaut l'authentification SMTP de base (SMTP AUTH) pour éviter le spam. **Les mots de passe d'application NE FONCTIONNERONT PAS pour Microsoft 365** car l'authentification SMTP est désactivée au niveau de la boîte mail (`535 5.7.1 Authentication unsuccessful`).

Vous **devez** passer par un fournisseur d'emails transactionnels dédié.

Puisque tous les sites web clients soumettent des formulaires à cette **API Next.js centralisée**, vous ne configurez le SMTP qu'une **seule fois** dans le fichier `.env.local` de ce projet. Les sites web clients n'ont besoin d'aucun identifiant SMTP. 

**⚠️ AVERTISSEMENT CRITIQUE :** Vous ne pouvez pas utiliser un domaine `.vercel.app` comme email `SMTP_FROM` (ex: `no-reply@my-app.vercel.app`). Les fournisseurs d'emails le rejetteront car vous ne pouvez pas vérifier les enregistrements DNS (SPF/DKIM) pour les sous-domaines Vercel. Vous DEVEZ utiliser un domaine personnalisé que vous possédez (ex: `contact@votre-agence.com`).

### Option A : Brevo (Meilleur pour le plan gratuit - 300 emails/jour)
Brevo est gratuit pour **300 emails/jour**. Un seul compte Brevo gère les emails pour tous vos formulaires à travers tous les sites clients.

**🚨 CORRECTION CRITIQUE POUR L'ERREUR `525 5.7.1 Unauthorized IP address` :**
Brevo bloque par défaut les API/SMTP provenant d'adresses IP inconnues. Vercel utilisant des **adresses IP dynamiques**, vos emails échoueront aléatoirement.
**Pour corriger cela :**
1. Connectez-vous à Brevo, cliquez sur votre profil (en haut à droite) > **Paramètres** > **Sécurité**.
2. Allez dans l'onglet **IP Autorisées**.
3. **DÉSACTIVEZ** le "Blocage des adresses IP inconnues".

#### Configuration `.env.local` Brevo :
```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre_email_de_connexion_brevo@example.com
SMTP_PASS=xsmtpsib-votre_cle_smtp_brevo_ici
SMTP_FROM="Votre Agence <votre_email_verifie@example.com>"
```

### Option B : Resend (Meilleure Expérience Développeur - 3 000 emails/mois)
Resend est gratuit pour **100 emails/jour** (3 000/mois). Il nécessite un domaine personnalisé vérifié via DNS.

#### Configuration `.env.local` Resend :
```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=re_votre_cle_api_ici
SMTP_FROM="Votre Agence <contact@votre-domaine.com>"
```

---

## 💻 Configuration pour le Développement Local

### 1. Configuration de la Base de Données (Supabase)
Créez un nouveau projet sur [Supabase](https://supabase.com) et exécutez les définitions SQL dans l'Éditeur SQL :
1.  Exécutez `schema.sql` pour initialiser les tables.
2.  Exécutez `migration_auto_reply.sql`, `migration_v2_branding.sql` et **`migration_v3.sql`**.
3.  **Configuration du Stockage (Storage) :** Allez dans Storage et créez un nouveau bucket nommé exactement `uploads`. Assurez-vous de le configurer en **Public**. Ceci est requis pour la gestion des pièces jointes Base64.

### 2. Configuration des Variables d'Environnement
Dupliquez `.env.local.template` en tant que `.env.local` et remplissez les valeurs :
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre-cle-service-role-supabase

# Administration (Générez un hash SHA-256 de votre mot de passe admin)
ADMIN_PASSWORD_HASH=votre-hash-hex-sha256
JWT_SECRET=une-longue-chaine-aleatoire-securisee

# Config SMTP
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=re_votre_cle
SMTP_FROM="Agence <no-reply@votredomaine.com>"
```

### 3. Installation & Lancement
```bash
npm install
npm run dev
```
Ouvrez `http://localhost:3000` pour accéder au panneau d'administration. 

---

## 🔌 Guide d'Intégration Frontend

Pour soumettre des données à un formulaire, récupérez son ID (UUID) depuis le panneau d'administration.

### Option A : Formulaire HTML Standard (Sans JS / Secours)
```html
<form action="http://localhost:3000/api/submit/VOTRE-UUID-DU-FORMULAIRE" method="POST">
  <!-- Piège anti-spam Honeypot (Caché aux utilisateurs) -->
  <input type="text" name="_gotcha" style="display:none !important" tabindex="-1" autocomplete="off" />

  <!-- Champ langue (fr/en) -->
  <input type="hidden" name="_lang" value="fr" />

  <input type="text" name="nom" required placeholder="Nom complet" />
  <input type="email" name="email" required placeholder="Email" />
  <textarea name="message" required placeholder="Message"></textarea>

  <button type="submit">Envoyer</button>
</form>
```

### Option B : Requête POST AJAX avec Preuve de Travail (Recommandé)
Requis pour contourner les spambots sur les sites à fort trafic.

1.  **Demander un Défi Cryptographique** :
    ```js
    const res = await fetch("https://votre-api.com/api/challenge");
    const { challenge, timestamp, difficulty } = await res.json();
    ```
2.  **Résoudre le Défi** (en tâche de fond CPU) :
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
3.  **POSTER la charge utile (Payload)** :
    ```js
    const response = await fetch("https://votre-api.com/api/submit/VOTRE-UUID", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: "Jean Dupont",
        email: "jean@example.com",
        _lang: "fr",
        pow_challenge: challenge,
        pow_timestamp: timestamp,
        pow_nonce: nonce.toString()
      })
    });
    ```

---

## 🛡️ Opérations & Résolution des problèmes

*   **Pourquoi l'expéditeur ne reçoit-il pas d'accusé de réception ?**
    *   Assurez-vous que l'auto-réponse est activée dans la configuration du formulaire.
    *   Les accusés de réception sont limités à **3 emails par 10 minutes** par adresse email pour éviter le flooding.
*   **Où sont enregistrées les requêtes bloquées ?**
    *   Si une requête échoue au test du Honeypot ou aux limites de taux (Rate Limits), l'IP/Empreinte source est ajoutée à la table `blacklist` de votre base de données. Vous pouvez supprimer manuellement les lignes bloquées via `/admin/blacklist`.

---

## 🏗️ Guide de Test et Décisions Architecturales V3

Ce projet a été mis à niveau pour fonctionner à un niveau de développeur senior, en se concentrant sur **une gestion des erreurs de classe mondiale**, **une image de marque multi-locataire dynamique (Multi-Tenant)** et **une expérience utilisateur (UI/UX) soignée**.

### Ce qui a été fait & Pourquoi ?

1. **Gestion des Erreurs API de niveau Senior :**
   - **Quoi :** Le système `createErrorResponse` a été entièrement remanié. Chaque réponse d'erreur inclut désormais une instruction JSON `remedy` détaillée expliquant exactement comment corriger l'erreur. 
   - **Pourquoi :** Les développeurs frontend intégrant cette API n'ont pas accès aux logs du serveur. S'ils configurent mal CORS ou oublient le Proof-of-Work, ils ont besoin d'un retour immédiat (comme l'API Stripe), plutôt que d'erreurs génériques "Bad Request".

2. **React Email & Branding Dynamique (Via l'UI) :**
   - **Quoi :** Remplacement des templates d'emails textuels de base par `@react-email/components`. Vous pouvez désormais configurer la Direction Artistique d'un client (Couleurs, Logos, Polices) directement dans l'interface **Tableau de bord Admin > Clients**.
   - **Pourquoi :** Pour rendre le microservice véritablement multi-locataire. Une soumission pour "ImmoPro" sera visuellement différente d'un autre client, respectant nativement la charte graphique de chaque marque.

3. **Stockage Intelligent des Pièces Jointes (Base64 vers Supabase) :**
   - **Quoi :** Lorsque les utilisateurs envoient des photos sur les sites clients, les données sont de massives chaînes Base64. L'API décode désormais automatiquement ces images, génère des noms de fichiers contextuels (ex : `171234-king-ford.jpg`), les uploade dans le bucket Supabase `uploads`, et injecte un lien de téléchargement propre dans l'email.
   - **Pourquoi :** Les blocs Base64 massifs déclenchent les filtres anti-spam et sont impossibles à télécharger pour les destinataires. Cela garantit une délivrabilité email parfaite et une interface propre.

4. **Refonte du Tableau de Bord avec Magic UI :**
   - **Quoi :** Intégration de `framer-motion` et des composants Magic UI (`BlurFade`, `ShimmerButton`, `BorderBeam`, `NumberTicker`) directement dans le panneau d'administration.
   - **Pourquoi :** Pour élever l'interface vers un design moderne et premium, sans compromettre le thème minimaliste (Slate/Bleu Foncé).

### Comment Tester les Nouvelles Fonctionnalités V3

1. **Tester le Filtre Anti-Spam NLP & Les Live Logs :**
   - Ouvrez la nouvelle page `Logs & Échecs` dans le tableau de bord Admin et activez le **"Mode Live"**.
   - Soumettez un formulaire via votre frontend en incluant le mot "crypto" ou "seo" dans le message.
   - *Résultat Attendu :* L'API simulera un succès pour le spammeur, mais la tentative sera interceptée et apparaîtra instantanément dans vos Live Logs, sans jamais polluer votre boîte mail.

2. **Tester les Variables Dynamiques de l'Auto-Répondeur :**
   - Allez dans la configuration d'un formulaire, modifiez le "Message (Texte brut)" de l'auto-réponse pour inclure : `Bonjour {{name}}, bien reçu !`
   - Soumettez le formulaire avec "Jean" dans le champ `Nom`.
   - *Résultat Attendu :* L'expéditeur recevra un email disant "Bonjour Jean, bien reçu !".

3. **Tester l'Exportation CSV :**
   - Allez dans la section `Leads` (Soumissions) d'un formulaire et cliquez sur **Exporter en CSV**.
   - *Résultat Attendu :* Un fichier `.csv` téléchargé où toutes les propriétés JSON dynamiques ont été intelligemment aplanies en colonnes séparées (Nom, Email, Marque, Modèle, etc.).
