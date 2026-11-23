import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/clase-7/login-page';
import { SolicitudPage } from '../../../pages/clase-7/solicitud-page';

test.describe('Estados del formulario', () => {
  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.iniciarSesion('ana@example.test', 'clave-demo');
    await expect(page).toHaveURL('/solicitud');
  });

  test('C-ESTADOS-01: refleja los estados de los controles', async ({ page }) => {
    const solicitud = new SolicitudPage(page);
    await expect(solicitud.cuenta).toHaveValue('ana@example.test');
    await expect(solicitud.cuenta).not.toBeEditable();
    await expect(solicitud.descripcion).toBeEditable();

    await solicitud.motivo.selectOption('consulta');
    await expect(solicitud.motivo).toHaveValue('consulta');

    await solicitud.copia.check();
    await expect(solicitud.copia).toBeChecked();

    await expect(solicitud.notificaciones).toHaveAttribute('aria-pressed', 'false');
    await solicitud.notificaciones.click();
    await expect(solicitud.notificaciones).toHaveAttribute('aria-pressed', 'true');

    await expect(solicitud.enviar).toBeDisabled();
    await solicitud.adjuntarNota('nota.txt', 'evidencia de prueba');
    await expect(solicitud.enviar).toBeEnabled();
    await solicitud.adjunto.setInputFiles([]);
    await expect(solicitud.enviar).toBeDisabled();
    await expect(solicitud.archivoElegido).toHaveText('Sin archivo seleccionado');
  });
});
