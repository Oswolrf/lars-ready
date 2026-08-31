const { test, expect } = require('@playwright/test');

const mobileWidths = [320, 375, 430, 767];

const expectInsideViewport = async (locator) => {
  const bounds = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight);
};

test.describe('controles flotantes en móvil', () => {
  test('el aviso y el panel de cookies no amplían ni rebasan el viewport', async ({ page }) => {
    for (const width of mobileWidths) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto('/');

      const banner = page.locator('.cookie-consent__banner');
      await expect(banner).toBeVisible();
      await expectInsideViewport(banner);
      expect(await banner.locator('.cookie-consent__actions').evaluate((element) => getComputedStyle(element).display)).toBe('grid');

      const pageWidths = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(pageWidths.scrollWidth).toBe(pageWidths.clientWidth);

      for (const button of await banner.getByRole('button').all()) {
        await expectInsideViewport(button);
      }

      await banner.getByRole('button', { name: 'Configurar' }).click();
      const panel = page.locator('[data-cookie-panel]');
      await expect(panel).toBeVisible();
      await expectInsideViewport(panel);
      await panel.getByRole('button', { name: 'Cerrar preferencias' }).click();
    }
  });

  test('acepta, rechaza y guarda las preferencias de cookies', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.removeItem('lar-de-vies-cookie-consent-v1'));
    await page.reload();

    const banner = page.locator('.cookie-consent__banner');
    await banner.getByRole('button', { name: 'Configurar' }).click();
    const panel = page.locator('[data-cookie-panel]');
    await panel.getByRole('checkbox', { name: 'Cookies de análisis' }).check();
    await panel.getByRole('button', { name: 'Guardar preferencias' }).click();
    await expect(page.locator('[data-cookie-consent]')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('lar-de-vies-cookie-consent-v1')).analytics)).toBe(true);

    await page.evaluate(() => window.localStorage.removeItem('lar-de-vies-cookie-consent-v1'));
    await page.reload();
    await page.locator('.cookie-consent__banner').getByRole('button', { name: 'Rechazar opcionales' }).click();
    await expect(page.locator('[data-cookie-consent]')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('lar-de-vies-cookie-consent-v1')).analytics)).toBe(false);

    await page.evaluate(() => window.localStorage.removeItem('lar-de-vies-cookie-consent-v1'));
    await page.reload();
    await page.locator('.cookie-consent__banner').getByRole('button', { name: 'Aceptar todas' }).click();
    await expect(page.locator('[data-cookie-consent]')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('lar-de-vies-cookie-consent-v1')).analytics)).toBe(true);
  });

  test('el chatbot usa un icono accesible hasta 767 px y recupera el texto a 768 px', async ({ page }) => {
    for (const width of mobileWidths) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto('/');

      const rejectCookies = page.locator('.cookie-consent__banner').getByRole('button', { name: 'Rechazar opcionales' });
      if (await rejectCookies.isVisible()) await rejectCookies.click();

      const trigger = page.getByRole('button', { name: 'Pregúntanos' });
      await expect(trigger).toBeVisible();
      const size = await trigger.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const label = element.querySelector('span');
        return {
          width: rect.width,
          height: rect.height,
          labelClip: getComputedStyle(label).clipPath,
        };
      });
      expect(size.width).toBe(52);
      expect(size.height).toBe(52);
      expect(size.labelClip).toBe('inset(50%)');
    }

    await page.setViewportSize({ width: 768, height: 812 });
    await page.goto('/');
    const desktopTrigger = page.getByRole('button', { name: 'Pregúntanos' });
    await expect(desktopTrigger.locator('span')).toBeVisible();
    expect((await desktopTrigger.boundingBox()).width).toBeGreaterThan(52);
  });
});
