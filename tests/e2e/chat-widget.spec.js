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
    await expect(page.getByText('Soy el asistente virtual de Lar de Víes y Rural Prado, basado en inteligencia artificial.')).toBeVisible();
    const panel = page.locator('[data-chat-panel]');
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    for (const label of ['¿Qué alojamiento me recomendáis?', '¿Aceptáis perros?', '¿Hay cenas?']) {
      const suggestion = page.getByRole('button', { name: label });
      await expect(suggestion).toBeVisible();
      const suggestionBox = await suggestion.boundingBox();
      expect(suggestionBox).not.toBeNull();
      expect(suggestionBox.x).toBeGreaterThanOrEqual(panelBox.x);
      expect(suggestionBox.x + suggestionBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
    }
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

  test('retira el aviso de cookies y mantiene accesible el chat', async ({ page }) => {
    await page.goto('/');
    await dismissCookieBanner(page);

    const chatButton = page.getByRole('button', { name: 'Pregúntanos' });
    await expect(page.locator('[data-cookie-consent]')).toHaveCount(0);
    await expect(chatButton).toBeVisible();
  });

  test('conserva la conversación y el estado abierto al cambiar de página', async ({ page }) => {
    let requestBody;
    await page.route('**/api/chat', async (route) => {
      requestBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: 'Sí, ofrecemos cenas determinados días y según disponibilidad.',
          sources: [{ title: 'Gastronomía', url: '/sobre-nosotros/' }],
          abstained: false,
          historyToken: 'test-signed-history-token',
        }),
      });
    });
    await page.goto('/');
    await dismissCookieBanner(page);
    await page.getByRole('button', { name: 'Pregúntanos' }).click();
    await page.getByLabel('Escribe tu pregunta').fill('¿Hay cenas?');
    await page.getByRole('button', { name: 'Enviar pregunta' }).click();
    await expect(page.getByText('Sí, ofrecemos cenas determinados días y según disponibilidad.')).toBeVisible();
    expect(requestBody.page).toBe('/');
    expect(requestBody.historyToken).toBe('');

    await page.goto('/la-casona/');

    const dialog = page.getByRole('dialog', { name: '¿En qué podemos ayudarte?' });
    await expect(dialog).toBeVisible();
    const conversation = dialog.getByRole('log');
    await expect(conversation.getByText('¿Hay cenas?', { exact: true })).toBeVisible();
    await expect(conversation.getByText('Sí, ofrecemos cenas determinados días y según disponibilidad.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pregúntanos' })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText(/el historial visible se conserva en esta pestaña/i)).toBeVisible();
  });
});
