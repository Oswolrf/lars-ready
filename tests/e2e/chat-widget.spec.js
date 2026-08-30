const { test, expect } = require('@playwright/test');

test.describe('chatbot RAG', () => {
  const dismissCookieBanner = async (page) => {
    const reject = page.getByRole('button', { name: 'Rechazar opcionales' }).first();
    if (await reject.isVisible()) await reject.click();
  };

  test('abre, expone las preguntas sugeridas y se cierra con Escape', async ({ page }) => {
    await page.goto('/');
    await dismissCookieBanner(page);

    const trigger = page.getByRole('button', { name: 'Pregúntanos' });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(page.getByRole('dialog', { name: '¿En qué podemos ayudarte?' })).toBeVisible();
    await expect(page.getByRole('button', { name: '¿Aceptáis perros?' })).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '¿En qué podemos ayudarte?' })).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('encaja en móvil sin salirse de la ventana', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await dismissCookieBanner(page);
    await page.locator('[data-chat-trigger]').click();

    const panel = page.locator('[data-chat-panel]');
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(812);
  });
});
