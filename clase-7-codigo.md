# Clase 7 — Código para organizar una suite mantenible

Este material acompaña [la presentación de la clase 7](presentacion.md). Durante el encuentro el tutor muestra la reorganización; después se pueden repetir los ejemplos en `practica-playwright`.

Conservamos los cuatro casos de la clase 6 y sus comprobaciones: acceso correcto, envío válido, estados de los controles y rechazo de una contraseña incorrecta. Cambiamos la ubicación de los archivos y la forma de expresar la preparación y las interacciones. La versión final usa dos page objects. Al final hay una variante con una función auxiliar para comparar ambas decisiones.

**Alcance:** D5 / 5.1–5.2. Organización, `describe`, hooks, helpers y Page Object Model. La parametrización, las fixtures personalizadas y la ejecución paralela se desarrollan en la clase 8.

## 1. Preparación y estructura

Usar el proyecto `practica-playwright` de la clase 3 con su instalación de Playwright Test y Chromium. Conservar `package.json`, `package-lock.json`, `playwright.config.ts` y los archivos de clases anteriores. No se agregan dependencias. Para preparar un equipo nuevo, seguir la [guía de clase 3](../playwright-class-3/clase-3-codigo.md), que recomienda Node.js 24 LTS.

Crear desde el editor los archivos de este árbol. Los nombres de las carpetas expresan su responsabilidad; no son una estructura obligatoria de Playwright.

```text
practica-playwright/
  practica-clase-7/
    servidor.cjs
    login.html
    solicitud.html
  pages/
    clase-7/
      login-page.ts
      solicitud-page.ts
  helpers/
    clase-7/
      iniciar-sesion.ts
  tests/
    clase-7/
      auth/
        login.spec.ts
      solicitudes/
        envio.spec.ts
        estados.spec.ts
  playwright.clase-7.config.ts
  playwright.config.ts           (se conserva)
  package.json                   (se conserva)
  package-lock.json              (se conserva)
```

El servidor es una copia independiente de la práctica de clase 6, ahora en **4177**. Usa la cuenta ficticia `ana@example.test` / `clave-demo`. Las sesiones viven en memoria hasta detenerlo. La aplicación informa la recepción de la descripción y el archivo; no guarda solicitudes ni archivos ni envía correos. Los controles adicionales permiten observar estados de interfaz.

La configuración específica de clase 7 selecciona solo estos cuatro tests. Hay que pasar `-c playwright.clase-7.config.ts` en cada ejecución de esta práctica. `-c` es la forma corta de `--config`. Así se puede conservar la configuración anterior.

## 2. Aplicación de soporte

Copiar completos estos tres archivos. Conservan el comportamiento de la clase 6; solo cambia el puerto del servidor. Durante la clase no se explica el servidor línea por línea.

### practica-clase-7/servidor.cjs

