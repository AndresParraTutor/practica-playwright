import type { Locator, Page } from '@playwright/test';

export class SolicitudPage {
  readonly encabezado: Locator;
  readonly cuenta: Locator;
  readonly descripcion: Locator;
  readonly motivo: Locator;
  readonly copia: Locator;
  readonly notificaciones: Locator;
  readonly enviar: Locator;
  readonly adjunto: Locator;
  readonly archivoElegido: Locator;
  readonly confirmacion: Locator;
  readonly alerta: Locator;

  constructor(page: Page) {
    this.encabezado = page.getByRole('heading', { level: 1 });
    this.cuenta = page.getByLabel('Cuenta', { exact: true });
    this.descripcion = page.getByLabel('Descripción', { exact: true });
    this.motivo = page.getByLabel('Motivo', { exact: true });
    this.copia = page.getByRole('checkbox', {
      name: 'Recibir copia por correo', exact: true,
    });
    this.notificaciones = page.getByRole('button', {
      name: 'Notificaciones', exact: true,
    });
    this.enviar = page.getByRole('button', {
      name: 'Enviar solicitud', exact: true,
    });
    this.adjunto = page.getByLabel('Adjuntar nota', { exact: true });
    this.archivoElegido = page.getByTestId('archivo-elegido');
    this.confirmacion = page.getByRole('status');
    this.alerta = page.getByRole('alert');
  }

  async adjuntarNota(nombre: string, contenido: string) {
    await this.adjunto.setInputFiles({
      name: nombre,
      mimeType: 'text/plain',
      buffer: Buffer.from(contenido),
    });
  }

  async enviarSolicitud() {
    await this.enviar.click();
  }
}
