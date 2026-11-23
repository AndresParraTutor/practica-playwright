import { test, expect } from '@playwright/test';

test('C-PANEL-01: muestra el encabezado acordado', async ({ page }) => {
  await page.setContent('<main><h1>Panel de pruebas</h1></main>');
  // await new Promise((resolve) => setTimeout(resolve, 2000));

  const encabezado = page.getByRole('heading', { level: 1 });
  await expect(encabezado).toBeVisible();
  await expect(encabezado).toHaveText('Panel de calidad');
});