```js
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { setTimeout: esperar } = require('node:timers/promises');

const origen = 'http://127.0.0.1:4177';
const demora = Number(process.argv[2] ?? 200);
if (!Number.isInteger(demora) || demora < 0 || demora > 10000) {
  throw new Error('La demora debe ser un entero entre 0 y 10000 ms.');
}

const login = readFileSync(join(__dirname, 'login.html'));
const solicitud = readFileSync(join(__dirname, 'solicitud.html'));
const sesiones = new Set();

function responder(res, codigo, tipo, cuerpo) {
  res.writeHead(codigo, {
    'Content-Type': tipo + '; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(cuerpo);
}

function json(res, codigo, datos) {
  responder(res, codigo, 'application/json', JSON.stringify(datos));
}

function redirigir(res, destino, cookie) {
  const headers = { Location: destino, 'Cache-Control': 'no-store' };
  if (cookie) headers['Set-Cookie'] = cookie;
  res.writeHead(303, headers);
  res.end();
}

async function leerFormulario(req) {
  const partes = [];
  let cantidad = 0;
  for await (const parte of req) {
    cantidad += parte.length;
    if (cantidad > 65536) {
      throw new Error('El formulario de práctica supera los 64 KiB.');
    }
    partes.push(parte);
  }
  const peticion = new Request(origen, {
    method: 'POST',
    headers: { 'Content-Type': req.headers['content-type'] ?? '' },
    body: Buffer.concat(partes),
  });
  return peticion.formData();
}

const servidor = createServer(async (req, res) => {
  try {
    const ruta = new URL(req.url, origen).pathname;
    const sesion = req.headers.cookie?.match(/(?:^|;\s*)sesion=([^;]+)/)?.[1];
    const autenticado = sesiones.has(sesion);

    if (req.method === 'GET' && ruta === '/') {
      return redirigir(res, '/login');
    }
    if (req.method === 'GET' && ruta === '/login') {
      return responder(res, 200, 'text/html', login);
    }
    if (req.method === 'POST' && ruta === '/login') {
      const datos = await leerFormulario(req);
      if (datos.get('correo') !== 'ana@example.test' ||
          datos.get('contrasena') !== 'clave-demo') {
        return redirigir(res, '/login?error=1');
      }
      const token = randomUUID();
      sesiones.add(token);
      return redirigir(res, '/solicitud',
        `sesion=${token}; HttpOnly; SameSite=Lax; Path=/`);
    }
    if (req.method === 'GET' && ruta === '/solicitud') {
      if (!autenticado) return redirigir(res, '/login');
      return responder(res, 200, 'text/html', solicitud);
    }
    if (req.method === 'POST' && ruta === '/solicitudes') {
      if (!autenticado) {
        return json(res, 401, { error: 'Ingresá para enviar la solicitud' });
      }
      const datos = await leerFormulario(req);
      const descripcion = String(datos.get('descripcion') ?? '').trim();
      const archivo = datos.get('adjunto');
      if (!descripcion || !(archivo instanceof File) || archivo.size === 0) {
        return json(res, 400, { error: 'Descripción y nota son obligatorias' });
      }
      if (!archivo.name.endsWith('.txt') || archivo.type !== 'text/plain') {
        return json(res, 400, { error: 'Adjuntá una nota de texto .txt' });
      }
      const contenido = await archivo.text();
      if (!contenido.trim()) {
        return json(res, 400, { error: 'La nota debe tener contenido' });
      }
      await esperar(demora);
      return json(res, 201, {
        mensaje: 'Solicitud recibida: ' + descripcion + ' · ' + archivo.name + '.',
      });
    }
    responder(res, 404, 'text/plain', 'Ruta no encontrada');
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      json(res, 500, { error: 'No se pudo procesar el formulario de práctica' });
    } else {
      res.end();
    }
  }
});

servidor.listen(4177, '127.0.0.1', () => {
  console.log(`Abrir ${origen}/login — demora del envío: ${demora} ms`);
});
```

