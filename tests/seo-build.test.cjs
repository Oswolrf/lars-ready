"use strict";
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const config = require('../site.config.cjs');
const i18n = require('../i18n.config.cjs');
const output = path.resolve(__dirname, '../public');
const document = (route) => cheerio.load(fs.readFileSync(path.join(output, route.slice(1), 'index.html'), 'utf8'));

test('el paquete de apertura permite indexar el contenido comercial en los tres idiomas', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'build-manifest.json'), 'utf8'));
  assert.equal(manifest.deployEnv, 'production');
  assert.ok(!manifest.maintenance && !manifest.launch);
  const xml = cheerio.load(fs.readFileSync(path.join(output, 'sitemap.xml'), 'utf8'), {xmlMode:true});
  const urls = new Set(xml('url > loc').map((_, e) => xml(e).text()).get());
  const origin = manifest.siteOrigin;
  for (const locale of Object.keys(i18n.locales)) for (const page of config.pages) {
    const route = i18n.localeRoute(page.route, locale);
    const $ = document(route);
    const indexable = page.indexable !== false;
    assert.equal(/noindex/.test($('meta[name="robots"]').attr('content')), !indexable, route);
    assert.equal(urls.has(origin + route), indexable, route);
    assert.equal($('link[rel="canonical"]').attr('href'), origin + route);
    assert.equal($('link[rel="alternate"][hreflang]').length, 4);
  }
  assert.equal(urls.size, 42);
  assert.ok(![...urls].some(url => url.includes('/rural-prado/')));
  assert.ok(![...urls].some(url => url.includes('/zonas-comunes/')));
});

test('los nombres comerciales se conservan y las páginas retiradas no se publican', () => {
  for (const locale of Object.keys(i18n.locales)) {
    // La sección Rural Prado se retiró: el paquete solo conserva el fallback 410 sin su contenido.
    const rural = document(i18n.localeRoute('/rural-prado/', locale));
    assert.equal(rural('meta[name="robots"]').attr('content'), 'noindex,nofollow,noarchive');
    assert.doesNotMatch(rural.html(), /rural[ -]?prado/i);
    assert.ok(config.gone.includes(i18n.localeRoute('/rural-prado/', locale)));
    assert.ok(!config.pages.some(page => page.route === '/rural-prado/'));
    for (const [route, name] of [['/villa-el-camino/', 'El Camino'], ['/villa-camelia/', 'Camelia'], ['/villa-jazmin/', 'Jazmín']]) {
      assert.equal(document(i18n.localeRoute(route, locale))('h1').text().trim(), name);
    }
    const target = i18n.localeRoute('/zonas-comunes/', locale);
    assert.equal(document(i18n.localeRoute('/', locale))(`a[href="${target}"]`).length, 0);
    assert.equal(document(i18n.localeRoute('/la-casona/', locale))(`a[href="${target}"]`).length, 0);
    // Static hosts also receive a noindex redirect fallback, never the old content.
    const retired = document(target);
    assert.equal(retired('meta[name="robots"]').attr('content'), 'noindex,follow');
    assert.equal(retired('h1').length, 0);
    assert.equal(retired('link[rel="canonical"]').attr('href'), config.site.defaultOrigin + i18n.localeRoute('/la-casona/', locale));
    assert.ok(config.redirects.some(item => item.from === target && item.to === i18n.localeRoute('/la-casona/', locale) && item.status === 301));
  }
});

test('el alojamiento conserva capacidades y camas y la portada prioriza su logo', () => {
  for (const [route, capacity] of [['/suite-la-panera/',4], ['/suite-el-valle/',3], ['/suite-el-jardin/',3], ['/villa-el-camino/',5], ['/villa-camelia/',4], ['/villa-jazmin/',4]]) {
    const $ = document(route);
    const nodes = JSON.parse($('script[type="application/ld+json"]').text())['@graph'];
    const stay = nodes.find(n => n['@id']?.endsWith('#accommodation'));
    assert.equal(stay.occupancy.maxValue, capacity, route);
    assert.ok(stay.bed, route);
  }
  assert.equal(document('/')('img.hero-logo').attr('fetchpriority'), 'high');
  assert.ok(document('/villa-el-camino/')('source[type="image/avif"]').length);
});
