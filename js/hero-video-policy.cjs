"use strict";

const BLOCKED_CONNECTIONS = new Set(["slow-2g", "2g", "3g"]);

function connectionIsConstrained(connection) {
  if (!connection) return false;
  const effectiveType = String(connection.effectiveType || "").toLowerCase();
  return connection.saveData === true || BLOCKED_CONNECTIONS.has(effectiveType);
}

function playbackIsBlocked({ reducedMotion = false, connection = null } = {}) {
  return reducedMotion === true || connectionIsConstrained(connection);
}

module.exports = { BLOCKED_CONNECTIONS, connectionIsConstrained, playbackIsBlocked };