### practica-clase-7/login.html

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ingreso · Práctica de Playwright</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1rem; }
    label { display: block; margin-top: 1rem; }
    input, button { font: inherit; padding: .5rem; }
    button { display: block; margin-top: 1rem; }
    [role="alert"] { color: #a31515; }
  </style>
</head>
<body>
  <main>
    <h1>Ingresar</h1>
    <p>Aplicación de práctica. Usá la cuenta ficticia del ejercicio.</p>
    <form action="/login" method="post">
      <label for="correo">Correo</label>
      <input id="correo" name="correo" type="email" required>
      <label for="contrasena">Contraseña</label>
      <input id="contrasena" name="contrasena" type="password" required>
      <button type="submit">Ingresar</button>
    </form>
    <p id="error" role="alert" hidden></p>
  </main>
  <script>
    if (new URLSearchParams(location.search).get('error') === '1') {
      const error = document.querySelector('#error');
      error.textContent = 'Credenciales inválidas';
      error.hidden = false;
    }
  </script>
</body>
</html>
```

### practica-clase-7/solicitud.html

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nueva solicitud · Práctica de Playwright</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1rem; }
    label { display: block; margin-top: 1rem; }
    textarea, input, select, button { font: inherit; padding: .5rem; }
    textarea { width: 90%; }
    button { display: block; margin-top: 1rem; }
    button[aria-pressed="true"] { background: #dff2df; border: 2px solid #206a20; }
    [role="alert"] { color: #a31515; }
  </style>
</head>
<body>
  <main>
    <h1>Nueva solicitud</h1>
    <label for="cuenta">Cuenta</label>
    <input id="cuenta" type="email" value="ana@example.test" readonly>
    <form id="solicitud" action="/solicitudes" method="post"
          enctype="multipart/form-data">
      <label for="motivo">Motivo</label>
      <select id="motivo" name="motivo">
        <option value="datos">Actualizar datos</option>
        <option value="consulta">Hacer una consulta</option>
      </select>
      <label for="descripcion">Descripción</label>
      <textarea id="descripcion" name="descripcion" required></textarea>
      <label for="adjunto">Adjuntar nota</label>
      <input id="adjunto" name="adjunto" type="file"
             accept=".txt,text/plain" required>
      <p>Archivo: <span data-testid="archivo-elegido">Sin archivo seleccionado</span></p>
      <label><input id="copia" name="copia" type="checkbox"> Recibir copia por correo</label>
      <button id="notificaciones" type="button" aria-pressed="false">Notificaciones</button>
      <button id="enviar" type="submit" disabled>Enviar solicitud</button>
    </form>
    <p id="estado" role="status"></p>
    <p id="error" role="alert" hidden></p>
  </main>
  <script>
    const formulario = document.querySelector('#solicitud');
    const adjunto = document.querySelector('#adjunto');
    const enviar = document.querySelector('#enviar');
    const elegido = document.querySelector('[data-testid="archivo-elegido"]');
    const estado = document.querySelector('#estado');
    const error = document.querySelector('#error');
    const notificaciones = document.querySelector('#notificaciones');
    let preparacion;

    notificaciones.addEventListener('click', () => {
      const activo = notificaciones.getAttribute('aria-pressed') === 'true';
      notificaciones.setAttribute('aria-pressed', String(!activo));
    });

    adjunto.addEventListener('change', () => {
      clearTimeout(preparacion);
      enviar.disabled = true;
      estado.textContent = '';
      error.textContent = '';
      error.hidden = true;
      elegido.textContent = adjunto.files[0]?.name ?? 'Sin archivo seleccionado';
      if (adjunto.files.length > 0) {
        preparacion = setTimeout(() => { enviar.disabled = false; }, 400);
      }
    });

    formulario.addEventListener('submit', async event => {
      event.preventDefault();
      enviar.disabled = true;
      estado.textContent = 'Enviando…';
      error.textContent = '';
      error.hidden = true;
      try {
        const respuesta = await fetch('/solicitudes', {
          method: 'POST',
          body: new FormData(formulario),
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) {
          estado.textContent = '';
          error.textContent = datos.error;
          error.hidden = false;
          return;
        }
        estado.textContent = datos.mensaje;
      } catch {
        estado.textContent = '';
        error.textContent = 'No se pudo enviar la solicitud';
        error.hidden = false;
      } finally {
        enviar.disabled = adjunto.files.length === 0;
      }
    });
  </script>
</body>
</html>
```

## 3. Archivo completo: playwright.clase-7.config.ts

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/clase-7',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4177',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

En una suite habitual, estas decisiones viven en `playwright.config.ts`. Esta copia tiene un nombre explícito para poder elegir la clase sin reemplazar la configuración anterior. `baseURL` permite usar `/login` en `goto()` y `/solicitud` en `toHaveURL()`. Una cadena relativa se resuelve contra esa base; una expresión regular de URL se compara con la URL completa.

## 4. Archivo completo: pages/clase-7/login-page.ts

```ts
import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  private readonly page: Page;
  private readonly correo: Locator;
  private readonly contrasena: Locator;
  private readonly ingresar: Locator;
  readonly alerta: Locator;

  constructor(page: Page) {
    this.page = page;
    this.correo = page.getByLabel('Correo', { exact: true });
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
```

`Page` representa la página que Playwright entrega al test; `Locator` describe cómo encontrar un control. El constructor guarda esa página y define los localizadores. No abre otra ventana, no navega ni inicia sesión. `readonly` impide reasignar una propiedad desde TypeScript; el control representado puede cambiar de valor o de estado. `private` limita el acceso a los campos internos del modelo.

`iniciarSesion` sirve tanto para credenciales correctas como incorrectas. Ejecutar las interacciones no afirma que el acceso fue aceptado: el resultado depende del caso y se comprueba en el test.

## 5. Archivo completo: pages/clase-7/solicitud-page.ts

```ts
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
```

El objeto concentra los localizadores de la vista y ofrece operaciones con intención reconocible. Los tests pueden usar los localizadores expuestos para interactuar y comprobar sus estados. No hace falta envolver cada método de Playwright en otro método propio.

El clic de `enviarSolicitud()` conserva el auto-waiting de Playwright, incluida la espera a que el botón esté habilitado. La confirmación posterior sigue necesitando su assertion. El modelo no agrega pausas fijas ni captura errores de las comprobaciones.

## 6. Archivo completo: tests/clase-7/auth/login.spec.ts

```ts
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
```

El hook solo abre login porque esa es la precondición común a ambos casos. No inicia una sesión correcta antes del caso que comprueba el rechazo. Las instancias creadas en el hook y en el test reciben la misma `page` de ese caso; construir un objeto no crea otra sesión. El siguiente test recibe su propia página y contexto.

`describe` da un nombre al grupo y delimita el hook. No convierte los tests en pasos de un único recorrido. Los identificadores `C-LOGIN-01` y `C-LOGIN-02` conservan la relación con sus casos originales.

## 7. Archivo completo: tests/clase-7/solicitudes/envio.spec.ts

```ts
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
```

El login es preparación de este caso. Por eso vive en el hook de este grupo y comprueba el destino antes de completar el formulario. Las assertions de descripción, archivo y confirmación permanecen en el cuerpo del test. No dependen de que `C-LOGIN-01` se haya ejecutado antes.

## 8. Archivo completo: tests/clase-7/solicitudes/estados.spec.ts

```ts
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
```

La preparación de acceso se repite en dos archivos, con el mismo propósito y alcance explícito. Por ahora es breve y permite leer cada archivo de forma independiente. En la clase 8 evaluaremos cómo una fixture personalizada puede entregar esa precondición sin compartir una página global.

## 9. Iniciar la aplicación y ejecutar los cuatro casos

Desde la raíz de `practica-playwright`, en una terminal:

```sh
node practica-clase-7/servidor.cjs 200
```

Abrir `http://127.0.0.1:4177/login` y comprobar que la cuenta ficticia permite ver Nueva solicitud. Mantener esa terminal abierta. El argumento `200` es la demora de respuesta del servidor en milisegundos; no es un timeout de Playwright. Control+C detiene el servidor.

En otra terminal, listar los casos descubiertos:

```sh
npx playwright test -c playwright.clase-7.config.ts --list
```

Se esperan **4 tests en 3 archivos**. Ejecutarlos:

```sh
npx playwright test -c playwright.clase-7.config.ts
```

Se esperan **4 passed** en el proyecto Chromium, único proyecto de esta configuración. El orden de inicio o finalización entre archivos puede variar; no expresa dependencias.

Ejecutar cada caso por separado:

```sh
npx playwright test -c playwright.clase-7.config.ts --grep C-LOGIN-01
npx playwright test -c playwright.clase-7.config.ts --grep C-FLUJO-01
npx playwright test -c playwright.clase-7.config.ts --grep C-ESTADOS-01
npx playwright test -c playwright.clase-7.config.ts --grep C-LOGIN-02
```

Cada comando debe dar **1 passed**, incluso si no se ejecutaron los demás casos. `--grep` selecciona por el título completo, que incluye el grupo y el nombre del caso. En esta práctica los identificadores son únicos.

Para observar el flujo en una ventana:

```sh
npx playwright test -c playwright.clase-7.config.ts --grep C-FLUJO-01 --headed
```

Consultar el reporte de la última ejecución:

```sh
npx playwright show-report
```

Detener el visor con Control+C al terminar. El reporte corresponde a la última ejecución, que puede haber seleccionado solo un caso.

## 10. Archivo completo: helpers/clase-7/iniciar-sesion.ts

Este helper permite repetir la etapa anterior al POM. La versión final de los cuatro tests usa los modelos; el helper se usa solo en la variante de la sección siguiente.

```ts
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
```

Recibe la página del caso y los datos elegidos por quien lo llama. El nombre expresa una operación común. No crea estado global, no decide qué credenciales usar ni exige que el acceso termine aceptado. En esta función, abrir login forma parte de la operación; en el POM separamos `goto()` e `iniciarSesion()` para poder usarlos por separado.

## 11. Variante con helper — diapositiva 13

Guardar una copia de `tests/clase-7/solicitudes/envio.spec.ts` para restaurarla al terminar. Reemplazar temporalmente **todo ese archivo** por esta variante completa. El acceso usa el helper; las interacciones de la solicitud quedan explícitas para compararlas después con el modelo:

```ts
import { test, expect } from '@playwright/test';
import { iniciarSesion } from '../../../helpers/clase-7/iniciar-sesion';

test.describe('Envío de solicitudes', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, 'ana@example.test', 'clave-demo');
    await expect(page).toHaveURL('/solicitud');
  });

  test('C-FLUJO-01: confirma la descripción y el archivo recibidos', async ({ page }) => {
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
    ).toHaveText('Solicitud recibida: Actualizar mis datos · nota.txt.');
    await expect(page.getByRole('alert')).toBeHidden();
  });
});
```

Ejecutar:

```sh
npx playwright test -c playwright.clase-7.config.ts --grep C-FLUJO-01
```

Se espera **1 passed**. Después restaurar el archivo completo de la sección 7. La presentación empieza mostrando esta variante y más adelante vuelve a la versión final con POM; ambas están preparadas para no escribirlas durante la explicación.

El helper es suficiente cuando necesitamos centralizar una operación. El POM reúne además los localizadores y las operaciones de una vista utilizada por distintos casos. Elegir uno exige evaluar la repetición y la claridad que aporta; una clase no es un requisito de Playwright.

## 12. Comprobar qué aporta la reorganización — diapositiva 21

Primero ejecutar los cuatro casos de la versión final. Después hacer estos cambios por separado y restaurarlos antes de seguir.

**Cambio de un localizador de login.** En `pages/clase-7/login-page.ts`, reemplazar temporalmente la definición de `this.correo` por esta consulta equivalente:

```ts
this.correo = page.getByRole('textbox', { name: 'Correo', exact: true });
```

Ejecutar los cuatro tests. Deben dar **4 passed** sin editar los specs. Cambió el lugar donde el modelo encuentra ese campo y se conservaron las expectativas. Esta equivalencia funciona para el campo de correo de esta aplicación; no es una regla para cualquier tipo de input. Restaurar `getByLabel('Correo', { exact: true })` al terminar.

**Cambio del contrato esperado.** En `tests/clase-7/solicitudes/envio.spec.ts`, reemplazar únicamente el texto esperado completo de la confirmación:

```ts
).toHaveText('Solicitud enviada: Actualizar mis datos · nota.txt.');
```

La línea anterior reemplaza el cierre de la llamada existente a `expect`; no se pega como una instrucción independiente. Ejecutar solo `C-FLUJO-01`. Se espera **1 failed**: la aplicación sigue mostrando «Solicitud recibida…». Leer el título, el mensaje personalizado, el esperado y el recibido. Restaurar el esperado original:

```ts
).toHaveText('Solicitud recibida: Actualizar mis datos · nota.txt.');
```

Ejecutar de nuevo los cuatro casos. Se esperan **4 passed**. El modelo concentra detalles de interacción; el resultado que el caso exige sigue visible y puede fallar en el spec.

## 13. Hooks, limpieza y límites de la práctica

| Hook | Alcance de la preparación o limpieza |
|---|---|
| `beforeEach` | Antes de cada test del archivo o grupo donde se declara. Puede usar la fixture `page` del caso. |
| `afterEach` | Después de cada test de ese alcance, también cuando falla. La limpieza debe admitir una preparación incompleta. |
| `beforeAll` | Antes de los tests de ese alcance, una vez por proceso worker que los ejecute. Puede repetirse si se reinicia ese proceso. |
| `afterAll` | Limpieza de recursos de ese alcance y worker. No equivale a un único cierre global de toda la ejecución. |

El `page` y el `context` incorporados tienen alcance por test: no se solicitan en `beforeAll` o `afterAll`. Poner una página en una variable compartida para evitar logins crearía otra responsabilidad y otra forma de acoplamiento.

En esta práctica Playwright administra el cierre de su página y contexto. El servidor no persiste solicitudes. Por eso los archivos finales no agregan `afterEach` ni `afterAll` vacíos. Detener el servidor elimina las sesiones de memoria.

Si una aplicación real crea un proyecto o un registro persistente, cerrar el navegador no borra ese dato. La limpieza debe identificar el recurso creado por el caso y contemplar que la creación no haya terminado. No debería borrar datos de otros casos ni capturar cualquier error sin informarlo. La gestión de datos y fixtures se continúa en la clase 8.

## 14. Práctica después de clase

1. Ejecutar los cuatro casos juntos y cada identificador por separado.
2. Comparar la variante del helper con el login mediante `LoginPage`. Señalar qué recibe cada una y dónde se comprueba el resultado.
3. Hacer los dos cambios de la sección 12 y restaurar la versión que da cuatro resultados correctos.
4. Leer las lecciones 5.1 y 5.2 en Learn-up y completar sus preguntas y laboratorios: **Reorganizar una suite pequeña** y **Diseñar un page object de login**. Esos laboratorios plantean ejemplos de proyectos y login; aplicar las mismas decisiones de responsabilidades.

Al terminar, detener el servidor con Control+C. Poder ejecutar un caso solo aporta evidencia de independencia, pero el aislamiento de cookies no garantiza que todos los datos de una aplicación real estén aislados.

## Referencias

Consultadas el 2026-11-05. Los ejemplos propios mantienen la API habitual de Playwright Test y la aplicación de práctica del curso.

- [Configuración](https://playwright.dev/docs/test-configuration) y [opciones de línea de comandos](https://playwright.dev/docs/test-cli).
- [`describe` y hooks](https://playwright.dev/docs/api/class-test).
- [Fixtures incorporadas y su alcance](https://playwright.dev/docs/test-fixtures) y [aislamiento mediante contextos](https://playwright.dev/docs/browser-contexts).
- [Page Object Model](https://playwright.dev/docs/pom) y [`toHaveURL` con `baseURL`](https://playwright.dev/docs/api/class-pageassertions#page-assertions-to-have-url).
