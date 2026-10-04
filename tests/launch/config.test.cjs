"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { resolveLaunchConfig, apacheTimestamp } = require("../../scripts/launch_config.cjs");

const site = { maintenance: true, launchAt: null, launchServerTimeZone: null };
const resolve = (overrides = {}) => resolveLaunchConfig({ site, env: {}, maintenance: true, now: Date.parse("2026-01-01T00:00:00Z"), ...overrides });

test("sin fecha se conserva la portada; desactivar mantenimiento permite la apertura manual", () => {
  assert.equal(resolve(), null);
  assert.equal(resolve({ env: { SITE_LAUNCH_AT: "" } }), null);
  assert.equal(resolve({ maintenance: false, env: { SITE_LAUNCH_AT: "invalid" } }), null);
});

test("fecha española inequívoca, prioridad de variables y conversión a hora de Apache", () => {
  const result = resolve({ env: { SITE_LAUNCH_AT: "2026-07-15T10:00:00+02:00", SITE_LAUNCH_SERVER_TIME_ZONE: "UTC" } });
  assert.equal(result.at, "2026-07-15T08:00:00.000Z");
  assert.equal(result.apacheTime, "20260715080000");
  assert.equal(result.scheduled, true);
  assert.equal(apacheTimestamp(Date.parse("2026-12-15T08:00:00Z"), "Europe/Madrid"), "20261215090000");
  assert.equal(apacheTimestamp(Date.parse("2026-07-15T08:00:00Z"), "Europe/Madrid"), "20260715100000");
});

test("fechas inexistentes o sin zona y zona de servidor sin verificar detienen el build", () => {
  for (const value of ["mañana", "2026-07-15T10:00:00", "2026-02-30T10:00:00Z", "2026-02-29T10:00:00Z", "2026-07-15T24:00:00Z"]) {
    assert.throws(() => resolve({ env: { SITE_LAUNCH_AT: value } }), /ISO 8601/);
  }
  assert.throws(() => resolve({ env: { SITE_LAUNCH_AT: "2026-07-15T10:00:00Z" } }), /zona horaria de Apache/);
  assert.throws(() => resolve({ env: { SITE_LAUNCH_AT: "2026-07-15T10:00:00Z", SITE_LAUNCH_SERVER_TIME_ZONE: "invalid" } }), /IANA/);
});

test("el cambio de hora no puede abrir la web durante la primera repetición del reloj", () => {
  for (const value of ["2026-10-25T02:30:00+02:00", "2026-10-25T02:30:00+01:00"]) {
    assert.throws(() => resolve({ env: { SITE_LAUNCH_AT: value, SITE_LAUNCH_SERVER_TIME_ZONE: "Europe/Madrid" } }), /se repite/);
  }
});

test("si la fecha ya ha pasado, se compila la web completa sin gate ni zona de servidor", () => {
  const result = resolve({ env: { SITE_LAUNCH_AT: "2025-12-31T23:59:59Z" } });
  assert.equal(result.scheduled, false);
  assert.equal(result.apacheTime, null);
});
