const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { pages, properties } = require("../../site.config.cjs");

for (const entry of pages) {
  test(`${entry.route} conserva estructura, metadatos y navegación`, async ({ page }) => {
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    const response = await page.goto(entry.route, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("main#main-content")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('a[href="#main-content"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${entry.route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    expect(errors).toEqual([]);
  });
}

test("todos los CTA abren siempre el selector con ambas propiedades", async ({ page }) => {
  await page.goto("/");
  const trigger = page.locator("[data-booking-trigger]:visible").first();
  await trigger.click();
  const dialog = page.locator("[data-booking-dialog]");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(`[href="${properties.larDeVies.bookingUrl}"]`)).toHaveCount(1);
  await expect(dialog.locator(`[href="${properties.ruralPrado.bookingUrl}"]`)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("el selector de idioma enlaza las tres versiones", async ({ page }, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name === "mobile") {
    await page.locator("[data-mobile-navigation] > summary").click();
  }
  const selector = page.locator(".language-selector:visible");
  const summary = selector.locator("summary");
  await summary.click();
  await expect(selector).toHaveAttribute("open", "");
  await expect(selector.locator('[lang="es"][aria-current="true"]')).toHaveCount(1);
  await expect(selector.locator('[lang="en"]')).toHaveAttribute("href", "/en/");
  await expect(selector.locator('[lang="de"]')).toHaveAttribute("href", "/de/");
  await expect(selector.locator(".language-flag")).toHaveCount(4);
});

for (const locale of ["en", "de"]) {
  test(`la portada ${locale} tiene contenido, metadatos y enlaces localizados`, async ({ page }) => {
    await page.goto(`/${locale}/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator(`.language-selector [lang="${locale}"][aria-current="true"]`)).toHaveCount(2);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${locale}/$`));
    await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="de"]')).toHaveCount(1);
    await expect(page.locator("nav#main-nav a").filter({ hasText: locale === "en" ? "Home" : "Startseite" })).toHaveCount(2);
  });
}

test("la reserva funciona sin JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/reservas/#elegir-alojamiento");
  await expect(page.locator("#elegir-alojamiento")).toBeVisible();
  await expect(page.locator(`#elegir-alojamiento a[href="${properties.larDeVies.bookingUrl}"]`)).toBeVisible();
  await expect(page.locator(`#elegir-alojamiento a[href="${properties.ruralPrado.bookingUrl}"]`)).toBeVisible();
  await context.close();
});

test("el carrusel carga solo la imagen activa y las adyacentes al acercarse", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const carouselImageRequests = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "image" &&
      /\/assets\/(?:images|media)\/camino-/i.test(new URL(request.url()).pathname)
    ) {
      carouselImageRequests.push(request.url());
    }
  });
  await page.goto("/villa-el-camino/", { waitUntil: "domcontentloaded" });
  const carousel = page.locator("[data-carousel]").first();
  const trackImages = carousel.locator("[data-carousel-track] img");
  await expect(trackImages).toHaveCount(10);
  expect(await trackImages.evaluateAll((images) => images.every((image) => (
    image.getAttribute("src")?.startsWith("data:")
  )))).toBe(true);

  await carousel.scrollIntoViewIfNeeded();
  await expect.poll(async () => trackImages.evaluateAll((images) => (
    images.filter((image) => !image.getAttribute("src")?.startsWith("data:")).length
  ))).toBe(3);

  const trackState = await trackImages.evaluateAll((images) => images.map((image) => ({
    currentSrc: image.currentSrc,
    promoted: !image.getAttribute("src")?.startsWith("data:"),
  })));
  const promotedCurrentSources = trackState
    .filter(({ promoted, currentSrc }) => promoted && currentSrc.startsWith("http"))
    .map(({ currentSrc }) => currentSrc);
  expect(promotedCurrentSources.length).toBeGreaterThan(0);
  expect(promotedCurrentSources.length).toBeLessThanOrEqual(3);
  expect(trackState.filter(({ promoted }) => !promoted).every(({ currentSrc }) => (
    currentSrc === "" || currentSrc.startsWith("data:")
  ))).toBe(true);

  const requestedPaths = [...new Set(carouselImageRequests.map((url) => new URL(url).pathname))];
  const fullSlideRequests = requestedPaths.filter((pathname) => (
    !/-hero-/i.test(pathname) && !/-(?:160|320)\.(?:avif|webp)$/i.test(pathname)
  ));
  const thumbnailIdentities = new Set(requestedPaths
    .filter((pathname) => /-(?:160|320)\.(?:avif|webp)$/i.test(pathname))
    .map((pathname) => pathname.replace(/-(?:160|320)\.(?:avif|webp)$/i, "")));
  expect(fullSlideRequests.length).toBeGreaterThan(0);
  expect(fullSlideRequests.length).toBeLessThanOrEqual(3);
  expect(thumbnailIdentities.size).toBe(10);
});

