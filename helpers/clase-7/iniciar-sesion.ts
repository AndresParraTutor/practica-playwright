import type { Page } from '@playwright/test';

export async function iniciarSesion(
  page: Page,
  correo: string,
  contrasena: string,
) {
  await page.goto('/login');
  await page.getByLabel('Correo', { exact: true }).fill(correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(contrasena);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
}
