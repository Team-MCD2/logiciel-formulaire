# Cahier des charges : Micro-service de Formulaires Interne

## Alternative à Jotform / EmailJS

### Version 2.0 — CORRIGÉE



---



> ### ⚠️ AVIS DE CORRECTION — À LIRE AVANT TOUT

>

> Ce document remplace la version initiale (`CDC_v1_archive.md`) rédigée par le stagiaire.

> La v1 contenait **trois contraintes incorrectes**, désavouées par la direction après coup.

> Ces contraintes ont été **explicitement inversées** dans le présent document :

>

> | # | Contrainte v1 *(incorrecte — à ignorer)* | Directive v2 *(correcte — à appliquer)* |

> |---|---|---|

> | 1 | ❌ Pas d'interface d'administration (UI) | ✅ **Une UI admin est obligatoire** |

> | 2 | ❌ Interdiction d'utiliser des emails personnels | ✅ **Emails personnels autorisés** |

> | 3 | ❌ Interdiction de numéros de téléphone personnels | ✅ **Numéros de téléphone autorisés** |

>

> La version archivée est conservée à titre de référence dans `CDC_v1_archive.md`

> et est exclue du dépôt git via `.gitignore`.

> **Ne pas se fier à l'archive pour l'implémentation.**



---



## 📌 Objectif du projet



Développer un outil interne inspiré de Jotform, permettant de générer des formulaires,

de centraliser la réception des données, et d'en administrer la gestion via un panel dédié.

L'objectif principal est de remplacer l'utilisation de services tiers payants ou limités

(Jotform, EmailJS) sur nos sites vitrines.



---



## 💻 Stack Technique Obligatoire



- **Framework** : Next.js

- **Base de données / Backend** : Supabase



---



## 🛠️ Fonctionnalités attendues



### 1. Architecture Supabase & API



- Supabase stocke la configuration des formulaires (ex : lier un ID de formulaire à

  l'email et/ou au numéro de téléphone du client destinataire).

- Création d'une API Route (Edge Function ou Route Handler Next.js) unique et robuste,

  appelable depuis n'importe lequel de nos sites vitrines.

- L'API reçoit les données du formulaire ainsi que son ID, vérifie la correspondance

  dans Supabase, puis déclenche l'envoi de la notification (email et/ou SMS).



---



### 2. Interface d'Administration (UI) — ✅ OBLIGATOIRE



> **Rappel de correction** : La v1 interdisait toute UI. Cette contrainte est annulée.

> Un panel admin est désormais une fonctionnalité centrale et non optionnelle.



Un **panel d'administration** doit être développé, permettant de :



- **Gérer les formulaires** : création, modification, activation/désactivation, suppression.

- **Gérer les clients destinataires** : ajout/modification de leurs adresses email

  et numéros de téléphone (personnels ou professionnels, les deux sont acceptés).

- **Consulter les leads reçus** : historique des soumissions par formulaire.



L'accès au panel admin doit être protégé par une authentification simple et sécurisée.

Options acceptées : basic auth, magic link, ou accès via Supabase RLS.

Pas de Clerk, pas de gestion de comptes clients complexe.



---



### 3. Bloc-notes de Documentation et d'Accès (`README.md` ou `NOTE.txt`)



- Fichier obligatoire à la racine du projet.

- Doit expliquer clairement le fonctionnement complet du système :

  traitement des données, ajout d'un client, intégration sur un site vitrine.

- Doit **centraliser tous les accès** : identifiants de l'email d'envoi, clés API,

  accès Supabase, et tout service tiers intégré au projet.



---



### 4. Routage et Notification Automatique



- À la réception des données via l'API, le système envoie immédiatement

  un email (et/ou un SMS si configuré) propre contenant les données du lead

  au client destinataire concerné.



---



## ⚠️ Gestion des Comptes et Accès



> **Rappel de correction** : La v1 interdisait formellement l'usage d'emails personnels

> et de numéros de téléphone. Cette interdiction est **levée** par la direction.



L'utilisation d'adresses email et de numéros de téléphone — y compris personnels —

est **autorisée** pour la configuration des services et API, sous deux conditions

**non négociables** :



1. **Aucune credential en dur dans le code source.**

   Toutes les informations sensibles (emails, tokens, clés API, numéros) passent

   obligatoirement par des **variables d'environnement** (`.env.local`, secrets

   Supabase / Vercel / hébergeur).



2. **Toutes les credentials sont centralisées dans le bloc-notes.**

   L'équipe doit pouvoir retrouver l'ensemble des accès en un seul endroit documenté.



Options d'email d'envoi (liste non exhaustive) :



- Adresse de l'agence : `devv80@outlook.com` sur Outlook *(recommandée en premier choix)*.

- Adresse email personnelle si plus adaptée ou si l'adresse agence n'est pas disponible.

- Nouvelle adresse créée pour l'occasion.



---



## ❌ Ce que le projet NE DOIT PAS contenir



- **Pas d'authentification complexe pour les clients finaux** qui soumettent les

  formulaires (pas de Clerk, pas de login/mot de passe pour les visiteurs des

  sites vitrines).

- **Pas de constructeur de formulaire Drag & Drop** : les sites vitrines gèrent

  déjà le design et la définition des champs en front-end.



> **Note** : La contrainte "Pas d'UI" de la v1 est **annulée et remplacée** par

> l'obligation d'une interface d'administration (voir section 2 ci-dessus).



---



## 💡 Résumé du workflow technique



```

[Site Vitrine A]  ──┐

[Site Vitrine B]  ──┼──(POST données + form_id)──► [API Next.js — Micro-Service]

[Site Vitrine C]  ──┘                                          │

                                              ┌────────────────┴─────────────────┐

                                              ▼                                  ▼

                                 [Email / SMS au client]          [UI Admin — Panel de gestion

                                  destinataire concerné            formulaires, clients, leads]

                                              │

                               [Tout documenté dans le Bloc-notes]

```



---



## 🎯 Critères d'évaluation



1. **Qualité du bloc-notes** : guide de fonctionnement complet + tous les accès centralisés.

2. **Qualité et ergonomie de l'UI admin** : clarté, facilité d'ajout de clients et de

   numéros/emails destinataires, gestion des formulaires.

3. **Propreté de l'intégration Next.js + Supabase**.

4. **Zéro credential en dur dans le code** (variables d'environnement obligatoires).

5. **Simplicité d'intégration sur un nouveau site vitrine**.
