const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');

// Run after npm run build. These checks protect the shared footer contract.
const root = path.resolve(__dirname, '..', 'public');
for (const locale of ['', 'en', 'de']) {
  for (const route of ['', 'rural-prado']) {
    const file = path.join(root, locale, route, 'index.html');
    test(`footer structure and integrations: /${[locale, route].filter(Boolean).join('/')}`, () => {
      const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
      const footer = $('footer.site-footer');
      const prefix = locale ? `/${locale}` : '';
      assert.equal(footer.length, 1);
      assert.equal(footer.find('.footer-newsletter').length, 1);
      assert.equal(footer.find('.footer-main > section, .footer-main > nav').length, 4);
      assert.equal(footer.find('.footer-explore a').length, 5);
      assert.equal(footer.find('.footer-resources a').length, 2);
      assert.equal(footer.find('.footer-explore a[href="' + prefix + '/"]').length, 0);
      assert.equal(footer.find('.footer-brand .footer-socials a').length, 3);
      assert.equal(footer.find('.footer-legal a').length, 3);
      assert.equal(footer.find('.footer-booking').attr('href'), `${prefix}/reservas/#elegir-alojamiento`);
      assert.ok(footer.find('.footer-booking').is('[data-booking-trigger]'));
      assert.equal(footer.find('a[href^="tel:"]').length, route ? 0 : 1);
      if (!route) assert.equal(footer.find('a[href="mailto:reservas@lardevies.com"]').text(), 'reservas@lardevies.com');
      assert.equal(footer.find('.footer-logo').attr('sizes'), '161px');
      assert.equal(footer.find('form[data-newsletter-form]').length, 1);
      assert.match(footer.find('form').attr('action'), /^https:\/\/a87793f8\.sibforms\.com\/serve\//);
      assert.equal(footer.find('#EMAIL[type="email"][required]').length, 1);
      assert.equal(footer.find('label[for="EMAIL"]:not(.sr-only)').length, 1);
      assert.equal(footer.find('#OPT_IN[required]').length, 1);
      assert.equal(footer.find('#newsletter-email-error[aria-live]').length, 1);
      assert.equal(footer.find('#newsletter-consent-error[aria-live]').length, 1);
      assert.equal(footer.find('#success-message[role="status"]').length, 1);
      assert.equal(footer.find('#error-message[role="alert"]').length, 1);
      assert.equal(footer.find('input[name="locale"]').val(), locale || 'es');
      if (locale) {
        assert.doesNotMatch(footer.text(), /Contacto y reservas|Escapadas con calma y rincones/);
      }
    });
  }
}
