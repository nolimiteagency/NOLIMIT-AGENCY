// NO LIMIT — fonction serveur de demande de devis (Vercel, runtime Node.js 18+).
// Reçoit le formulaire du site, le valide, envoie l'e-mail à l'agence puis l'accusé de réception au client via Resend.
// La clé API reste côté serveur (variable d'environnement), jamais dans le navigateur.
//
// Variables d'environnement :
//   RESEND_API_KEY   (obligatoire)  clé API Resend
//   QUOTE_FROM       (obligatoire)  expéditeur vérifié, ex. "NO LIMIT <devis@votre-domaine.fr>"
//   QUOTE_TO         (facultatif)   destinataire interne, par défaut nolimite.agency@gmail.com
//   ALLOWED_ORIGIN   (facultatif)   origine autorisée si le site n'est pas servi par le même domaine

const QUOTE_TO_DEFAULT = 'nolimite.agency@gmail.com';
const TYPES = ['Site vitrine', 'Site e-commerce', 'Refonte de site', 'Identité visuelle et branding', 'Application web', 'Développement sur mesure', 'Autre'];
const BUDGETS = ['Moins de 500 €', '500 – 1 000 €', '1 000 – 3 000 €', '3 000 – 5 000 €', 'Plus de 5 000 €', 'À définir'];
const DELAYS = ['Dès que possible', 'Sous un mois', 'Sous trois mois', 'Flexible'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9 .()\-]{6,22}$/;
const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;

// Limite de débit en mémoire : 5 demandes / 10 min par adresse IP et par instance.
// (Une instance serverless peut redémarrer : pour une limite stricte, brancher Upstash Redis ou le pare-feu Vercel.)
const HITS = new Map();
const WINDOW_MS = 10 * 60 * 1000, MAX_HITS = 5;
function rateLimited(ip) {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter(t => now - t < WINDOW_MS);
  arr.push(now); HITS.set(ip, arr);
  if (HITS.size > 5000) for (const [k, v] of HITS) if (!v.some(t => now - t < WINDOW_MS)) HITS.delete(k);
  return arr.length > MAX_HITS;
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oneLine = s => String(s).replace(/[\r\n]+/g, ' ');

function validate(b) {
  const d = {
    type: str(b.type, 60), offer: str(b.offer, 60), company: str(b.company, 100),
    description: str(b.description, 3000), objectives: str(b.objectives, 1500),
    features: Array.isArray(b.features) ? b.features.filter(f => typeof f === 'string').slice(0, 12).map(f => f.trim().slice(0, 60)) : [],
    currentSite: str(b.currentSite, 200), budget: str(b.budget, 40), delay: str(b.delay, 40),
    name: str(b.name, 100), email: str(b.email, 160), phone: str(b.phone, 30), organization: str(b.organization, 100),
    consent: b.consent === true, ref: str(b.ref, 40)
  };
  const errors = [];
  if (!TYPES.includes(d.type)) errors.push('type');
  if (d.company.length < 2) errors.push('company');
  if (d.description.length < 20) errors.push('description');
  if (d.objectives.length < 5) errors.push('objectives');
  if (d.currentSite && !URL_RE.test(d.currentSite)) errors.push('currentSite');
  if (!BUDGETS.includes(d.budget)) errors.push('budget');
  if (!DELAYS.includes(d.delay)) errors.push('delay');
  if (d.name.length < 2) errors.push('name');
  if (!EMAIL_RE.test(d.email)) errors.push('email');
  if (d.phone && !PHONE_RE.test(d.phone)) errors.push('phone');
  if (!d.consent) errors.push('consent');
  if (!/^NL-\d{8}-[A-Z0-9]{4}$/.test(d.ref)) d.ref = makeRef();
  return { d, errors };
}
function makeRef() {
  const t = new Date(), p = n => String(n).padStart(2, '0');
  return `NL-${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}-${Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0')}`;
}

function adminEmail(d, when) {
  const rows = [
    ['Nom', d.name], ['E-mail', d.email], ['Téléphone', d.phone || '—'], ['Entreprise', d.organization || d.company],
    ['Service demandé', d.type + (d.offer ? ` (formule ${d.offer})` : '')], ['Projet', d.company],
    ['Description', d.description], ['Objectifs', d.objectives], ['Fonctionnalités', d.features.join(', ') || '—'],
    ['Site actuel', d.currentSite || '—'], ['Budget', d.budget], ['Délai', d.delay], ['Date', when], ['Référence', d.ref]
  ];
  const text = rows.map(([k, v]) => `${k} : ${v}`).join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#101C2C;max-width:640px">
<h2 style="margin:0 0 16px;font-size:20px">Nouvelle demande de devis</h2>
<table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px">${rows.map(([k, v]) => `<tr><td style="border-bottom:1px solid #E8ECF1;color:#64748B;width:160px;vertical-align:top">${esc(k)}</td><td style="border-bottom:1px solid #E8ECF1;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</table>
<p style="font-size:13px;color:#64748B;margin-top:16px">Répondre à cet e-mail écrit directement au prospect.</p></div>`;
  return { text, html };
}
function ackEmail(d) {
  const first = d.name.split(/\s+/)[0];
  const text = `Bonjour ${first},\n\nNous avons bien reçu votre demande de devis.\n\nNotre équipe va étudier votre projet et reviendra vers vous dans les meilleurs délais.\n\nMerci pour votre intérêt et votre confiance.\n\nL'équipe NO LIMIT.`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#101C2C;font-size:15px;line-height:1.6;max-width:560px">${text.split('\n\n').map(p => `<p>${esc(p)}</p>`).join('')}<p style="font-size:12px;color:#64748B">Référence de votre demande : ${esc(d.ref)}</p></div>`;
  return { text, html };
}

async function resend(apiKey, msg) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg)
  });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { ok: r.ok && !!j.id, status: r.status, id: j.id, error: j.message || j.name };
}

