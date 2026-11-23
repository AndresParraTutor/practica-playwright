import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  private readonly page: Page;
  private readonly correo: Locator;
  private readonly contrasena: Locator;
  private readonly ingresar: Locator;
  readonly alerta: Locator;

  constructor(page: Page) {
    this.page = page;
    this.correo = page.getByRole('textbox', { name: 'Correo', exact: true });
    this.contrasena = page.getByLabel('Contraseña', { exact: true });
    this.ingresar = page.getByRole('button', {
      name: 'Ingresar', exact: true,
    });
    this.alerta = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async iniciarSesion(correo: string, contrasena: string) {
    await this.correo.fill(correo);
    await this.contrasena.fill(contrasena);
    await this.ingresar.click();
  }
}
