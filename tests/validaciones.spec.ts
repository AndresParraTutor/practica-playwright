import { test, expect } from '@playwright/test';

const origen = 'http://127.0.0.1:4176';

test('C-LOGIN-01: acepta credenciales correctas', async ({ page }) => {
  await page.goto(`${origen}/login`);
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();

  await expect(page).toHaveURL(`${origen}/solicitud`);
  const encabezado = page.getByRole('heading', { level: 1 });
  await expect(encabezado).toBeVisible();
  await expect(encabezado).toHaveText('Nueva solicitud');
});

test('C-FLUJO-01: confirma la descripción y el archivo recibidos', async ({ page }) => {
  await page.goto(`${origen}/login`);
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(`${origen}/solicitud`);

  const descripcion = page.getByLabel('Descripción', { exact: true });
  await descripcion.fill('Actualizar mis datos');
  await expect(descripcion).toHaveValue('Actualizar mis datos');
  await page.getByLabel('Adjuntar nota', { exact: true }).setInputFiles({
    name: 'nota.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('evidencia de prueba'),
  });
  await expect(page.getByTestId('archivo-elegido')).toHaveText('nota.txt');

  await page.getByRole('button', {
    name: 'Enviar solicitud', exact: true,
  }).click();

  const confirmacion = page.getByRole('status');
  await expect(confirmacion).toBeVisible();
  await expect(
    confirmacion,
    'La confirmación debe identificar la descripción y el archivo recibidos',
  ).toHaveText('Solicitud guardada: Actualizar mis datos · nota.txt.');
  await expect(page.getByRole('alert')).toBeHidden();
});

test('C-ESTADOS-01: refleja los estados de los controles', async ({ page }) => {
  await page.goto(`${origen}/login`);
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(`${origen}/solicitud`);

  const cuenta = page.getByLabel('Cuenta', { exact: true });
  await expect(cuenta).toHaveValue('ana@example.test');
  await expect(cuenta).not.toBeEditable();
  await expect(page.getByLabel('Descripción', { exact: true })).toBeEditable();

  const motivo = page.getByLabel('Motivo', { exact: true });
  await motivo.selectOption('consulta');
  await expect(motivo).toHaveValue('consulta');

  const copia = page.getByRole('checkbox', {
    name: 'Recibir copia por correo', exact: true,
  });
  await copia.check();
  await expect(copia).toBeChecked();

  const notificaciones = page.getByRole('button', {
    name: 'Notificaciones', exact: true,
  });
  await expect(notificaciones).toHaveAttribute('aria-pressed', 'false');
  await notificaciones.click();
  await expect(notificaciones).toHaveAttribute('aria-pressed', 'true');

  const enviar = page.getByRole('button', {
    name: 'Enviar solicitud', exact: true,
  });
  await expect(enviar).toBeDisabled();
  const adjunto = page.getByLabel('Adjuntar nota', { exact: true });
  await adjunto.setInputFiles({
    name: 'nota.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('evidencia de prueba'),
  });
  await expect(enviar).toBeEnabled();
  await adjunto.setInputFiles([]);
  await expect(enviar).toBeDisabled();
  await expect(page.getByTestId('archivo-elegido'))
    .toHaveText('Sin archivo seleccionado');
});

test('C-LOGIN-02: rechaza una contraseña incorrecta', async ({ page }) => {
  await page.goto(`${origen}/login`);
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();

  const error = page.getByRole('alert');
  await expect(error).toBeVisible();
  await expect(error).toHaveText('Credenciales inválidas');
  await expect(page).toHaveURL(`${origen}/login?error=1`);
});
