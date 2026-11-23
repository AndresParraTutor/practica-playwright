import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

const origen = 'http://127.0.0.1:4175';

test('C-LOGIN-01: acepta credenciales correctas', async ({ page }) => {
  await page.goto(`${origen}/login`);
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();

  await expect(page).toHaveURL(`${origen}/solicitud`);
  await expect(page.getByRole('heading', {
    name: 'Nueva solicitud', exact: true,
  })).toBeVisible();
});

test('C-LOGIN-02: rechaza una contraseña incorrecta', async ({ page }) => {
  await page.goto(`${origen}/login`);
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText('Credenciales inválidas');
  await expect(page).toHaveURL(`${origen}/login?error=1`);
});


test('C-FLUJO-01: envía una solicitud con una nota', async ({ page }) => {
  await page.goto(`${origen}/login`);

  // Completar aquí el ingreso con la cuenta ficticia válida.
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();  

  await expect(page).toHaveURL(`${origen}/solicitud`);
  await expect(page.getByRole('heading', {
    name: 'Nueva solicitud', exact: true,
  })).toBeVisible();

  // Completar descripción, seleccionar nota.txt en memoria y enviar.
  await page.getByLabel('Descripción', { exact: true }).fill('Actualizar mis datos');
  await page.getByLabel('Adjuntar nota', { exact: true }).setInputFiles({
    name: 'nota.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('evidencia de prueba'),
  });
  await page.getByRole('button', {
    name: 'Enviar solicitud', exact: true,
  }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Solicitud recibida: Actualizar mis datos · nota.txt.',
  );

});

