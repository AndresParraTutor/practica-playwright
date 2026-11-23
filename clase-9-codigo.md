# Clase 9 — Código para investigar fallos y comunicar evidencia

Esta guía reúne los archivos completos, los comandos y los ejercicios para practicar por tu cuenta en `practica-playwright`. Podés seguirla para observar una ejecución, investigar fallos, guardar evidencia y escribir un reporte reproducible.

**Alcance:** D6 / 6.1–6.3. Observar una ejecución, guardar evidencia, reconstruir un fallo y redactar un defecto reproducible. Conservamos las inscripciones por curso y la regla de clase 8: aceptar edades enteras entre **18 y 120 inclusive**.

La aplicación de soporte es independiente de Learn-up. Tiene dos modos preparados para practicar: `correcto` cumple la regla y `defecto` rechaza por error la edad de 18 años. Se reproduce así el rechazo de una persona que cumple exactamente la edad mínima. La regla esperada y los tests se mantienen iguales al cambiar de modo. En ambos, cada test crea un curso propio y lo elimina al terminar, también si falla una comprobación.

## 1. Preparación y vocabulario

Usar `practica-playwright` con Playwright Test y Chromium instalados. Conservar los archivos anteriores, `package.json`, `package-lock.json` y `playwright.config.ts`. No se agregan dependencias. Para preparar un equipo nuevo, seguir la [guía de clase 3](../playwright-class-3/clase-3-codigo.md). Esta guía se verificó con Node.js 22.12.0, Playwright Test 1.64.1 y Chromium en Linux el 2026-11-17. Podés consultar tus versiones con `node --version` y `npx playwright --version`.

Vocabulario para seguir los ejercicios:

| Término | Qué significa aquí |
|---|---|
| Diagnóstico | Reconstruir lo ocurrido y contrastar explicaciones posibles con evidencia. |
| Depuración o debugging | Observar el test mientras se ejecuta, detenerlo y revisar su estado. |
| Inspector | Herramienta de Playwright para avanzar por las acciones e inspeccionar localizadores. |
| Breakpoint | Punto donde se detiene el código para inspeccionarlo. Puede ponerse desde el editor; `page.pause()` agrega una pausa interactiva desde el test. |
| UI Mode | Interfaz de Playwright para seleccionar, ejecutar y revisar tests y sus acciones. |
| Artefacto | Archivo que queda de una ejecución: por ejemplo, una captura, un video o una traza. |
| Log | Registro de mensajes emitidos por el test o la aplicación. |
| DOM | Representación de los elementos de la página que el navegador mantiene en memoria. |
| Traza | Registro de una ejecución con acciones, copias del DOM, red, consola y código fuente. Trace Viewer es la herramienta para recorrerlo. |
| Reporter | Componente que presenta los resultados. El reporter HTML genera un reporte navegable. |
| Timeout | Tiempo máximo para que termine un test, una acción o una comprobación. |
| Retry o reintento | Nueva ejecución de un test que falló, con sus fixtures preparadas otra vez. |
| Flaky | Clasificación de un test que falla inicialmente y pasa en un reintento. No indica que la causa se haya corregido. |

Crear estos **siete archivos completos** desde el editor:

```text
practica-playwright/
  practica-clase-9/
    servidor.cjs
    inscripcion.html
  pages/clase-9/inscripcion-page.ts
  helpers/clase-9/cursos.ts
  helpers/clase-9/diagnostico.ts
  tests/clase-9/diagnostico.spec.ts
  playwright.clase-9.config.ts
  playwright.config.ts           (se conserva)
  package.json                   (se conserva)
  package-lock.json              (se conserva)
```

El servidor usa el puerto **4179**. Pasar `-c playwright.clase-9.config.ts` al ejecutar esta práctica. La configuración selecciona solo sus dos tests. `projects` sigue eligiendo Chromium; el curso es un dato de la aplicación.

Después de crear los archivos, seguir este recorrido:

1. Obtener dos tests correctos y comprobar la limpieza en la sección 8.
2. Provocar el fallo del localizador, observarlo con Inspector y restaurarlo en la sección 9.
3. Activar el modo `defecto` del servidor y revisar el reporte y las evidencias en la sección 10.
4. Comparar los límites de tiempo y los reintentos en las secciones 12.1 y 12.2.
5. Redactar tu reporte tomando como referencia la sección 13 y restaurar la versión correcta con la sección 14.

La captura propia de la sección 11 y la simulación de la sección 12.3 son ejercicios opcionales. Podés hacerlos después del recorrido principal. Cada uno indica el modo del servidor y qué cambio quitar al terminar.

## 2. Aplicación de soporte

Estos dos archivos ya resuelven el formulario y las operaciones del servidor para que puedas concentrarte en los tests y su diagnóstico. `servidor.cjs` valida y guarda edades; `inscripcion.html` envía la edad, muestra la respuesta y emite un mensaje de consola con la edad y el código HTTP recibido.

