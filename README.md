# NO LIMIT — site officiel de l'agence

Site vitrine de l'agence digitale NO LIMIT, avec portfolio interactif (6 démos clients intégrées)
et système de demande de devis en 4 étapes relié à une fonction serveur d'envoi d'e-mails (Resend).

Ce projet fonctionne sans Claude : un dépôt GitHub + un projet Vercel suffisent.

## Architecture

```
nolimit-agency/
├── public/                  servi tel quel par Vercel
│   ├── index.html           le site (HTML/CSS/JS sans framework, 320 Ko)
│   ├── assets/              images et vidéos optimisées (WebP / MP4), chargées à la demande
│   ├── og.png               image de partage réseaux sociaux (1200 × 630)
│   ├── favicon.ico, icon-192.png, icon-512.png, apple-touch-icon.png, site.webmanifest
│   ├── robots.txt, sitemap.xml
├── api/devis.js             fonction serveur : validation, anti-spam, limite de débit, envoi Gmail ou Resend
├── server.js                serveur local sans dépendance (npm start)
├── tests/devis.test.js      tests de la fonction (npm test, Resend simulé, aucun e-mail réel)
├── vercel.json              dossier de sortie, en-têtes de sécurité, cache des assets
├── .env.example             variables à définir (sans secret)
└── package.json
```

