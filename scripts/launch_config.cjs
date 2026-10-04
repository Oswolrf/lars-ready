"use strict";

function apacheTimestamp(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(timestamp);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return ["year", "month", "day", "hour", "minute", "second"].map((key) => values[key]).join("");
}

function resolveLaunchConfig({ site, env = process.env, maintenance, now = Date.now() }) {
  if (!maintenance) return null;
  const value = env.SITE_LAUNCH_AT ?? site.launchAt;
  if (value === null || value === undefined || value === "") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  const timestamp = Date.parse(value);
  const daysInMonth = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate() : 0;
  if (!match || !Number.isFinite(timestamp) || Number(match[2]) < 1 || Number(match[2]) > 12 ||
      Number(match[3]) < 1 || Number(match[3]) > daysInMonth || Number(match[4]) > 23 ||
      Number(match[5]) > 59 || Number(match[6]) > 59 || Number(match[8] || 0) > 23 || Number(match[9] || 0) > 59) {
    throw new Error("SITE_LAUNCH_AT / site.launchAt debe ser una fecha válida ISO 8601 con segundos y zona explícita (Z o ±HH:MM).");
  }
  const scheduled = timestamp > now;
  const serverTimeZone = env.SITE_LAUNCH_SERVER_TIME_ZONE ?? site.launchServerTimeZone;
  let apacheTime = null;
  if (scheduled) {
    if (!serverTimeZone) throw new Error("Confirma la zona horaria de Apache y configura SITE_LAUNCH_SERVER_TIME_ZONE / site.launchServerTimeZone antes de programar el lanzamiento.");
    try { apacheTime = apacheTimestamp(timestamp, serverTimeZone); }
    catch { throw new Error("La zona horaria de lanzamiento del servidor debe ser una zona IANA válida."); }
    // A repeated wall-clock hour cannot safely identify one instant in mod_rewrite.
    for (const minutes of [-120, -90, -60, -30, 30, 60, 90, 120]) {
      if (apacheTimestamp(timestamp + minutes * 60000, serverTimeZone) === apacheTime) {
        throw new Error("La hora elegida se repite por el cambio de horario del servidor; elige una hora fuera de ese intervalo.");
      }
    }
  }
  return { at: new Date(timestamp).toISOString(), timestamp, scheduled, serverTimeZone: serverTimeZone || null, apacheTime };
}

module.exports = { apacheTimestamp, resolveLaunchConfig };
