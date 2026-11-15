// Unit test of deploy/api/devis.js with a mocked Resend API (no real e-mail is sent).
const path = require('path');
const handler = require(path.join(__dirname,'..','api','devis.js'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) fails++; };
const calls = []; let mode = 'ok';
global.fetch = async (url, opt) => { const body = JSON.parse(opt.body); calls.push({ url, auth: opt.headers.Authorization, body });
  if (mode === 'fail') return { ok: false, status: 403, json: async () => ({ name: 'validation_error', message: 'domain not verified' }) };
  if (mode === 'ackfail' && calls.length % 2 === 0) return { ok: false, status: 422, json: async () => ({ message: 'bad' }) };
  return { ok: true, status: 200, json: async () => ({ id: 'em_' + calls.length }) }; };
function run(body, { method = 'POST', ip = '1.1.1.1' } = {}) {
  return new Promise(resolve => { const res = { code: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(j) { resolve({ code: this.code, j }); }, end() { resolve({ code: this.code }); } };
    handler({ method, body, headers: { 'x-forwarded-for': ip }, socket: {} }, res); });
}
const good = { type: 'Site vitrine', company: 'TEST NO LIMIT', description: '[TEST] Demande de test clairement identifiée.', objectives: '[TEST] test', features: ['Formulaire de contact'], currentSite: '', budget: 'À définir', delay: 'Flexible', name: 'Jean Test', email: 'jean.test@example.com', phone: '06 12 34 56 78', organization: '', consent: true, ref: 'NL-20261116-AB12', elapsedMs: 45000, website: '' };
(async () => {
  console.error = () => {}; console.warn = () => {}; const log = console.log; console.log = (...a) => { if (!String(a[0]).startsWith('[devis]')) log(...a); };
  delete process.env.RESEND_API_KEY;
  let r = await run(good); ok(r.code === 503 && !r.j.ok, 'not configured → 503, never fake success');
  process.env.RESEND_API_KEY = 're_test_xxx'; process.env.QUOTE_FROM = 'NO LIMIT <devis@exemple.fr>';
  r = await run(good, { method: 'GET' }); ok(r.code === 405, 'GET refused');
  r = await run({ ...good, website: 'x' }, { ip: '2.2.2.2' }); ok(r.code === 400 && calls.length === 0, 'honeypot blocks, no e-mail');
  r = await run({ ...good, elapsedMs: 900 }, { ip: '2.2.2.3' }); ok(r.code === 400 && calls.length === 0, 'too-fast submission blocked');
  r = await run({ ...good, email: 'nope', budget: '1 €', consent: false }, { ip: '3.3.3.3' }); ok(r.code === 422 && r.j.fields.includes('email') && r.j.fields.includes('budget') && r.j.fields.includes('consent'), 'server validation');
  r = await run(good, { ip: '4.4.4.4' });
  ok(r.code === 200 && r.j.ok && r.j.ackSent && r.j.ref === 'NL-20261116-AB12', 'valid → 200 ok + ack');
  const [adm, ack] = calls;
  ok(adm.url === 'https://api.resend.com/emails' && adm.auth === 'Bearer re_test_xxx', 'Resend endpoint + server-side key');
  ok(adm.body.subject === '[NOUVELLE DEMANDE DE DEVIS] — NO LIMIT' && adm.body.to[0] === 'nolimite.agency@gmail.com' && adm.body.reply_to === 'jean.test@example.com', 'admin subject / to / reply-to');
  ok(['Nom : Jean Test', 'E-mail : jean.test@example.com', 'Téléphone : 06 12 34 56 78', 'Service demandé : Site vitrine', 'Budget : À définir', 'Délai : Flexible', 'Date : '].every(s => adm.body.text.includes(s)), 'admin body fields');
  ok(ack.body.subject === 'Votre demande a bien été reçue — NO LIMIT' && ack.body.to[0] === 'jean.test@example.com', 'ack subject / to');
  ok(ack.body.text.startsWith('Bonjour Jean,\n\nNous avons bien reçu votre demande de devis.') && ack.body.text.endsWith("L'équipe NO LIMIT."), 'ack body text');
  ok(!adm.body.html.includes('<script') , 'html escaped');
  r = await run({ ...good, description: '<script>alert(1)</script> projet de test assez long' }, { ip: '5.5.5.5' }); ok(calls[2].body.html.includes('&lt;script&gt;'), 'user input escaped in e-mail HTML');
  mode = 'fail'; calls.length = 0; r = await run(good, { ip: '6.6.6.6' }); ok(r.code === 502 && !r.j.ok, 'Resend refuses → 502, no success');
  mode = 'ackfail'; calls.length = 0; r = await run(good, { ip: '7.7.7.7' }); ok(r.code === 200 && r.j.ok && r.j.ackSent === false, 'admin ok + ack fail → ok, ackSent false');
  mode = 'ok'; let last; for (let i = 0; i < 6; i++) last = await run(good, { ip: '8.8.8.8' }); ok(last.code === 429, 'rate limit after 5 / 10 min');
  console.log(fails ? fails + ' FAIL' : 'ALL OK');
})();
