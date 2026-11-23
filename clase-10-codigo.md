# Clase 10 — Código para ejecutar Playwright en integración continua

Esta guía acompaña las demostraciones del tutor y permite repetirlas después de clase. **Alcance:** D7 / 7.1–7.3. Usamos la aplicación y los dos tests de clase 9: deben aceptarse las edades **18 y 120**, y cada caso crea y borra su propio curso.

## 1. Preparación y vocabulario

Trabajar desde la raíz de `practica-playwright`, con los siete archivos completos de [clase 9](../playwright-class-9/clase-9-codigo.md), el modelo original y los tests sin pausas ni simulaciones. Conservar `package.json` y `package-lock.json`. La referencia de esta práctica es **Playwright Test 1.64.1**, como en clase 9, con Node.js 22 en la demostración local y en GitHub Actions.

El tutor prepara los repositorios de práctica y las ejecuciones remotas antes del encuentro. Seguir la clase no requiere una cuenta en GitHub o GitLab. Para repetir la parte remota por tu cuenta, necesitás tu propio repositorio de práctica y un agente de ejecución disponible. Los archivos siguientes corresponden a `practica-playwright`, no al repositorio de Learn-up.

| Término | Significado en esta práctica |
|---|---|
| Git y repositorio | Git registra versiones de archivos; el repositorio reúne esos archivos y su historial. GitHub y GitLab alojan repositorios y servicios de automatización. |
| Commit, rama y push | Un commit registra un conjunto de cambios; una rama mantiene una línea de trabajo; un push envía los commits al repositorio remoto. `main` es la rama principal del ejemplo. |
| Pull request | Propuesta de incorporar cambios de una rama a otra en GitHub. GitLab llama merge request a esa propuesta. |
| CI | Integración continua: incorporar cambios con frecuencia y comprobarlos automáticamente. |
| CD | Entrega continua: mantener una versión lista para publicar; despliegue continuo: publicar automáticamente en el entorno que usan los usuarios. |
| Pipeline | Secuencia automatizada que prepara, verifica y conserva resultados para un cambio. |
| Workflow y evento | En GitHub, un workflow define el proceso automatizado; un evento, como un push, lo inicia. |
| Job, step y runner | Job es un trabajo; step es un paso dentro de él; runner es el agente que ejecuta sus comandos. El worker de Playwright es un proceso que ejecuta tests dentro de ese trabajo. |
| Action | Componente reutilizable de GitHub Actions. `uses` selecciona una action y `with` le pasa parámetros; `run` ejecuta un comando. |
| YAML | Formato de configuración. La sangría con espacios expresa niveles, `clave: valor` asocia datos y `-` introduce un elemento de una lista. `\|` inicia un texto de varias líneas. |
| Variable de entorno | Valor que el proceso recibe del entorno. GitHub Actions y GitLab CI proporcionan `CI`; `process.env.CI` lo consulta en Node.js. |
| Lockfile | `package-lock.json`: registra las versiones que `npm ci` instalará. Debe coincidir con `package.json`. |
| Artefacto y retención | Artefacto es un archivo conservado de la ejecución. Retención es el tiempo configurado para mantenerlo disponible. |
| Código de salida | Número que devuelve un proceso al terminar. Cero comunica éxito; un valor distinto de cero comunica un error. |
| Docker, imagen y contenedor | Docker permite iniciar un entorno desde una imagen preparada. La imagen contiene archivos y programas; el contenedor es la ejecución de ese entorno. |
| Tag y executor | Tag es la etiqueta de versión de una imagen. Executor es la forma en que el runner prepara el entorno; para el ejemplo GitLab se necesita uno compatible con contenedores, como Docker. |

Crear **tres archivos nuevos completos**. Los archivos de clase 9 permanecen en sus rutas originales:

```text
practica-playwright/
  .github/workflows/playwright-clase-10.yml   (nuevo: GitHub)
  .gitlab-ci.yml                             (nuevo: GitLab)
  playwright.clase-10.config.ts              (nuevo)
  practica-clase-9/                          (se conserva)
  pages/clase-9/                             (se conserva)
  helpers/clase-9/                           (se conserva)
  tests/clase-9/                             (se conserva)
  playwright.clase-9.config.ts               (se conserva)
  package.json                              (se conserva)
  package-lock.json                         (se conserva)
```

Usar el archivo de la plataforma donde esté el repositorio. Durante las demos se muestran ambas alternativas con el mismo contenido de práctica. Incluir en el repositorio remoto el lockfile, la aplicación, los tests, los helpers, el modelo y la configuración; `node_modules/`, los reportes y los resultados se generan durante la ejecución.

## 2. Configuración de la ejecución

`webServer` indica qué proceso iniciar y qué dirección esperar antes de ejecutar los tests. `reuseExistingServer: false` impide aprovechar por accidente un servidor que haya quedado abierto en otro modo. Detener primero el servidor manual de clase 9: el puerto **4179 debe estar libre**. Playwright inicia el servidor y lo detiene al terminar la ejecución.

`forbidOnly` rechaza un `test.only`, que seleccionaría solo parte de los tests. `!!process.env.CI` convierte la presencia de la variable en una condición booleana. Los dos proveedores la proporcionan durante la ejecución remota. El ejemplo usa **un worker en todos los entornos** para observar la misma secuencia y **cero reintentos** para conservar el primer resultado.

`timeout` limita cada test a 30 segundos; `expect.timeout` y `actionTimeout` limitan sus comprobaciones y acciones a 5 segundos. `globalTimeout` limita la corrida de Playwright a 5 minutos. El arranque del servidor tiene 15 segundos. El límite de 20 minutos del trabajo remoto deja margen para instalar y publicar archivos; no es el timeout de una assertion.

### Archivo completo: playwright.clase-10.config.ts

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/clase-9',
  outputDir: 'test-results/clase-10',
  timeout: 30_000,
  globalTimeout: 5 * 60 * 1000,
  expect: { timeout: 5_000 },
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/clase-10', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4179',
    actionTimeout: 5_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'node practica-clase-9/servidor.cjs correcto',
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: false,
    timeout: 15_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
```

Los reporters presentan los resultados: `list` en la terminal y `html` en una carpeta navegable. Se conservan captura, video y traza de los intentos fallidos, como en clase 9. No cambiar esas políticas mientras se comparan las dos plataformas.

## 3. Ejecución local de referencia

Consultar las versiones instaladas:

```sh
node --version
npx playwright --version
```

Con el lockfile disponible, `npm ci` instala las dependencias registradas. Si `package.json` y el lockfile no coinciden, falla en lugar de reescribirlo. `playwright install chromium` obtiene el navegador; en los agentes Linux se agregará `--with-deps` para instalar también sus bibliotecas del sistema.

```sh
npm ci
npx playwright install chromium
npx playwright test -c playwright.clase-10.config.ts --list
npx playwright test -c playwright.clase-10.config.ts
```

`-c` selecciona la configuración; `--list` enumera los casos. Se esperan **dos tests en un archivo**, después **2 passed**, usando un worker y sin abrir ventanas del navegador. Esa ejecución sin ventana se llama **headless**. La salida del servidor informa las creaciones y limpiezas; al terminar, el servidor que inició Playwright se detiene.

Abrir el resultado:

```sh
npx playwright show-report playwright-report/clase-10
```

Cerrar la consulta con Control+C antes de seguir. El ensayo local verifica los comandos y los archivos; la ejecución de un runner remoto se comprueba por separado.

## 4. GitHub Actions

El archivo vive bajo `.github/workflows/`. `on` declara eventos: aquí pushes a `main`, cambios en pull requests hacia `main` y el inicio manual `workflow_dispatch`. Para usar el inicio manual, el workflow debe estar disponible en la rama predeterminada del repositorio.

`jobs` reúne trabajos; `runs-on` selecciona el entorno del runner; `steps` ordena pasos. `actions/checkout@v6` obtiene el código y `actions/setup-node@v6` prepara Node.js 22. `permissions.contents: read` limita el acceso de la credencial automática del trabajo a la lectura del contenido del repositorio.

La expresión `${{ !cancelled() }}` permite intentar la publicación después de un fallo si la ejecución no fue cancelada. No cambia el código de salida de los tests. `path: |` enumera las carpetas que se guardan; `retention-days` configura su retención.

### Archivo completo: .github/workflows/playwright-clase-10.yml

```yaml
name: Playwright - clase 10

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  playwright:
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - name: Obtener el código
        uses: actions/checkout@v6

      - name: Preparar Node.js
        uses: actions/setup-node@v6
        with:
          node-version: '22'

      - name: Instalar dependencias del proyecto
        run: npm ci

      - name: Instalar Chromium y sus bibliotecas
        run: npx playwright install --with-deps chromium

      - name: Ejecutar los dos tests
        run: npx playwright test -c playwright.clase-10.config.ts

      - name: Guardar reporte y resultados
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v5
        with:
          name: playwright-clase-10
          path: |
            playwright-report/clase-10/
            test-results/clase-10/
          retention-days: 7