El modo se elige al iniciar el servidor. Cambiar de modo exige detenerlo con Control+C y volver a iniciarlo. No se modifica la expectativa del test. Los cursos viven en la memoria del servidor; se pierden al borrarlos o detener el proceso. La demora de las altas válidas es de 200 ms en ambos modos.

### Archivo completo: practica-clase-9/servidor.cjs

```js
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { setTimeout: esperar } = require('node:timers/promises');

const origen = 'http://127.0.0.1:4179';
const modo = process.argv[2] ?? 'correcto';
if (!['correcto', 'defecto'].includes(modo)) {
  throw new Error('Usar el modo correcto o defecto.');
}
const demora = 200;
const vista = readFileSync(join(__dirname, 'inscripcion.html'));
const cursos = new Map();

function responder(res, codigo, tipo, cuerpo = '') {
  res.writeHead(codigo, {
    'Content-Type': tipo + '; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(cuerpo);
}

function json(res, codigo, datos) {
  responder(res, codigo, 'application/json', JSON.stringify(datos));
}

async function leerJson(req) {
  const partes = [];
  let cantidad = 0;
  for await (const parte of req) {
    cantidad += parte.length;
    if (cantidad > 65536) throw new Error('El cuerpo supera los 64 KiB.');
    partes.push(parte);
  }
  return JSON.parse(Buffer.concat(partes).toString('utf8'));
}

const servidor = createServer(async (req, res) => {
  try {
    const ruta = new URL(req.url, origen).pathname;
    if (req.method === 'GET' && ruta === '/') {
      return responder(res, 200, 'text/plain',
        `Práctica clase-9-v1 — modo ${modo}. Ejecutá los tests para crear sus cursos.`);
    }
    if (req.method === 'GET' && ruta === '/api/cursos') {
      return json(res, 200, [...cursos.values()].map(curso => ({
        nombre: curso.nombre,
        cantidad: curso.edades.length,
      })));
    }
    if (req.method === 'POST' && ruta === '/api/cursos') {
      const datos = await leerJson(req);
      if (typeof datos.nombre !== 'string' ||
          !/^curso-[a-zA-Z0-9-]{1,110}$/.test(datos.nombre)) {
        return json(res, 400, { error: 'Nombre de curso inválido' });
      }
      if (cursos.has(datos.nombre)) {
        console.log(`Colisión: ${datos.nombre}`);
        return json(res, 409, { error: 'El curso ya existe' });
      }
      cursos.set(datos.nombre, { nombre: datos.nombre, edades: [] });
      console.log(`Creado: ${datos.nombre}`);
      return json(res, 201, { nombre: datos.nombre });
    }

    const api = ruta.match(/^\/api\/cursos\/([^/]+)(\/inscripciones)?$/);
    if (api) {
      const nombre = decodeURIComponent(api[1]);
      if (req.method === 'DELETE' && !api[2]) {
        const existia = cursos.delete(nombre);
        console.log(`Limpieza: ${nombre} (${existia ? 'borrado' : 'ausente'})`);
        return responder(res, 204, 'text/plain');
      }
      const curso = cursos.get(nombre);
      if (!curso) return json(res, 404, { error: 'Curso no encontrado' });
      if (req.method === 'GET' && !api[2]) {
        return json(res, 200, {
          nombre: curso.nombre,
          cantidad: curso.edades.length,
        });
      }
      if (req.method === 'POST' && api[2]) {
        const datos = await leerJson(req);
        if (modo === 'correcto') {
          if (!Number.isInteger(datos.edad) || datos.edad < 18 || datos.edad > 120) {
            return json(res, 422, {
              error: 'La edad debe estar entre 18 y 120 años.',
            });
          }
        } else {
          if (!Number.isInteger(datos.edad) || datos.edad <= 18 || datos.edad > 120) {
            return json(res, 422, {
              error: 'La edad debe estar entre 18 y 120 años.',
            });
          }
        }
        await esperar(demora);
        curso.edades.push(datos.edad);
        return json(res, 201, {
          mensaje: `Inscripción aceptada: ${datos.edad} años.`,
          cantidad: curso.edades.length,
        });
      }
    }

    const pagina = ruta.match(/^\/cursos\/([^/]+)\/inscripcion$/);
    if (req.method === 'GET' && pagina) {
      const nombre = decodeURIComponent(pagina[1]);
      if (!cursos.has(nombre)) {
        return responder(res, 404, 'text/plain', 'Curso no encontrado');
      }
      return responder(res, 200, 'text/html', vista);
    }
    responder(res, 404, 'text/plain', 'Ruta no encontrada');
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      json(res, 500, { error: 'No se pudo procesar la operación de práctica' });
    } else {
      res.end();
    }
  }
});

servidor.listen(4179, '127.0.0.1', () => {
  console.log(`Servidor clase-9-v1 en ${origen} — modo ${modo}`);
});
```

