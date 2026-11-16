// FormSubmit relay test: the function validates and returns the fields; it never calls FormSubmit itself.
let called = 0; global.fetch = async () => { called++; return { ok: true, json: async () => ({}) }; };
delete process.env.GMAIL_USER; delete process.env.GMAIL_APP_PASSWORD; delete process.env.RESEND_API_KEY; delete process.env.QUOTE_FROM;
process.env.USE_FORMSUBMIT = '1';
const handler = require('../api/devis.js'); let f = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) f++; };
const run = (body, ip) => new Promise(r => { const res = { setHeader() {}, status(c) { this.c = c; return this; }, json(j) { r({ c: this.c, j }); }, end() { r({ c: this.c }); } }; handler({ method: 'POST', body, headers: { 'x-forwarded-for': ip }, socket: {} }, res); });
const good = { type: 'Site vitrine', company: 'TEST', description: '[TEST] Demande de test clairement identifiée.', objectives: 'test 2', features: [], budget: 'À définir', delay: 'Flexible', name: 'Jean Test', email: 'jean@example.com', consent: true, elapsedMs: 9000 };
(async () => { console.log = (l => (...a) => { if (!String(a[0]).startsWith('[devis]')) l(...a); })(console.log); console.error = () => {}; console.warn = () => {};
  let r = await run(good, '1.1.1.1');
  ok(r.c === 200 && r.j.ok === false && r.j.relay, 'valid → relay, never ok:true by itself');
  ok(r.j.relay.url === 'https://formsubmit.co/ajax/nolimite.agency%40gmail.com', 'relay url + recipient');
  ok(r.j.relay.fields._replyto === 'jean@example.com' && r.j.relay.fields.email === 'jean@example.com' && /bien reçu/.test(r.j.relay.fields._autoresponse), 'reply-to + autoresponse');
  ok(called === 0, 'server never calls FormSubmit');
  r = await run({ ...good, email: 'bad' }, '2.2.2.2'); ok(r.c === 422 && !r.j.relay, 'invalid → 422, no relay');
  r = await run({ ...good, website: 'x' }, '3.3.3.3'); ok(r.c === 400 && !r.j.relay, 'honeypot → 400, no relay');
  delete process.env.USE_FORMSUBMIT; r = await run(good, '4.4.4.4'); ok(r.c === 503, 'without USE_FORMSUBMIT → 503');
  console.log(f ? f + ' FAIL' : 'ALL OK'); })();
