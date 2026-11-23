import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/clase-7/login-page';
import { SolicitudPage } from '../../../pages/clase-7/solicitud-page';

test.describe('Envío de solicitudes', () => {
  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.iniciarSesion('ana@example.test', 'clave-demo');
    await expect(page).toHaveURL('/solicitud');
  });

  test('C-FLUJO-01: confirma la descripción y el archivo recibidos', async ({ page }) => {
    const solicitud = new SolicitudPage(page);
    await solicitud.descripcion.fill('Actualizar mis datos');
    await expect(solicitud.descripcion).toHaveValue('Actualizar mis datos');
    await solicitud.adjuntarNota('nota.txt', 'evidencia de prueba');
    await expect(solicitud.archivoElegido).toHaveText('nota.txt');

    await solicitud.enviarSolicitud();

    await expect(solicitud.confirmacion).toBeVisible();
    await expect(
      solicitud.confirmacion,
      'La confirmación debe identificar la descripción y el archivo recibidos',
    ).toHaveText('Solicitud recibida: Actualizar mis datos · nota.txt.');
    await expect(solicitud.alerta).toBeHidden();
  });
});