### Archivo completo: practica-clase-9/inscripcion.html

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Inscripción · Clase 9</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1rem; }
    label, button { display: block; margin-top: 1rem; }
    input, button { font: inherit; padding: .5rem; }
    [role="alert"] { color: #a31515; }
  </style>
</head>
<body>
  <main>
    <h1>Inscripción</h1>
    <p>Curso: <span data-testid="curso"></span></p>
    <p>Inscripciones guardadas: <span data-testid="total">—</span></p>
    <p>Se aceptan edades enteras entre 18 y 120 inclusive.</p>
    <form id="formulario">
      <label for="edad">Edad</label>
      <input id="edad" name="edad" type="number" step="1" required>
      <button type="submit" disabled>Enviar inscripción</button>
    </form>
    <p id="confirmacion" role="status" hidden></p>
    <p id="error" role="alert" hidden></p>
  </main>
  <script>
    const nombre = decodeURIComponent(location.pathname.split('/')[2]);
    const api = '/api/cursos/' + encodeURIComponent(nombre);
    const formulario = document.querySelector('#formulario');
    const edad = document.querySelector('#edad');
    const enviar = document.querySelector('button');
    const total = document.querySelector('[data-testid="total"]');
    const confirmacion = document.querySelector('#confirmacion');
    const error = document.querySelector('#error');
    document.querySelector('[data-testid="curso"]').textContent = nombre;

    function mostrarError(mensaje) {
      error.textContent = mensaje;
      error.hidden = false;
    }

    async function cargarCurso() {
      try {
        const respuesta = await fetch(api);
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.error);
        total.textContent = String(datos.cantidad);
        enviar.disabled = false;
      } catch (fallo) {
        mostrarError(fallo.message);
      }
    }

    formulario.addEventListener('submit', async event => {
      event.preventDefault();
      enviar.disabled = true;
      confirmacion.hidden = true;
      confirmacion.textContent = '';
      error.hidden = true;
      error.textContent = '';
      try {
        const respuesta = await fetch(api + '/inscripciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ edad: Number(edad.value) }),
        });
        const datos = await respuesta.json();
        console.info(`Inscripción: edad=${edad.value}; HTTP=${respuesta.status}`);
        if (!respuesta.ok) {
          mostrarError(datos.error);
          return;
        }
        total.textContent = String(datos.cantidad);
        confirmacion.textContent = datos.mensaje;
        confirmacion.hidden = false;
      } catch {
        mostrarError('No se pudo enviar la inscripción');
      } finally {
        enviar.disabled = false;
      }
    });

    cargarCurso();
  </script>
</body>
</html>
```

El campo de edad no declara `min` ni `max`: la validación del intervalo se realiza en el servidor. En el ejercicio enviamos 18, que la regla considera válido, y examinamos la respuesta. El navegador conserva la validación de número entero y campo obligatorio.

## 3. Configuración de ejecución y evidencia

`outputDir` indica dónde guardar los archivos de cada resultado. El reporter `list` escribe en la terminal; `html` crea el reporte en `outputFolder`. `open: 'never'` evita que se abra automáticamente al terminar.

En `use`, `screenshot: 'only-on-failure'` toma una captura si falla el test. `video` y `trace` con `retain-on-failure` registran cada intento y conservan los fallidos. El video termina de guardarse al cerrar el contexto; revisarlo una vez finalizada la ejecución. Esta configuración conserva las tres evidencias para que puedas compararlas durante la práctica. No es una política obligatoria para todos los proyectos.

Los límites son 30 segundos por test y 5 segundos por assertion y por acción. `retries: 0` permite observar primero el fallo original. Dos workers y `fullyParallel: true` conservan la independencia trabajada en clase 8.

### Archivo completo: playwright.clase-9.config.ts

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/clase-9',
  outputDir: 'test-results/clase-9',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: 0,
  workers: 2,
  fullyParallel: true,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/clase-9', open: 'never' }],
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
});
```

## 4. Modelo de la vista

`InscripcionPage` conserva los localizadores y las operaciones de clase 8. Recibe la página del caso y no decide si una edad debe aceptarse. El spec conserva sus comprobaciones y su limpieza con `try/finally`.

### Archivo completo: pages/clase-9/inscripcion-page.ts

```ts
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
```

## 5. Preparación y limpieza del curso

`request` es la fixture incorporada para enviar peticiones HTTP. Estos helpers crean y borran el curso del caso. `crearCurso` genera un UUID, un identificador aleatorio nuevo, y lo incorpora al nombre del curso; `randomUUID` viene con Node.js. La creación debe responder 201. El borrado responde 204, también si el curso ya estaba ausente: repetir esa limpieza no cambia el resultado. Un fallo inesperado se informa.

### Archivo completo: helpers/clase-9/cursos.ts

