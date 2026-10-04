"use strict";

(() => {
  const counter = document.querySelector("[data-countdown]");
  if (!counter) return;
  const deadline = Date.parse(counter.dataset.launchAt);
  if (!Number.isFinite(deadline)) return;
  const units = counter.querySelector(".countdown-units");
  const status = counter.querySelector(".launch-status");
  const fields = ["days", "hours", "minutes", "seconds"].map((name) => counter.querySelector(`[data-countdown-${name}]`));
  let referenceTime = Date.now();
  let referenceTick = performance.now();
  let nextCheck = 0;
  let checking = false;
  let navigating = false;
  let wasDue = false;

  function now() { return referenceTime + performance.now() - referenceTick; }

  async function checkLaunch() {
    if (checking || navigating) return;
    checking = true;
    nextCheck = performance.now() + 30000;
    const started = performance.now();
    try {
      const response = await fetch(counter.dataset.launchStatus, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("Launch status unavailable");
      const state = await response.json();
      const serverTime = Date.parse(response.headers.get("date"));
      if (Number.isFinite(serverTime)) {
        referenceTime = serverTime + (performance.now() - started) / 2;
        referenceTick = performance.now();
      }
      if (state.launched === true) {
        const target = new URL(counter.dataset.launchTarget, window.location.origin);
        if (target.origin !== window.location.origin) return;
        target.search = window.location.search;
        target.hash = window.location.hash;
        navigating = true;
        // Replacing the same URL with a fragment can be a same-document
        // navigation. Reload it so the server actually sends the live page.
        if (target.pathname === window.location.pathname) window.location.reload();
        else window.location.replace(target.href);
      }
    } catch {
      // Keep reservations available; retry without a reload loop if offline.
    } finally {
      checking = false;
      if (deadline <= now()) nextCheck = performance.now() + 2000;
    }
  }

  function update() {
    const remaining = Math.max(0, Math.ceil((deadline - now()) / 1000));
    const values = [Math.floor(remaining / 86400), Math.floor(remaining / 3600) % 24, Math.floor(remaining / 60) % 60, remaining % 60];
    fields.forEach((field, index) => { field.textContent = String(values[index]).padStart(2, "0"); });
    units.hidden = false;
    if (!remaining && !wasDue) nextCheck = 0;
    wasDue = !remaining;
    if (!remaining && !status.textContent) status.textContent = counter.dataset.openingMessage;
    if (remaining && status.textContent) status.textContent = "";
    if (performance.now() >= nextCheck) void checkLaunch();
  }

  update();
  window.setInterval(update, 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { nextCheck = 0; update(); }
  });
  window.addEventListener("pageshow", () => { nextCheck = 0; update(); });
  window.addEventListener("online", () => { nextCheck = 0; update(); });
})();
