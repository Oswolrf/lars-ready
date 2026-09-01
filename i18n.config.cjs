"use strict";

const en = require("./locales/en.json");
const de = require("./locales/de.json");

const locales = {
  es: { code: "es", language: "es-ES", ogLocale: "es_ES", prefix: "", label: "Español", dictionary: {} },
  en: { code: "en", language: "en-GB", ogLocale: "en_GB", prefix: "/en", label: "English", dictionary: en },
  de: { code: "de", language: "de-DE", ogLocale: "de_DE", prefix: "/de", label: "Deutsch", dictionary: de },
};

function localeRoute(route, localeCode) {
  const locale = locales[localeCode];
  if (!locale || localeCode === "es") return route;
  if (route === "/") return `${locale.prefix}/`;
  return `${locale.prefix}${route.startsWith("/") ? route : `/${route}`}`;
}

function translate(localeCode, value) {
  if (localeCode === "es" || value == null) return value;
  return locales[localeCode]?.dictionary?.[value] || value;
}

module.exports = { locales, localeRoute, translate };