```ts
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';

export type Curso = {
  nombre: string;
};

export async function crearCurso(request: APIRequestContext): Promise<Curso> {
  const nombre = `curso-${randomUUID()}`;
  const respuesta = await request.post('/api/cursos', {
    data: { nombre },
  });
  await expect(
    respuesta.status(),
    `Debe crearse un curso propio: ${nombre}`,
  ).toBe(201);
  return { nombre };
}

export async function borrarCurso(
  request: APIRequestContext,
  curso: Curso,
) {
  const nombre = encodeURIComponent(curso.nombre);
  const respuesta = await request.delete(`/api/cursos/${nombre}`);
  await expect(
    respuesta.status(),
    `Debe limpiarse el curso propio: ${curso.nombre}`,
  ).toBe(204);
}
```

## 6. Mensajes de diagnóstico

Retomamos los helpers y el `try/finally` de clase 8: cada test llama a `crearCurso`, abre el modelo y llama a `borrarCurso` en su `finally`. El helper siguiente solo registra mensajes. Se llama dentro del `try`, antes de abrir la vista.

El segundo parámetro de la función del test, `testInfo`, contiene información de esa ejecución. `title` identifica el caso; `retry` vale **0 en el intento inicial, 1 en el primer reintento** y así sucesivamente. El test pasa ese objeto al helper para relacionar cada intento con su curso. No cambia las expectativas.

`page.on` registra una función que se ejecuta cuando ocurre el evento indicado. `console` recoge los mensajes de la página; `pageerror`, los errores de JavaScript no manejados por ella. Los enviamos a la terminal y quedan asociados al test en el reporte. Un mensaje de consola no hace fallar por sí solo una assertion.

### Archivo completo: helpers/clase-9/diagnostico.ts

```ts
import type { Page, TestInfo } from '@playwright/test';
import type { Curso } from './cursos';

export function registrarDiagnostico(page: Page, testInfo: TestInfo, curso: Curso) {
  console.log(
    `[caso] ${testInfo.title}; intento=${testInfo.retry}; curso=${curso.nombre}`,
  );
  page.on('console', mensaje => {
    console.log(`[browser:${mensaje.type()}] ${mensaje.text()}`);
  });
  page.on('pageerror', error => {
    console.error(`[pageerror] ${error.message}`);
  });
}
```

## 7. Casos para investigar

`C-DIAG-01` comprueba la aceptación del máximo válido, 120. `C-DIAG-02` comprueba la aceptación del mínimo válido, 18. Ambos vuelven a cargar la vista para verificar que su inscripción sigue guardada. Los cursos son distintos; ninguno depende del otro caso.

En el modo defectuoso, el segundo test se detiene al esperar el texto de confirmación de los 18 años. La aplicación muestra un rechazo y el contador queda en cero. Las comprobaciones posteriores del test no llegan a ejecutarse: ese estado de la página y la respuesta HTTP se investigan en la evidencia; no damos esas assertions por aprobadas.

### Archivo completo: tests/clase-9/diagnostico.spec.ts

```ts
import { test, expect } from '@playwright/test';
import { InscripcionPage } from '../../pages/clase-9/inscripcion-page';
import { crearCurso, borrarCurso } from '../../helpers/clase-9/cursos';
import { registrarDiagnostico } from '../../helpers/clase-9/diagnostico';

test.describe('Diagnóstico de los límites de edad', () => {
  test('C-DIAG-01: acepta 120 años y conserva la inscripción',
    async ({ page, request }, testInfo) => {
      const curso = await crearCurso(request);
      try {
        registrarDiagnostico(page, testInfo, curso);
        const inscripcion = new InscripcionPage(page);
        await inscripcion.goto(curso.nombre);
        await expect(inscripcion.curso).toHaveText(curso.nombre);
        await expect(inscripcion.total).toHaveText('0');

        await inscripcion.enviarEdad(120);
        await expect(inscripcion.confirmacion).toHaveText(
          'Inscripción aceptada: 120 años.',
        );
        await expect(inscripcion.alerta).toBeHidden();
        await expect(inscripcion.total).toHaveText('1');

        await inscripcion.goto(curso.nombre);
        await expect(inscripcion.total).toHaveText('1');
      } finally {
        await borrarCurso(request, curso);
      }
    },
  );

  test('C-DIAG-02: acepta 18 años y conserva la inscripción',
    async ({ page, request }, testInfo) => {
      const curso = await crearCurso(request);
      try {
        registrarDiagnostico(page, testInfo, curso);
        const inscripcion = new InscripcionPage(page);
        await inscripcion.goto(curso.nombre);
        await expect(inscripcion.curso).toHaveText(curso.nombre);
        await expect(inscripcion.total).toHaveText('0');

        await inscripcion.enviarEdad(18);
        await expect(inscripcion.confirmacion).toHaveText(
          'Inscripción aceptada: 18 años.',
        );
        await expect(inscripcion.alerta).toBeHidden();
        await expect(inscripcion.total).toHaveText('1');

        await inscripcion.goto(curso.nombre);
        await expect(inscripcion.total).toHaveText('1');
      } finally {
        await borrarCurso(request, curso);
      }
    },
  );
});
```

