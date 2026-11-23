import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/clase-7/login-page';
import { SolicitudPage } from '../../../pages/clase-7/solicitud-page';

test.describe('Acceso', () => {
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).goto();
  });

  test('C-LOGIN-01: acepta credenciales correctas', async ({ page }) => {
    const login = new LoginPage(page);
    await login.iniciarSesion('ana@example.test', 'clave-demo');

    await expect(page).toHaveURL('/solicitud');
    const solicitud = new SolicitudPage(page);
    await expect(solicitud.encabezado).toBeVisible();
    await expect(solicitud.encabezado).toHaveText('Nueva solicitud');
  });

  test('C-LOGIN-02: rechaza una contraseña incorrecta', async ({ page }) => {
    const login = new LoginPage(page);
    await login.iniciarSesion('ana@example.test', 'incorrecta');

    await expect(login.alerta).toBeVisible();
    await expect(login.alerta).toHaveText('Credenciales inválidas');
    await expect(page).toHaveURL('/login?error=1');
  });
});