```

En una ejecución de referencia, abrir el trabajo `playwright`, leer la instalación y el resultado **2 passed**, y localizar el artefacto `playwright-clase-10`. Si hay un fallo antes de que se genere el reporte, la condición no crea por sí sola esa evidencia. Una cancelación o un runner que deja de funcionar tampoco garantizan su publicación.

## 5. Provocar y conservar un fallo

En la configuración nueva, cambiar temporalmente **solo** esta línea:

```ts
command: 'node practica-clase-9/servidor.cjs defecto',
```

El servidor vuelve a rechazar por error 18 años. Los tests y la expectativa permanecen iguales. Ejecutar:

```sh
npx playwright test -c playwright.clase-10.config.ts
```

Se esperan **1 passed y 1 failed**, con fallo de `C-DIAG-02`, y un código de salida distinto de cero. En Bash o Zsh, `echo $?` consulta el código inmediatamente después del comando. En PowerShell lo consulta `$LASTEXITCODE`. Leerlo antes de ejecutar otro programa.

Guardar desde el explorador una copia completa en `evidencias-clase-10/local-fallo/`, manteniendo las rutas relativas `playwright-report/clase-10/` y `test-results/clase-10/` dentro de esa carpeta. Conservar todos sus archivos y subcarpetas. Abrir el reporte de esa copia:

```sh
npx playwright show-report evidencias-clase-10/local-fallo/playwright-report/clase-10
```

Se espera el rechazo de 18, el contador visible en cero y una respuesta HTTP 422 en la traza. La assertion de aceptación falla; sus comprobaciones posteriores no llegan a ejecutarse. Cerrar la consulta y restaurar **`correcto`** en la configuración. Ejecutar otra vez: se esperan **2 passed** y código de salida cero.

Para preparar la demostración remota, el tutor conserva dos ejecuciones identificadas de su repositorio de práctica: una con `correcto` y otra con `defecto`. Cada una debe mostrar el cambio que la produjo y sus propios archivos. La publicación del artefacto debe completarse también en la fallida, mientras el trabajo de tests sigue fallido.

Después de descargar y descomprimir el artefacto de GitHub en `evidencias-clase-10/github-fallo/`, abrir la carpeta que contiene `playwright-report/clase-10/` y `test-results/clase-10/`. Si esas carpetas quedaron directamente allí:

```sh
npx playwright show-report evidencias-clase-10/github-fallo/playwright-report/clase-10
```

Conservar el árbol completo de archivos, no solo `index.html`. Identificar proveedor, ejecución, commit y caso antes de comparar. El reporte HTML y sus archivos vecinos permiten consultar las capturas y la traza del intento correspondiente.

## 6. GitLab CI

Usar un runner compatible con imágenes de contenedores, por ejemplo el executor Docker. La imagen oficial incluye los navegadores y sus bibliotecas, pero el paquete de Playwright y las dependencias del proyecto se instalan con `npm ci`.

Antes de elegir la imagen, consultar la versión instalada:

```sh
npm ls @playwright/test
```

`ls` muestra el paquete instalado. Para **1.64.1**, la imagen del ejemplo es `mcr.microsoft.com/playwright:v1.64.1-noble`. Su tag incluye la versión de Playwright y `noble`, el nombre de Ubuntu 24.04. Si tu lockfile registra otra versión de Playwright, alinear la imagen con esa versión antes de ejecutar; no usar un tag distinto por copiar el ejemplo.

`stages` lista las etapas y `stage` ubica el trabajo en una de ellas. `script` enumera los comandos. La preparación habitual del runner recupera el repositorio antes de ejecutarlos. Este ejemplo mínimo usa pipelines de rama; no configura específicamente pipelines de merge request. `artifacts.when: always` intenta guardar los archivos también si falla el comando de tests; `expire_in` configura su vencimiento.

### Archivo completo: .gitlab-ci.yml

```yaml
stages:
  - test