## 8. Establecer la ejecución de referencia

Desde la raíz de `practica-playwright`, iniciar el servidor en una terminal:

```sh
node practica-clase-9/servidor.cjs correcto
```

En otra terminal:

```sh
npx playwright test -c playwright.clase-9.config.ts --list
npx playwright test -c playwright.clase-9.config.ts
```

Se esperan **2 tests en 1 archivo** y después **2 passed**. La raíz `http://127.0.0.1:4179/` informa `clase-9-v1` y el modo activo.

Consultar la limpieza, sin reiniciar el servidor:

```sh
node --input-type=module -e '
const respuesta = await fetch("http://127.0.0.1:4179/api/cursos");
if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
console.log(await respuesta.json());
'
```

Se espera **`[]`** después de cada ejecución, también de las fallidas. La limpieza ocurre después de observar el fallo; borrar el curso no borra los archivos de evidencia ya registrados.

## 9. Investigar un localizador y observar la ejecución

### 9.1. Provocar y leer el fallo del test

Con el servidor en modo `correcto`, en el constructor de `pages/clase-9/inscripcion-page.ts`, cambiar temporalmente **solo** el nombre del botón:

```ts
this.enviar = page.getByRole('button', {
  name: 'Guardar inscripción', exact: true,
});
```

Ejecutar el caso válido:

```sh
npx playwright test -c playwright.clase-9.config.ts --grep C-DIAG-01
```

Debe fallar la acción `click`, que busca un botón inexistente. Leer archivo, línea y **call log**, el registro de lo que intentó hacer la acción. La página muestra «Enviar inscripción». No cambiar el esperado de la edad ni agregar una espera fija.

### 9.2. Abrir Inspector

```sh
npx playwright test -c playwright.clase-9.config.ts --grep C-DIAG-01 --debug
```

`--debug` abre el navegador y Playwright Inspector, limita a un worker y quita el límite global del test. El modo de inspección también cambia los límites de espera para permitir las pausas. Confirmar el resultado y los tiempos con una corrida normal.

Avanzar hasta la vista de inscripción. Usar la inspección de localizadores para contrastar `Guardar inscripción` con `Enviar inscripción`. Verificar que el segundo encuentra un único botón y revisar si está habilitado. Ensayar un localizador dentro de Inspector no guarda automáticamente el cambio en el archivo.

Cerrar la ejecución interactiva, restaurar **`name: 'Enviar inscripción', exact: true`** en el modelo y ejecutar de nuevo sin `--debug`. Se espera **1 passed**. Guardar la salida anterior si se quiere comparar: una ejecución nueva reemplaza el reporte y los archivos de resultados de esta práctica.

### 9.3. Pausar en una línea concreta

En `C-DIAG-01`, agregar una pausa **dentro del `try`, después de comprobar el total cero y antes** de enviar 120. `page` ya es un argumento del test. Este es un fragmento temporal dentro del test; conservar las comprobaciones completas de la sección 7:

```ts
await page.pause();
await inscripcion.enviarEdad(120);
```

Ejecutar con el comando `--debug` anterior. Reanudar desde Inspector para llegar a la pausa y observar el curso, el total cero y el botón. Continuar la ejecución. Después quitar solo `page.pause()`. Una pausa interactiva requiere a una persona para continuar y no debe quedar en la versión final.

Con la extensión oficial **Playwright Test for VS Code** ya instalada, también se puede seleccionar `playwright.clase-9.config.ts` en el panel de pruebas, colocar un breakpoint junto a la línea de `enviarEdad(120)` y elegir **Debug Test**. El depurador del editor permite inspeccionar variables como `curso.nombre`. Quitar el breakpoint al terminar. Esta alternativa no es un requisito para ejecutar el material desde la terminal.

### 9.4. Usar UI Mode

Con el modelo y el spec restaurados:

```sh
npx playwright test -c playwright.clase-9.config.ts --ui
```

Desplegar `diagnostico.spec.ts` y el grupo «Diagnóstico de los límites de edad» si están contraídos. Seleccionar `C-DIAG-01`, ejecutarlo y recorrer sus acciones y el estado de la página en la línea de tiempo. La línea de tiempo permite volver a lo que se registró en esa ejecución; no modifica el servidor ni deshace una inscripción. UI Mode también permite volver a ejecutar al editar archivos. Cerrar su ventana y detener el proceso antes de continuar con las corridas de terminal.

## 10. Provocar un defecto y consultar la evidencia

Detener el servidor con Control+C. Iniciar la variante defectuosa:

```sh
node practica-clase-9/servidor.cjs defecto
```

