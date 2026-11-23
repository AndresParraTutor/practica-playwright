# Clase 3 — Código y comandos para copiar

Archivos completos y comandos de la clase 3. Ejecutar los comandos desde la carpeta indicada en cada paso.

## 1. Preparación

Si faltan Node.js, npm o npx, abrir [la descarga oficial de Node.js](https://nodejs.org/en/download) y elegir la opción de instalación para el sistema operativo. Para la clase se recomienda Node.js 24.x LTS con npm. En Windows y macOS se puede usar el instalador de la página; en Linux hay que seguir las instrucciones para la distribución o usar un gestor de versiones de Node.js. La rama mínima que la documentación actual de Playwright admite es una versión actualizada de 22.x; también admite 24.x y 26.x. No especifica un mínimo independiente de npm o npx. [Guía de instalación de npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/).

Si `node --version` muestra una versión antigua, en macOS, Linux o WSL se puede comprobar si nvm está disponible con `command -v nvm`. Si muestra `nvm`, actualizar y seleccionar la última LTS:

```sh
nvm install --lts
nvm use --lts
node --version
```

Si `nvm` no se reconoce, usar las instrucciones de la descarga oficial. En Windows con **nvm-windows** previamente instalado, los comandos equivalentes son `nvm install lts` y `nvm use lts`.

Después de instalar, abrir una terminal nueva. Desde una ubicación donde se pueda crear un proyecto de práctica:

```sh
node --version
npm --version
npx --version
mkdir practica-playwright
cd practica-playwright
npm init playwright@latest
```

Elegir TypeScript, carpeta `tests`, sin GitHub Actions y sin descarga automática de navegadores. Si aparece la pregunta sobre «Install Playwright operating system dependencies (requires sudo / root)?», responder **No**. Luego:

```sh
npx playwright install chromium
npx playwright --version
```

En WSL/Linux, si Chromium no abre y Playwright indica que faltan bibliotecas del sistema (por ejemplo, `libnspr4.so`), ejecutar desde el proyecto:

```sh
npx playwright install-deps chromium
```

Puede pedir permisos de administración. Esta instalación es distinta de la descarga del navegador; después, volver a ejecutar el test.

Quitar únicamente el archivo de ejemplo generado por el asistente en el nuevo proyecto, normalmente `tests/example.spec.ts`. Conservar la carpeta `tests`.

## 2. Archivo completo: playwright.config.ts

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

## 3. Archivo completo: tests/panel.spec.ts

```ts
import { test, expect } from '@playwright/test';

test('C-PANEL-01: muestra el encabezado acordado', async ({ page }) => {
  await page.setContent('<main><h1>Panel de calidad</h1></main>');
  // await new Promise((resolve) => setTimeout(resolve, 2000));

  const encabezado = page.getByRole('heading', { level: 1 });
  await expect(encabezado).toBeVisible();
  await expect(encabezado).toHaveText('Panel de calidad');
});
```

Para observar la página con `--headed`, descomentar temporalmente la línea de `setTimeout` después de `setContent`. Volver a comentarla o quitarla al terminar la demostración.

## 4. Ejecución y reporte

Ejecutar el archivo en Chromium:

```sh
npx playwright test tests/panel.spec.ts --project=chromium
```

Repetir con ventana visible:

```sh
npx playwright test tests/panel.spec.ts --project=chromium --headed
```

Consultar el reporte generado por la última ejecución y detener su servidor con Control+C al terminar:

```sh
npx playwright show-report
```

## 5. Cambio del taller

En `tests/panel.spec.ts`, reemplazar solamente la línea de preparación por:

```ts
  await page.setContent('<main><h1>Panel de pruebas</h1></main>');
```

Mantener las dos assertions originales. Guardar y volver a ejecutar el mismo comando. Registrar que la visibilidad pasa y que la comprobación de texto falla: esperado «Panel de calidad», recibido «Panel de pruebas».

Restaurar la línea original con «Panel de calidad», guardar y ejecutar nuevamente. El resultado esperado es `passed`.

## 6. Repetir un proyecto ya preparado

En otra máquina, después de copiar los archivos del proyecto y disponer de Node.js compatible:

```sh
npm ci
npx playwright install chromium
npx playwright test tests/panel.spec.ts --project=chromium
```

Esta secuencia corresponde a un proyecto que ya tiene `package.json` y `package-lock.json`; la creación inicial se realiza con el asistente del punto 1.
