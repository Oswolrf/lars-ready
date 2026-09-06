const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');

const project = path.resolve(__dirname, '..');
const source = cheerio.load(fs.readFileSync(path.join(project, 'politica-de-cookies.html'), 'utf8'));
const identifiers = [
  'lar-de-vies-cookie-consent-v1',
  'lar-de-vies-chat-session-v3-es',
  'lar-de-vies-chat-session-v3-en',
  'lar-de-vies-chat-session-v3-de',
  '_ga',
  '_ga_<id>',
];

for (const locale of ['es', 'en', 'de']) {
  test(`cookie policy: inventory, Analytics wording and links (${locale})`, () => {
    const prefix = locale === 'es' ? '' : `/${locale}`;
    const file = path.join(project, 'public', prefix, 'politica-cookies', 'index.html');
    const doc = cheerio.load(fs.readFileSync(file, 'utf8'));
    const main = doc('main');
    assert.equal(doc('html').attr('lang'), locale);
    assert.deepEqual(main.find('code').map((_, el) => doc(el).text()).get(), identifiers);
    assert.equal(main.find('#google-analytics').length, 1);
    assert.equal(main.find('#google-analytics h2').text(), 'Google Analytics 4');
    assert.doesNotMatch(main.text(), /incorporación prevista|todavía no está activo|planned integration|not yet active|geplante Einbindung|noch nicht aktiv/);
    assert.equal(main.find('#servicios-externos').length, 1);
    assert.equal(main.find('a[href="' + prefix + '/politica-privacidad/"]').length, 1);
    assert.equal(main.find('a[href="mailto:reservas@lardevies.com"]').text(), 'reservas@lardevies.com');
    for (const host of ['developers.google.com', 'policies.google.com', 'www.brevo.com']) {
      assert.ok(main.find(`a[href^="https://${host}/"]`).length);
    }
    assert.equal(doc('script[src*="googletagmanager"], script[src*="google-analytics"]').length, 0);

    // Every prose node must have a dictionary entry and appear translated in the build.
    if (locale !== 'es') {
      const dictionary = JSON.parse(fs.readFileSync(path.join(project, 'locales', `${locale}.json`), 'utf8'));
      source('main *').contents().each((_, node) => {
        if (node.type !== 'text' || source(node).parent().is('code')) return;
        const text = source(node).text().replace(/\s+/g, ' ').trim();
        if (!text || text === '.' || text === 'Google Maps' || text === 'reservas@lardevies.com') return;
        assert.ok(dictionary[text], `Missing ${locale} translation: ${text}`);
        assert.ok(main.text().includes(dictionary[text]), `Missing translated text: ${text}`);
      });
    }
  });
}