Comprobar el modo en la raíz y ejecutar **sin cambiar los tests**:

```sh
npx playwright test -c playwright.clase-9.config.ts
```

Se esperan **1 failed y 1 passed**. `C-DIAG-02` falla porque no aparece el texto de confirmación esperado para los 18 años. La aplicación muestra «La edad debe estar entre 18 y 120 años.» y total 0. El caso de 120 sigue pasando. La regla exige aceptar 18 en ambos modos; el rechazo es el defecto que estamos investigando.

Abrir el reporte generado:

```sh
npx playwright show-report playwright-report/clase-9
```

Este comando sirve el reporte existente; no ejecuta tests. En el reporte, filtrar **Failed**, abrir `C-DIAG-02` y revisar error, línea, pasos y adjuntos. La captura muestra el estado final; el video permite observar el envío y el mensaje de rechazo. La traza reúne también las acciones, el DOM y la red. El reporte tiene enlaces a estas evidencias.

En Trace Viewer:

1. Ubicar el envío de 18 y la assertion que espera el texto de confirmación.
2. Revisar la página y el localizador de la confirmación en ese momento. La alerta visible y el contador en cero son observaciones de la evidencia; las assertions posteriores al fallo no se ejecutaron.
3. Abrir la petición `POST /api/cursos/.../inscripciones` en **Network**, el panel de red. Comprobar el cuerpo con `edad: 18`, la respuesta **422** y el campo `error` con «La edad debe estar entre 18 y 120 años.». Esa respuesta de rechazo no contiene `mensaje` ni `cantidad`.
4. Revisar **Console**, los mensajes de consola, y **Source**, el código fuente asociado al paso. Relacionar el esperado con la regla, no con el mensaje que devolvió el producto.

El 422 indica que esta aplicación rechazó la inscripción por su validación. La edad enviada es 18 y cumple el mínimo, pero la variante defectuosa la considera inválida. La confirmación nunca apareció porque el servidor rechazó la operación. Un video o una captura aislada no mostrarían por sí solos esa respuesta de red.

En la terminal y en la salida del test se podrá localizar este mensaje de nuestra aplicación:

```text
[browser:info] Inscripción: edad=18; HTTP=422
```

El log orienta hacia la respuesta; la traza permite contrastarlo con la petición y su cuerpo. La ausencia de `pageerror` no demuestra que el comportamiento sea correcto.

También se puede abrir un archivo de traza por comando. Copiar primero su ruta real desde el resultado. Esta línea es una **plantilla**: reemplazar `CARPETA-DEL-RESULTADO` por la carpeta de ese intento; no ejecutar el nombre literal:

```sh
npx playwright show-trace "test-results/clase-9/CARPETA-DEL-RESULTADO/trace.zip"
```

Los nombres de carpetas los genera Playwright a partir del test y del intento; no fijarlos en el código. Al terminar de consultar, detener `show-report` o cerrar Trace Viewer y su proceso.

**Conservar una ejecución:** antes de correr otro comando de tests, copiar desde el explorador de archivos las carpetas completas `playwright-report/clase-9` y `test-results/clase-9` a una ubicación con nombre propio, por ejemplo `evidencias-clase-9/defecto-inicial/`. Abrir la copia del reporte apuntando a su carpeta. No mover únicamente `index.html`, porque usa archivos vecinos. Los próximos tests reemplazan las salidas activas.

Las evidencias de esta práctica contienen datos ficticios. Antes de compartir una evidencia de otro entorno, revisar qué datos, URLs y sesiones incluye y quién puede acceder; conservarla durante el tiempo necesario para la investigación.

## 11. Captura puntual con un adjunto propio — opcional

Un **adjunto** es un archivo asociado a un resultado del test. `testInfo.outputPath` construye una ruta dentro de la carpeta de ese test e intento; `testInfo.attach` incorpora el archivo al reporte con un nombre y un tipo de contenido. Así no usamos una ruta fija que distintos workers puedan sobrescribir.

Con el servidor en modo `correcto`, en el `try` de `C-DIAG-01`, después de comprobar el total 1 y antes de volver a cargar la vista, agregar este bloque. `page` y `testInfo` ya son argumentos del test:

```ts
const ruta = testInfo.outputPath('inscripcion-120.png');
await page.screenshot({ path: ruta, fullPage: true });
await testInfo.attach('Inscripción de 120 años', {
  path: ruta,
  contentType: 'image/png',
});
```

Ejecutar solo ese caso y abrir su reporte:

```sh
npx playwright test -c playwright.clase-9.config.ts --grep C-DIAG-01
npx playwright show-report playwright-report/clase-9
```

Se espera **1 passed** y un adjunto llamado **Inscripción de 120 años** en el resultado de ese caso. Esta captura explícita se conserva aunque el caso pase; la opción automática `only-on-failure` no elimina un archivo que adjuntaste. Después quitar el bloque y cerrar el visor del reporte con Control+C. No es una comparación visual automática con una imagen de referencia.

