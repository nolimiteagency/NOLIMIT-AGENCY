// Gmail transport test: nodemailer replaced by a stub, no real e-mail sent.
const Module = require('module'); const sent = []; let fail = false;
const orig = Module._load; Module._load = function (req, ...a) { if (req === 'nodemailer') return { createTransport: cfg => { sent.cfg = cfg; return { sendMail: async m => { if (fail) throw Object.assign(new Error('auth'), { code: 'EAUTH' }); sent.push(m); return { accepted: [m.to], messageId: 'm' + sent.length }; } }; } }; return orig.call(this, req, ...a); };
process.env.GMAIL_USER = 'nolimite.agency@gmail.com'; process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop'; delete process.env.RESEND_API_KEY;
const handler = require('../api/devis.js'); let f = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) f++; };
const run = (body, ip) => new Promise(r => { const res = { setHeader() {}, status(c) { this.c = c; return this; }, json(j) { r({ c: this.c, j }); }, end() { r({ c: this.c }); } }; handler({ method: 'POST', body, headers: { 'x-forwarded-for': ip }, socket: {} }, res); });
const good = { type: 'Site vitrine', company: 'TEST', description: '[TEST] Demande de test clairement identifiée.', objectives: 'test 2', features: [], budget: 'À définir', delay: 'Flexible', name: 'Jean Test', email: 'jean@example.com', consent: true, elapsedMs: 9000 };
(async () => { console.log = (l => (...a) => { if (!String(a[0]).startsWith('[devis]')) l(...a); })(console.log); console.error = () => {};
  let r = await run(good, '1.1.1.1');
  ok(r.c === 200 && r.j.ackSent, 'gmail: 200 + ack');
  ok(sent.cfg.host === 'smtp.gmail.com' && sent.cfg.auth.pass === 'abcdefghijklmnop', 'smtp.gmail.com, spaces removed from app password');
  ok(sent[0].from === 'NO LIMIT <nolimite.agency@gmail.com>' && sent[0].to[0] === 'nolimite.agency@gmail.com' && sent[0].replyTo === 'jean@example.com' && sent[0].subject === '[NOUVELLE DEMANDE DE DEVIS] — NO LIMIT', 'admin mail via gmail');
  ok(sent[1].to[0] === 'jean@example.com' && sent[1].subject === 'Votre demande a bien été reçue — NO LIMIT', 'ack via gmail');
  fail = true; r = await run(good, '2.2.2.2'); ok(r.c === 502 && !r.j.ok, 'gmail auth error → 502, no success');
  console.log(f ? f + ' FAIL' : 'ALL OK'); })();
