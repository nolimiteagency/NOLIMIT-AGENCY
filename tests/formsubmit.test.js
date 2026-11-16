// FormSubmit test: fetch replaced by a stub, no real e-mail sent.
const calls = []; let reply = { success: 'true', message: 'The form was submitted successfully.' };
global.fetch = async (url, o) => { calls.push({ url, o, body: JSON.parse(o.body) }); return { ok: true, status: 200, json: async () => reply }; };
delete process.env.GMAIL_USER; delete process.env.GMAIL_APP_PASSWORD; delete process.env.RESEND_API_KEY; delete process.env.QUOTE_FROM;
process.env.USE_FORMSUBMIT = '1';
const handler = require('../api/devis.js'); let f = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) f++; };
const run = (body, ip) => new Promise(r => { const res = { setHeader() {}, status(c) { this.c = c; return this; }, json(j) { r({ c: this.c, j }); }, end() { r({ c: this.c }); } }; handler({ method: 'POST', body, headers: { 'x-forwarded-for': ip, host: 'site.example' }, socket: {} }, res); });
const good = { type: 'Site vitrine', company: 'TEST', description: '[TEST] Demande de test clairement identifiée.', objectives: 'test 2', features: [], budget: 'À définir', delay: 'Flexible', name: 'Jean Test', email: 'jean@example.com', consent: true, elapsedMs: 9000 };
(async () => { console.log = (l => (...a) => { if (!String(a[0]).startsWith('[devis]')) l(...a); })(console.log); console.error = () => {};
  let r = await run(good, '1.1.1.1');
  ok(r.c === 200 && r.j.ok, 'formsubmit: 200 ok');
  ok(calls[0].url === 'https://formsubmit.co/ajax/nolimite.agency%40gmail.com', 'formsubmit endpoint + recipient');
  ok(calls[0].body._replyto === 'jean@example.com' && calls[0].body.email === 'jean@example.com' && /bien reçu/.test(calls[0].body._autoresponse), 'reply-to + autoresponse');
  ok(calls[0].o.headers.Referer === 'https://site.example/', 'referer = site');
  reply = { success: 'false', message: 'This form needs Activation.' }; r = await run(good, '2.2.2.2');
  ok(r.c === 502 && !r.j.ok, 'not activated → 502, no fake success');
  delete process.env.USE_FORMSUBMIT; r = await run(good, '3.3.3.3'); ok(r.c === 503, 'without USE_FORMSUBMIT → 503');
  console.log(f ? f + ' FAIL' : 'ALL OK'); })();