## 12. Timeouts y reintentos

### 12.1. Mantener el significado de cada límite

| Configuración | Qué limita en esta práctica |
|---|---|
| `timeout: 30_000` | El cuerpo del test, incluida la creación del curso y la limpieza del `finally`. Playwright administra además el desmontaje de las fixtures incorporadas. |
| `expect: { timeout: 5_000 }` | Cada assertion web-first que espera una condición. |
| `actionTimeout: 5_000` en `use` | Cada acción, por ejemplo el click que no encuentra el botón. |

Si la aplicación rechazó 18, esperar más no transforma ese rechazo en una aceptación. El timeout informa que la condición no se cumplió a tiempo; la evidencia permite investigar por qué. Las pausas y el modo debug alteran la ejecución, por lo que la confirmación final se hace en modo normal.

### 12.2. Reintentar el defecto persistente

Con el servidor en modo `defecto`, el modelo correcto y el spec original:

```sh
npx playwright test -c playwright.clase-9.config.ts --grep C-DIAG-02 --retries=1
```

Se esperan **dos intentos fallidos del mismo test** y el resumen **1 failed**. `--retries=1` agrega un reintento al inicial; no agrega un segundo caso. Al fallar se descarta el worker y el reintento recibe otra página y ejecuta de nuevo todo el cuerpo del test, incluida la creación de otro curso. El proceso del servidor sigue activo y en modo `defecto`.

Abrir el reporte y comparar ambos intentos, sus mensajes y sus cursos. Con `trace: 'retain-on-failure'` se conservan las dos trazas. Consultar la limpieza: debe dar `[]`.

Para probar otra política sin editar la configuración:

```sh
npx playwright test -c playwright.clase-9.config.ts --grep C-DIAG-02 --retries=1 --trace=on-first-retry
```

`on-first-retry` registra **solo el primer reintento**, pase o falle. No conserva una traza del intento inicial. Si se combina con `--retries=0`, ningún reintento ocurre y esa política no genera trazas. La configuración original usa `retain-on-failure` para conservar el fallo inicial; mantener ese valor al terminar el ejercicio.

### 12.3. Reconocer un resultado flaky — simulación opcional

Esta simulación provoca una diferencia entre intentos de forma deliberada; no descubre una intermitencia real del producto.

Volver al servidor en modo `correcto`. Solo en `C-DIAG-01`, al final del `try`, después de sus comprobaciones originales y antes del `finally`, agregar:

```ts
if (testInfo.retry === 0) {
  throw new Error('Fallo simulado solo en el intento inicial.');
}
```

`testInfo` ya es el segundo argumento del test. El error sale del `try`, se ejecuta la limpieza del `finally` y Playwright registra el fallo. Las assertions de la inscripción se mantienen iguales en ambos intentos. Ejecutar:

```sh
npx playwright test -c playwright.clase-9.config.ts --grep C-DIAG-01 --retries=1
```

El primer intento falla por el error agregado y el siguiente pasa: el resumen debe indicar **1 flaky**. El reporte conserva el intento fallido y el reintento exitoso. Por defecto, un resultado flaky no hace que el proceso termine con error; la clasificación sigue siendo visible y requiere investigación. Aquí conocemos la causa porque la agregamos.

Guardar una copia del reporte para poder comparar el intento fallido con el exitoso. **Quitar solo el bloque `if`** antes de seguir y ejecutar el caso otra vez sin `--retries=1`: se espera **1 passed** en el intento inicial. No usar ese patrón para omitir verificaciones ni para cambiar lo esperado en un reintento.

## 13. Reporte de defecto del ejemplo

La **severidad** describe el impacto del problema. La **prioridad** indica cuándo conviene resolverlo respecto de otros trabajos y se acuerda con el equipo. Un test fallido no asigna automáticamente ninguna de las dos.

Usar el siguiente reporte como referencia para escribir el tuyo a partir de los resultados que obtuviste. Corresponde a la variante defectuosa de esta aplicación de práctica; no describe un defecto de Learn-up. Completar las versiones de tu ejecución, comprobar la frecuencia observada y adjuntar tu evidencia con el nombre del intento. `npx playwright --version` permite consultar la versión de la herramienta.

