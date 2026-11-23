import type { Locator, Page } from '@playwright/test';

export class InscripcionPage {
  private readonly page: Page;
  readonly curso: Locator;
  readonly total: Locator;
  readonly edad: Locator;
  readonly enviar: Locator;
  readonly confirmacion: Locator;
  readonly alerta: Locator;

  constructor(page: Page) {
    this.page = page;
    this.curso = page.getByTestId('curso');
    this.total = page.getByTestId('total');
    this.edad = page.getByLabel('Edad', { exact: true });
    this.enviar = page.getByRole('button', {
      name: 'Enviar inscripción', exact: true,
      // name: 'Guardar inscripción', exact: true,
    });
    this.confirmacion = page.getByRole('status');
    this.alerta = page.getByRole('alert');
  }

  async goto(nombreCurso: string) {
    const nombre = encodeURIComponent(nombreCurso);
    await this.page.goto(`/cursos/${nombre}/inscripcion`);
  }

  async enviarEdad(edad: number) {
    await this.edad.fill(String(edad));
    await this.enviar.click();
  }
}