module.exports = async function handler(req, res) {
  const origin = process.env.ALLOWED_ORIGIN;
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Méthode non autorisée.' });

  const apiKey = process.env.RESEND_API_KEY, from = process.env.QUOTE_FROM, to = process.env.QUOTE_TO || QUOTE_TO_DEFAULT;
  if (!apiKey || !from) { console.error('[devis] configuration manquante : RESEND_API_KEY ou QUOTE_FROM'); return res.status(503).json({ ok: false, error: "Le service d'envoi n'est pas encore configuré. Écrivez-nous à nolimite.agency@gmail.com." }); }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, error: 'Requête invalide.' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || 'inconnue';
  if (rateLimited(ip)) return res.status(429).json({ ok: false, error: 'Trop de demandes envoyées en peu de temps. Réessayez dans quelques minutes.' });

  // anti-robot : champ piège rempli, ou formulaire rempli en moins de 3 secondes
  if (body.website || (typeof body.elapsedMs === 'number' && body.elapsedMs > 0 && body.elapsedMs < 3000)) {
    console.warn('[devis] envoi bloqué (anti-robot)', { ip });
    return res.status(400).json({ ok: false, error: "L'envoi n'a pas pu aboutir. Écrivez-nous à nolimite.agency@gmail.com." });
  }

  const { d, errors } = validate(body);
  if (errors.length) return res.status(422).json({ ok: false, error: 'Certaines informations sont manquantes ou invalides.', fields: errors });

  const when = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short' });
  // trace de la demande (journaux Vercel) — sans le contenu du message
  console.log('[devis] reçue', JSON.stringify({ ref: d.ref, at: new Date().toISOString(), type: d.type, budget: d.budget, delay: d.delay, emailDomain: d.email.split('@')[1] }));

  const a = adminEmail(d, when);
  const sent = await resend(apiKey, { from, to: [to], reply_to: d.email, subject: '[NOUVELLE DEMANDE DE DEVIS] — NO LIMIT', text: a.text, html: a.html });
  if (!sent.ok) {
    console.error('[devis] échec envoi agence', { ref: d.ref, status: sent.status, error: sent.error });
    return res.status(502).json({ ok: false, error: "Votre demande n'a pas pu être envoyée pour le moment. Réessayez dans quelques minutes ou écrivez-nous à nolimite.agency@gmail.com." });
  }
  const k = ackEmail(d);
  const ack = await resend(apiKey, { from, to: [d.email], reply_to: to, subject: 'Votre demande a bien été reçue — NO LIMIT', text: k.text, html: k.html });
  if (!ack.ok) console.error('[devis] échec accusé de réception', { ref: d.ref, status: ack.status, error: ack.error });
  console.log('[devis] envoyée', JSON.stringify({ ref: d.ref, adminId: sent.id, ackId: ack.id || null }));
  return res.status(200).json({ ok: true, ref: d.ref, ackSent: ack.ok });
};
module.exports._test = { validate, adminEmail, ackEmail, HITS };