**Pourquoi pas React / Vite ?** Le site est une page unique sans état applicatif : du HTML, du CSS et un peu de
JavaScript suffisent, se chargent plus vite et n'ont aucune dépendance à maintenir. React apporterait du poids sans
fonction nouvelle. La seule partie serveur (l'envoi des devis) est une fonction Vercel indépendante.

**Couleurs et typographie** : toutes les valeurs sont centralisées dans les variables CSS `--nl-*` en tête de
`public/index.html` (bleu nuit `#101C2C`, blanc cassé `#F7F8FA`, blanc `#FFFFFF`, gris ardoise `#64748B`,
gris clair `#E8ECF1`, champagne `#C6A875` ; Manrope pour les titres, Inter pour le texte).

## Lancer en local

Node.js 18 ou plus. Aucune installation de paquet nécessaire.

```
npm install     # une seule dépendance : nodemailer
npm test        # tests de la fonction de devis
npm start       # http://localhost:3000
```

Pour tester l'envoi réel en local : copier `.env.example` en `.env.local` et y mettre vos valeurs (ce fichier est ignoré par Git).

---

## Mise en production — étapes à réaliser par vous

Ces étapes créent des comptes ou engagent des frais : elles vous reviennent. Ne communiquez jamais vos mots de passe ou clés API dans une conversation.

### 1. Nom de domaine `nolimit.agency`
Vérifiez sa disponibilité et achetez-le chez un registraire (OVH, Gandi, Namecheap…) ou directement dans Vercel (Domains → Buy).
Le prix d'un `.agency` varie selon le registraire : comparez avant d'acheter.

### 2. GitHub
Le code est sur **github.com/nolimiteagency/NOLIMIT-AGENCY** (branche `main`).
Le dépôt est **public** : n'y ajoutez jamais de clé ni de fichier `.env.local`. Pour le rendre privé :
Settings → General → Danger Zone → Change visibility (Vercel fonctionne aussi avec un dépôt privé).

### 3. Vercel
1. vercel.com → **Add New → Project** → connectez GitHub et importez le dépôt `NOLIMIT-AGENCY`.
2. Framework : **Other**. Ne changez rien d'autre (`vercel.json` définit le dossier `public`).
3. **Settings → Environment Variables** (Production) :

   | Nom | Valeur |
   |---|---|
   | `RESEND_API_KEY` | votre clé Resend (étape 5) |
   | `QUOTE_FROM` | `NO LIMIT <devis@nolimit.agency>` |
   | `QUOTE_TO` | `nolimite.agency@gmail.com` |

4. **Deploy**. Chaque `git push` sur `main` redéploie automatiquement.

### 4. Domaine et DNS (HTTPS automatique)
Vercel → Project → **Settings → Domains** → ajoutez `nolimit.agency` puis `www.nolimit.agency`
(choisissez la redirection de `www` vers `nolimit.agency`).
Chez votre registraire, créez les enregistrements **exactement tels que Vercel les affiche**. En général :

| Type | Nom | Valeur |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Le certificat HTTPS est émis automatiquement par Vercel une fois le DNS propagé (quelques minutes à 48 h).

### 5. Envoi des e-mails

**Option A — Gmail (active, sans domaine)** : les e-mails partent de nolimite.agency@gmail.com.
1. Activez la validation en deux étapes du compte Google : https://myaccount.google.com/signinoptions/twosv
2. Créez un mot de passe d'application : https://myaccount.google.com/apppasswords (nom : « NO LIMIT site »).
3. Dans Vercel → Settings → Environment Variables, ajoutez `GMAIL_APP_PASSWORD` (Sensitive, Production) avec ce mot de passe.
   `GMAIL_USER` et `QUOTE_TO` sont déjà définis. Puis redéployez.
Limite Gmail : environ 500 e-mails par jour, largement suffisant pour des demandes de devis.

**Option B — Resend (avec domaine vérifié)**, prioritaire seulement si `GMAIL_*` est retiré :
1. resend.com → Domains → Add Domain → ajoutez les enregistrements DNS affichés (DKIM, SPF, MX `send`), statut **Verified**.
2. API Keys → Create (Sending access) → `RESEND_API_KEY` dans Vercel, et `QUOTE_FROM` = `NO LIMIT <devis@votre-domaine>`.

### 6. Test de production
1. Sur `https://nolimit.agency`, envoyez une demande dont la description commence par `[TEST]`, avec une adresse e-mail à vous.
2. Vérifiez : l'e-mail « [NOUVELLE DEMANDE DE DEVIS] — NO LIMIT » sur nolimite.agency@gmail.com (et le dossier Spam),
   que « Répondre » écrit au prospect, et l'e-mail « Votre demande a bien été reçue — NO LIMIT » côté client.
3. Vérifiez les journaux : Vercel → Project → **Logs** (lignes `[devis] reçue` / `[devis] envoyée`).
4. Partagez l'adresse dans un message privé Instagram ou LinkedIn pour contrôler l'aperçu (image `og.png`).

### 7. Google
Search Console (search.google.com/search-console) → ajoutez `nolimit.agency` (vérification DNS) → soumettez
`https://nolimit.agency/sitemap.xml`. Aucun classement n'est garanti : l'indexation prend généralement quelques jours.

---

## Fonctionnement du devis

1. Le navigateur valide chaque étape (messages d'erreur sur chaque champ) et bloque le double clic.
2. Envoi en JSON à `/api/devis`.
3. Le serveur refuse les robots (champ piège, formulaire rempli en moins de 3 s), limite à 5 demandes / 10 min par IP,
   revalide tous les champs.
4. E-mail à `QUOTE_TO` avec Reply-To = prospect ; **seulement s'il est accepté**, accusé de réception au client.
5. Le site n'affiche la confirmation que si le serveur répond `ok: true`. Sans configuration, il affiche une erreur :
   aucun envoi n'est jamais simulé.
6. Données : transmises uniquement par e-mail ; les journaux Vercel ne gardent que la référence, la date, le type, le budget
   et le délai (pas de nom ni de message).

## À compléter avant l'exploitation commerciale
- Mentions légales (forme juridique, SIRET, adresse, directeur de la publication) : fenêtre « Mentions légales » dans `public/index.html`.
- Validation de la politique de confidentialité (durée de conservation de 3 ans proposée).
- Numéro WhatsApp professionnel, si vous souhaitez un bouton WhatsApp.
- Liens TikTok / LinkedIn / Facebook officiels, s'ils existent (seul Instagram @nolimite.agency est en place).

## Kit réseaux sociaux
- **Titre de partage** : NO LIMIT — Nous donnons vie à vos ambitions digitales
- **Description** : Sites vitrines, e-commerce, identité visuelle, IA et automatisation. Une agence digitale exigeante, du cahier des charges à la maintenance.
- **Image** : `public/og.png` (1200 × 630). **Icône de profil** : `public/icon-512.png`.
- **Bio courte (Instagram / TikTok)** : Agence digitale · Sites, e-commerce & branding · Devis sur nolimit.agency
- **Présentation (LinkedIn / Facebook)** : NO LIMIT est une agence digitale qui conçoit des sites vitrines, des boutiques e-commerce et des identités visuelles pour les entreprises. Un interlocuteur unique, de la stratégie à la maintenance, et rien n'est mis en ligne sans votre validation. Demandez votre devis sur nolimit.agency.