playwright:
  stage: test
  image: mcr.microsoft.com/playwright:v1.64.1-noble
  timeout: 20m
  script:
    - node --version
    - npm ci
    - npx playwright test -c playwright.clase-10.config.ts
  artifacts:
    when: always
    expire_in: 7 days
    paths:
      - playwright-report/clase-10/
      - test-results/clase-10/
```

Conservar en GitLab las mismas dos variantes preparadas para GitHub. En la correcta se esperan **2 passed**; en la defectuosa **1 passed y 1 failed** y un trabajo fallido con archivos descargables. Descargar y descomprimir los archivos de la ejecución fallida en `evidencias-clase-10/gitlab-fallo/`, y abrir:

```sh
npx playwright show-report evidencias-clase-10/gitlab-fallo/playwright-report/clase-10
```

La retención depende también de los ajustes del proyecto. GitLab puede conservar los artefactos de la ejecución exitosa más reciente de una rama aunque se haya indicado `expire_in`. La política `always` no produce archivos ausentes ni garantiza publicación después de un timeout del trabajo o pérdida del runner.

## 7. Cierre y práctica después de clase

Dejar la configuración en `correcto`, los tests originales y cero reintentos. Repetir los dos casos y confirmar que el servidor se detiene. Conservar los resultados fallidos en sus carpetas identificadas antes de ejecutar otra vez.

En Learn-up, completar las lecciones, preguntas y laboratorios de **7.1, 7.2 y 7.3**. El laboratorio 7.2 presenta una suite genérica con `npx playwright test`; este material agrega `-c` para seleccionar la práctica. El laboratorio 7.3 usa **1.62.1** como dato de su propio escenario: aplicar allí la misma regla de coincidencia de versiones, sin reemplazar ese dato por el de esta demo.

Si repetís la integración remota, revisar qué inició la ejecución, qué versión del código se probó, dónde falló, qué evidencia quedó y qué acción debería tomar el equipo. Un **quality gate**, o condición para avanzar, puede exigir que una comprobación pase; para que bloquee la incorporación de cambios hay que configurar también la regla correspondiente del repositorio.

## Referencias

- [Programa del curso](../../../content/playwright/syllabus.yaml), objetivos 7.1–7.3, y [guía de clase 9](../playwright-class-9/clase-9-codigo.md).
- [Playwright: integración continua](https://playwright.dev/docs/ci), [servidor de la aplicación](https://playwright.dev/docs/test-webserver), [Docker](https://playwright.dev/docs/docker) y [configuración](https://playwright.dev/docs/test-configuration).
- [GitHub Actions: conceptos](https://docs.github.com/en/actions/get-started/understand-github-actions), [sintaxis](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) y [artefactos](https://docs.github.com/en/actions/tutorials/store-and-share-data).
- [GitLab: sintaxis CI/CD](https://docs.gitlab.com/ci/yaml/) y [artefactos](https://docs.gitlab.com/ci/jobs/job_artifacts/).
- [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).
