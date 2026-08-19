const { test, expect } = require("@playwright/test");

test("Rural Prado muestra un carrusel funcional en cada alojamiento", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/rural-prado/", { waitUntil: "networkidle" });
  await expect(page.locator("[data-rural-gallery] [data-carousel]")).toHaveCount(5);
  await expect(page.locator('[data-rural-gallery="salgueiro"] [data-carousel-track] > div')).toHaveCount(11);

  const ameiro = page.locator('[data-rural-gallery="ameiro"] [data-carousel]');
  await expect(ameiro.locator("[data-carousel-count]")).toHaveText("1 / 2");
  await ameiro.locator("[data-carousel-next]").click();
  await expect(ameiro.locator("[data-carousel-count]")).toHaveText("2 / 2");
  await expect(ameiro.locator("[data-carousel-track] > div").nth(1)).toHaveAttribute("aria-hidden", "false");

  await page.locator('[data-rural-gallery="salgueiro"] [data-gallery-open]').click();
  await expect(page.locator("#gallery-modal")).toBeVisible();
  await expect(page.locator("#gallery-modal-title")).toHaveText("Salgueiro");
  await expect(page.locator("#gallery-modal-count")).toHaveText("1 / 11");
  await page.locator("[data-gallery-next]").click();
  await expect(page.locator("#gallery-modal-count")).toHaveText("2 / 11");
  await page.keyboard.press("Escape");
  await expect(page.locator("#gallery-modal")).toBeHidden();
  expect(errors).toEqual([]);
});