test("el carrusel conserva una imagen visible sin JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/villa-el-camino/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-carousel]").first()).toBeHidden();
  await expect(page.locator('img[alt="Villa El Camino - vista principal"]:visible')).toHaveCount(1);
  await context.close();
});

for (const entry of pages) {
  test(`${entry.route} sin fallos axe graves`, async ({ page }) => {
    await page.goto(entry.route, { waitUntil: "domcontentloaded" });
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
    expect(serious).toEqual([]);
  });
}

test("movimiento reducido no solicita vídeos hero", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  const videoRequests = [];
  page.on("request", (request) => { if (/\.(?:mp4|webm)(?:\?|$)/.test(request.url())) videoRequests.push(request.url()); });
  await page.goto("/", { waitUntil: "networkidle" });
  expect(videoRequests).toEqual([]);
  await expect(page.locator(".hero-poster img")).toBeVisible();
  await context.close();
});

test("Save-Data y 3G no solicitan vídeos hero", async ({ browser }) => {
  for (const connection of [
    { saveData: true, effectiveType: "4g" },
    { saveData: false, effectiveType: "3g" },
  ]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript((value) => {
      Object.defineProperty(navigator, "connection", { configurable: true, value });
    }, connection);
    const videoRequests = [];
    page.on("request", (request) => {
      if (/\.(?:mp4|webm)(?:\?|$)/.test(request.url())) videoRequests.push(request.url());
    });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1_500);
    expect(videoRequests).toEqual([]);
    await context.close();
  }
});

test("la transferencia previa al vídeo respeta los presupuestos móvil y escritorio", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "PerformanceResourceTiming se presupuesta una sola vez en Chromium.");
  for (const profile of [
    { viewport: { width: 375, height: 812 }, budget: 400 * 1024 },
    { viewport: { width: 1440, height: 1000 }, budget: 750 * 1024 },
  ]) {
    const context = await browser.newContext({ viewport: profile.viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    const videoRequests = [];
    page.on("request", (request) => {
      if (/\.(?:mp4|webm)(?:\?|$)/.test(request.url())) videoRequests.push(request.url());
    });
    await page.goto("/", { waitUntil: "networkidle" });
    const transferred = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0]?.transferSize || 0;
      const resources = performance.getEntriesByType("resource")
        .filter((entry) => new URL(entry.name).origin === location.origin)
        .reduce((total, entry) => total + (entry.transferSize || 0), 0);
      return navigation + resources;
    });
    expect(videoRequests).toEqual([]);
    expect(transferred).toBeLessThanOrEqual(profile.budget);
    await context.close();
  }
});

test("redirecciones y retiradas usan estados correctos", async ({ request }) => {
  expect((await request.get("/otros-alojamientos/", { maxRedirects: 0 })).status()).toBe(301);
  expect((await request.get("/excursiones-en-lugo/", { maxRedirects: 0 })).status()).toBe(410);
  expect((await request.get("/blog/", { maxRedirects: 0 })).status()).toBe(410);
});
