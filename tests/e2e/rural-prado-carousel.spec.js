const { test, expect } = require("@playwright/test");

test("Rural Prado muestra un carrusel funcional en cada alojamiento", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/rural-prado/", { waitUntil: "networkidle" });
  await expect(page.locator("[data-rural-gallery] [data-carousel]")).toHaveCount(5);
  await expect(page.locator('[data-rural-gallery="salgueiro"] [data-carousel-track] > div')).toHaveCount(7);
  const salgueiroGallery = page.locator('[data-rural-gallery="salgueiro"]');
  await expect.poll(async () => salgueiroGallery.evaluate((element) => (
    element.getBoundingClientRect().height / element.getBoundingClientRect().width
  ))).toBeCloseTo(4 / 3, 2);

  const ameiro = page.locator('[data-rural-gallery="ameiro"] [data-carousel]');
  await expect(ameiro.locator("[data-carousel-count]")).toHaveText("1 / 2");
  await ameiro.locator("[data-carousel-next]").click();
  await expect(ameiro.locator("[data-carousel-count]")).toHaveText("2 / 2");
  await expect(ameiro.locator("[data-carousel-track] > div").nth(1)).toHaveAttribute("aria-hidden", "false");

  await expect(page.locator("[data-gallery-open]")).toHaveCount(0);
  await expect(page.locator("#gallery-modal")).toHaveCount(0);
  const salgueiro = page.locator('[data-rural-gallery="salgueiro"] [data-carousel]');
  await expect(salgueiro.locator("[data-carousel-count]")).toHaveText("1 / 7");
  await salgueiro.locator("[data-carousel-next]").click();
  await expect(salgueiro.locator("[data-carousel-count]")).toHaveText("2 / 7");
  await expect(salgueiro.locator("[data-carousel-track] > div").nth(1)).toHaveAttribute("aria-hidden", "false");
  expect(errors).toEqual([]);
});