```text
ID: DEF-EDAD-01
Título: Se rechaza una inscripción con 18 años aunque cumple la edad mínima
Estado: abierto para la práctica

Entorno: aplicación local clase-9-v1, modo defecto, Chromium.
Completar Node.js, Playwright y sistema operativo de la ejecución adjunta.
Base de prueba: se aceptan edades enteras entre 18 y 120 inclusive.
Caso: C-DIAG-02, tests/clase-9/diagnostico.spec.ts.

Precondiciones: servidor activo en 127.0.0.1:4179, modo defecto;
curso propio y vacío, creado por el helper antes del try del caso.
Dato: edad entera 18, ficticia.

Reproducción automática desde practica-playwright:
npx playwright test -c playwright.clase-9.config.ts --grep C-DIAG-02 --retries=1

Pasos del caso:
1. Abrir la inscripción del curso preparado.
2. Completar Edad con 18.
3. Accionar Enviar inscripción.
4. Observar el mensaje, el total y la respuesta del envío.

Esperado: aceptación con “Inscripción aceptada: 18 años.”,
total 1 y una inscripción que permanece al volver a cargar la vista.
Real: “La edad debe estar entre 18 y 120 años.”, total visible 0;
POST de inscripción con edad 18 responde 422 y un campo error con ese mensaje.
La assertion que espera el texto de confirmación vence;
las comprobaciones posteriores, incluida la recarga, no se ejecutan.

Frecuencia: reproducido en el inicial y el reintento de la corrida adjunta
(2/2 intentos). Un curso distinto en cada uno.
Impacto: una persona que cumple la edad mínima no puede inscribirse.
Severidad propuesta para el ejercicio: media por impedir una inscripción válida.
Prioridad: pendiente de acordar según el uso y el riesgo del producto.

Evidencia: reporte HTML, traza y captura de C-DIAG-02,
identificadas por la ejecución y el intento adjuntos.
Limpieza: el curso de cada intento se elimina al terminar.
```

Una persona puede reproducir el problema con los siete archivos, el comando de inicio en modo `defecto` y el comando del reporte. Si se investiga una aplicación real, reemplazar la versión ficticia y el modo por la versión y el entorno afectados.

## 14. Restaurar y confirmar la corrección

Una **prueba de regresión** vuelve a comprobar comportamientos cubiertos después de un cambio, para buscar efectos no deseados. En este ejercicio confirmamos la aceptación de 18 y conservamos la aceptación de 120.

1. Restaurar el botón `Enviar inscripción` en el modelo.
2. Quitar `page.pause()`, el error simulado y el bloque opcional de captura. Conservar los argumentos originales `page`, `request` y `testInfo`.
3. Detener el servidor defectuoso y arrancar `node practica-clase-9/servidor.cjs correcto`.
4. Mantener la configuración original: `retries: 0` y `trace: 'retain-on-failure'`.

Ejecutar:

```sh
npx playwright test -c playwright.clase-9.config.ts --grep C-DIAG-02
npx playwright test -c playwright.clase-9.config.ts
npx playwright test -c playwright.clase-9.config.ts --repeat-each=3
```

Se esperan **1 passed**, **2 passed** y **6 passed**, respectivamente. Consultar `/api/cursos` con el comando de la sección 8: se espera `[]` sin reiniciar. Repetir aumenta la observación de estos casos, pero no demuestra que la aplicación esté libre de defectos.

El cambio a `correcto` representa aquí la versión que cumple la regla. La expectativa se mantiene: 18 debe aceptarse. La corrección está en la validación del servidor, no en cambiar el test para que espere un rechazo. En un producto real se volvería a probar la versión corregida y se actualizaría el estado del defecto con su evidencia.

Después completar las lecciones, preguntas y laboratorios de **6.1, 6.2 y 6.3** en Learn-up. El laboratorio 6.1 usa otra aplicación, con la fila «Proyecto Alfa»; el criterio de inspeccionar y delimitar el localizador es el mismo. El laboratorio 6.2 propone `on-first-retry`: hace falta habilitar al menos un reintento para que se genere esa traza. El de 6.3 usa un checkout para practicar los campos del reporte.

Al terminar, detener el servidor de la aplicación y los procesos de Inspector, UI Mode, reporte o traza que sigan abiertos.

## Referencias

APIs contrastadas con la documentación oficial de Playwright Test 1.64.1 el 2026-11-15. Las secciones anteriores contienen los archivos completos, los ejercicios y las comprobaciones para repetir la práctica.

- [Depuración e Inspector](https://playwright.dev/docs/debug), [extensión de VS Code](https://playwright.dev/docs/getting-started-vscode) y [UI Mode](https://playwright.dev/docs/test-ui-mode).
- [Opciones de evidencia](https://playwright.dev/docs/test-use-options#recording-options), [capturas](https://playwright.dev/docs/screenshots), [videos](https://playwright.dev/docs/videos) y [Trace Viewer](https://playwright.dev/docs/trace-viewer).
- [Reporters](https://playwright.dev/docs/test-reporters), [timeouts](https://playwright.dev/docs/test-timeouts), [reintentos](https://playwright.dev/docs/test-retries) y [CLI](https://playwright.dev/docs/test-cli).
- [`testInfo.retry`](https://playwright.dev/docs/api/class-testinfo#test-info-retry), [`outputPath`](https://playwright.dev/docs/api/class-testinfo#test-info-output-path) y [`attach`](https://playwright.dev/docs/api/class-testinfo#test-info-attach).
