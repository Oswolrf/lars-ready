"use strict";

function chatDeployConfig(value = "", basePath = "/") {
  const endpoint = String(value).trim();
  if (!endpoint) return { endpoint: `${basePath}api/chat`, origin: "" };
  let parsed;
  try { parsed = new URL(endpoint); } catch { throw new Error("CHAT_API_URL debe ser una URL HTTPS absoluta"); }
  const validPath = parsed.pathname === "/api/chat" || parsed.pathname === "/functions/v1/chat";
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || !validPath) {
    throw new Error("CHAT_API_URL debe ser HTTPS y terminar en /api/chat o /functions/v1/chat, sin credenciales, parámetros ni fragmentos");
  }
  return { endpoint: parsed.href, origin: parsed.origin };
}

module.exports = { chatDeployConfig };
