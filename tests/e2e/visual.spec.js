const { test, expect } = require("@playwright/test");

const routes = [
  { path: "/", name: "inicio" },
  { path: "/la-casona/", name: "la-casona" },
  { path: "/rural-prado/", name: "rural-prado" },
  { path: "/el-entorno/", name: "el-entorno" },
  { path: "/reservas/", name: "reservas" },
];

const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
];

test.describe("regresion visual representativa", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ browserName }) => browserName !== "chromium", "Los baselines visuales se mantienen una sola vez en Chromium.");

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("http://127.0.0.1:4173/**", async (requestRoute) => {
      if (requestRoute.request().resourceType() !== "document") {
        await requestRoute.continue();
        return;
      }
      const fontResponse = await requestRoute.fetch();
      const body = (await fontResponse.text()).replaceAll("font-display:optional", "font-display:block");
      await requestRoute.fulfill({ response: fontResponse, body });
    });
  });

  for (const viewport of viewports) {
    for (const route of routes) {
      test(`${route.name} a ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const response = await page.goto(route.path, { waitUntil: "networkidle" });
        expect(response?.status()).toBe(200);

        await page.evaluate(async () => {
          const step = Math.max(window.innerHeight, 600);
          for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 35));
          }

          await Promise.all([
            document.fonts.ready,
            ...Array.from(document.images, (image) => {
              if (!image.complete || typeof image.decode !== "function") return Promise.resolve();
              return image.decode().catch(() => undefined);
            }),
          ]);
          window.scrollTo(0, 0);
        });

        await page.waitForFunction(() => {
          const height = document.documentElement.scrollHeight;
          const now = Date.now();
          const state = window.__visualHeightState;
          if (!state || state.height !== height) {
            window.__visualHeightState = { height, since: now };
            return false;
          }
          return now - state.since >= 300;
        }, null, { polling: 100, timeout: 3_000 });

        await expect(page).toHaveScreenshot(`${route.name}-${viewport.width}.png`, {
          animations: "disabled",
          caret: "hide",
          fullPage: true,
          mask: [page.locator("iframe")],
          maxDiffPixelRatio: 0.005,
        });
      });
    }
  }
});
