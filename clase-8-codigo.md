# Clase 8 — Código para datos, preparación y ejecución paralela

Esta guía reúne los archivos completos, los comandos y los ejercicios para practicar por tu cuenta en `practica-playwright`. Podés seguirla en orden para ejecutar los tests, observar el formulario y comprobar la preparación y la limpieza de sus datos.

**Alcance:** D5 / 5.3–5.4. Parametrización, títulos únicos, datos de prueba, fixtures incorporadas, helpers y preparación y limpieza con `try/finally`, workers, aislamiento y colisiones. Retomamos la separación entre modelos, preparación y expectativas de clase 7 con una nueva regla: se aceptan inscripciones con edades enteras entre **18 y 120 inclusive**.

La aplicación agrupa las inscripciones en cursos. Cada test recibe un curso nuevo, inicialmente vacío, y lo elimina al terminar. Los cursos viven en la memoria del servidor, fuera del navegador: cerrar una página o su contexto no los borra. Detener el servidor sí los elimina. Son datos ficticios; esta práctica no necesita cuentas ni credenciales.

## 1. Preparación y estructura

Usar el proyecto `practica-playwright` de clase 3 con Playwright Test y Chromium instalados. Conservar los archivos de las clases anteriores y su configuración. No se agregan dependencias. Para preparar otro equipo, seguir la [guía de clase 3](../playwright-class-3/clase-3-codigo.md), que recomienda Node.js 24 LTS.

Crear los siguientes **ocho archivos completos** desde el editor:

```text
practica-playwright/
  practica-clase-8/
    servidor.cjs
    inscripcion.html
  data/clase-8/casos-edad.ts
  pages/clase-8/inscripcion-page.ts
  helpers/clase-8/cursos.ts
  tests/clase-8/
    limites.spec.ts
    resumen.spec.ts
  playwright.clase-8.config.ts
  playwright.config.ts           (se conserva)
  package.json                   (se conserva)
  package-lock.json              (se conserva)
```

La configuración selecciona solo esta práctica y usa el puerto **4178**. Pasar `-c playwright.clase-8.config.ts` en cada ejecución. Copiar los ocho archivos completos en las rutas indicadas; los fragmentos de los ejercicios posteriores muestran cambios puntuales sobre esos archivos.

## 2. Aplicación de soporte

Esta aplicación de soporte se preparó para la clase 8 y es independiente de Learn-up y de la práctica de clase 7. Usa el patrón de Page Object Model y un formulario que permite observar límites de edad y datos que sobreviven al cierre del navegador. El servidor y el HTML ya resuelven la aplicación; los ejercicios se concentran en los datos y los tests.

El curso actúa como espacio de datos de un test. Un nombre repetido recibe HTTP **409**, porque ya existe. El servidor ofrece operaciones de preparación y limpieza para los tests: crear, consultar y borrar cursos. Borrar un curso inexistente también responde **204**; ese contrato hace idempotente la limpieza de esta práctica.

### Archivo completo: practica-clase-8/servidor.cjs

```js
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { setTimeout: esperar } = require('node:timers/promises');

const origen = 'http://127.0.0.1:4178';
const demora = Number(process.argv[2] ?? 200);
if (!Number.isInteger(demora) || demora < 0 || demora > 10000) {
  throw new Error('La demora debe ser un entero entre 0 y 10000 ms.');
}
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
        'Práctica de clase 8. Ejecutá los tests para crear sus cursos.');
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
        if (!Number.isInteger(datos.edad) || datos.edad < 18 || datos.edad > 120) {
          return json(res, 422, {
            error: 'La edad debe estar entre 18 y 120 años.',
          });
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

servidor.listen(4178, '127.0.0.1', () => {
  console.log(`Servidor en ${origen} — demora de las altas: ${demora} ms`);
});
```

### Archivo completo: practica-clase-8/inscripcion.html

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Inscripción · Práctica de Playwright</title>
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

El campo no declara `min` ni `max`: enviamos también 17 y 121 para comprobar el rechazo de la aplicación. La regla está implementada en el servidor. El navegador sigue validando que se ingrese un número entero no vacío.

## 3. Archivo completo: playwright.clase-8.config.ts

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/clase-8',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 2,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4178',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

Esta es la versión final: hasta dos workers y tests independientes que pueden ejecutarse en paralelo incluso dentro de un archivo. En el ejercicio de la sección 11.3 se cambia temporalmente `fullyParallel` a `false` para comparar el comportamiento y después se restaura `true`. El límite de workers no garantiza que siempre haya dos ocupados ni que el tiempo total se reduzca a la mitad.

## 4. Archivo completo: data/clase-8/casos-edad.ts

```ts
type CasoEdad = {
  readonly id: string;
  readonly edad: number;
  readonly motivo: string;
  readonly aceptada: boolean;
};

export const casosEdad: readonly CasoEdad[] = [
  { id: 'C-EDAD-17', edad: 17, motivo: 'inferior al mínimo', aceptada: false },
  { id: 'C-EDAD-18', edad: 18, motivo: 'mínimo válido', aceptada: true },
  { id: 'C-EDAD-120', edad: 120, motivo: 'máximo válido', aceptada: true },
  { id: 'C-EDAD-121', edad: 121, motivo: 'superior al máximo', aceptada: false },
];
```

Cada fila representa un límite o su vecino exterior. La expectativa se decide a partir de la regla, antes de consultar la aplicación. No calculamos `aceptada` con la misma función que estamos probando. Estos cuatro valores no cubren todos los requisitos posibles: otras reglas podrían exigir decimales, vacíos, formatos o más datos.

`readonly` ayuda a evitar cambios accidentales desde TypeScript. Los tests leen estas filas; no las usan para guardar resultados de ejecución. No equivale a congelar los objetos en JavaScript.

## 5. Archivo completo: pages/clase-8/inscripcion-page.ts

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

Retomamos el patrón de clase 7: el modelo conoce la interfaz y sus operaciones. El constructor recibe la `page` del caso. `enviarEdad()` sirve tanto para aceptación como para rechazo; las expectativas de cada fila quedan en el spec.

## 6. Helpers de preparación y limpieza

`crearCurso` genera un UUID, un identificador aleatorio nuevo, con `randomUUID` de `node:crypto`. Lo usa como parte del nombre de cada curso temporal. `Curso` describe el objeto con `nombre` que devuelve la creación.

### Archivo completo: helpers/clase-8/cursos.ts

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

`request` es una fixture incorporada de Playwright para enviar peticiones HTTP; usa la `baseURL` configurada. Aquí permite preparar y limpiar datos sin repetir esos pasos por la interfaz. `post` crea el curso y `delete` lo elimina. Las comprobaciones del helper validan esas operaciones de soporte; el comportamiento de inscripción se comprueba por la interfaz en los specs.

El contrato de creación exige 201. Un 409 no significa que el caso pueda apropiarse del curso de otro. La limpieza solo debe ejecutarse sobre el recurso cuya creación confirmó este caso. El helper no ignora un fallo inesperado de borrado.

## 7. El ciclo queda dentro de cada test

Los specs importan `test` y `expect` directamente de `@playwright/test`. Piden las fixtures incorporadas `page` y `request`: Playwright prepara la página y el acceso HTTP de cada caso. `curso` e `inscripcion` son variables locales que creamos con llamadas normales a funciones.

Este fragmento resume el patrón; los dos archivos de las secciones siguientes lo contienen completo:

```ts
const curso = await crearCurso(request);
try {
  const inscripcion = new InscripcionPage(page);
  await inscripcion.goto(curso.nombre);
  // Comprobar las precondiciones, actuar y verificar el resultado.
} finally {
  await borrarCurso(request, curso);
}
```

`try` contiene lo que hacemos con el curso creado. `finally` se ejecuta al salir de ese bloque, también si una acción o una assertion lanza un error. No captura el fallo ni lo convierte en éxito. El modelo se construye y abre dentro del `try`, de modo que un fallo al preparar la vista también lleva al borrado.

`crearCurso(request)` genera un nombre nuevo, envía `POST /api/cursos`, exige HTTP 201 y devuelve `{ nombre }`. La creación confirmada queda **antes del `try`**: si recibe 409, el caso no entra en ese bloque ni intenta borrar un curso ajeno. `borrarCurso(request, curso)` elimina solo el recurso que se creó y exige HTTP 204.

Repetimos este bloque breve en cada test para que la preparación, las acciones, las comprobaciones y la limpieza puedan leerse juntas. Los specs llaman directamente a los helpers e importan el `test` original de Playwright.

Una fixture personalizada permite pedir un recurso propio como argumento del test y que Playwright coordine su ciclo de vida. La lección 5.3 de Learn-up muestra esa alternativa; esta práctica usa llamadas explícitas y `try/finally`.

## 8. Archivo completo: tests/clase-8/limites.spec.ts

```ts
import { test, expect } from '@playwright/test';
import { InscripcionPage } from '../../pages/clase-8/inscripcion-page';
import { crearCurso, borrarCurso } from '../../helpers/clase-8/cursos';
import { casosEdad } from '../../data/clase-8/casos-edad';

test.describe('Límites de edad', () => {
  for (const caso of casosEdad) {
    test(`${caso.id}: edad ${caso.edad}, ${caso.motivo}`, async ({ page, request }) => {
      const curso = await crearCurso(request);
      try {
        const inscripcion = new InscripcionPage(page);
        await inscripcion.goto(curso.nombre);
        await expect(inscripcion.curso).toHaveText(curso.nombre);
        await expect(inscripcion.total).toHaveText('0');

        await inscripcion.enviarEdad(caso.edad);

        if (caso.aceptada) {
          await expect(inscripcion.confirmacion).toBeVisible();
          await expect(inscripcion.confirmacion).toHaveText(
            `Inscripción aceptada: ${caso.edad} años.`,
          );
          await expect(inscripcion.alerta).toBeHidden();
          await expect(inscripcion.total).toHaveText('1');
        } else {
          await expect(inscripcion.alerta).toBeVisible();
          await expect(inscripcion.alerta).toHaveText(
            'La edad debe estar entre 18 y 120 años.',
          );
          await expect(inscripcion.confirmacion).toBeHidden();
          await expect(inscripcion.total).toHaveText('0');
        }
      } finally {
        await borrarCurso(request, curso);
      }
    });
  }
});
```

El `for` se ejecuta al cargar el archivo y **declara cuatro tests**. No está dentro de la función de un único test. Cada fila tiene su resultado, curso propio, página y contexto. El rechazo de 17 y 121 es el comportamiento esperado; sus tests deben pasar.

El `if` depende de la expectativa declarada en la fila. No pregunta qué ocurrió en la aplicación para decidir qué validar. Las ramas siguen siendo breves y comprueban la consecuencia y el contador correspondiente. Si los recorridos fueran muy distintos, convendría expresarlos en tests separados.

## 9. Archivo completo: tests/clase-8/resumen.spec.ts

```ts
import { test, expect } from '@playwright/test';
import { InscripcionPage } from '../../pages/clase-8/inscripcion-page';
import { crearCurso, borrarCurso } from '../../helpers/clase-8/cursos';

test.describe('Datos propios del curso', () => {
  test('C-DATOS-01: empieza sin inscripciones anteriores', async ({ page, request }) => {
    const curso = await crearCurso(request);
    try {
      const inscripcion = new InscripcionPage(page);
      await inscripcion.goto(curso.nombre);
      await expect(inscripcion.curso).toHaveText(curso.nombre);

      await expect(inscripcion.total).toHaveText('0');
      await expect(inscripcion.confirmacion).toBeHidden();
      await expect(inscripcion.alerta).toBeHidden();
    } finally {
      await borrarCurso(request, curso);
    }
  });

  test('C-DATOS-02: conserva dos altas propias al volver a la vista',
    async ({ page, request }) => {
      const curso = await crearCurso(request);
      try {
        const inscripcion = new InscripcionPage(page);
        await inscripcion.goto(curso.nombre);
        await expect(inscripcion.curso).toHaveText(curso.nombre);
        await expect(inscripcion.total).toHaveText('0');

        await inscripcion.enviarEdad(18);
        await expect(inscripcion.confirmacion).toHaveText(
          'Inscripción aceptada: 18 años.',
        );
        await expect(inscripcion.total).toHaveText('1');

        await inscripcion.enviarEdad(120);
        await expect(inscripcion.confirmacion).toHaveText(
          'Inscripción aceptada: 120 años.',
        );
        await expect(inscripcion.total).toHaveText('2');

        await inscripcion.goto(curso.nombre);
        await expect(inscripcion.curso).toHaveText(curso.nombre);
        await expect(inscripcion.total).toHaveText('2');
        await expect(inscripcion.confirmacion).toBeHidden();
      } finally {
        await borrarCurso(request, curso);
      }
    },
  );
});
```

El segundo caso demuestra que sus datos siguen en el servidor al volver a cargar la vista. Todo ese recorrido pertenece a un solo test y a su propio curso. No necesita que `C-DATOS-01` ni un caso de límites hayan creado inscripciones antes.

## 10. Iniciar, listar, ejecutar y comprobar la limpieza

Desde la raíz de `practica-playwright`, mantener una terminal con el servidor:

```sh
node practica-clase-8/servidor.cjs 200
```

El argumento es la demora del servidor para las altas válidas, en milisegundos. No es un timeout del test. `http://127.0.0.1:4178/` muestra que la práctica está activa; los tests crean sus cursos y abren sus formularios. Control+C detiene el servidor y elimina todos sus datos de memoria.

En otra terminal, listar los tests sin ejecutarlos:

```sh
npx playwright test -c playwright.clase-8.config.ts --list
```

Se esperan **6 tests en 2 archivos**: cuatro límites y dos casos de datos propios. Listar no crea cursos ni abre navegadores.

Ejecutar con un worker y después con dos:

```sh
npx playwright test -c playwright.clase-8.config.ts --workers=1
npx playwright test -c playwright.clase-8.config.ts --workers=2
```

Cada ejecución debe dar **6 passed**. La versión final permite distribuir incluso los tests de un mismo archivo. El orden de inicio o finalización puede variar.

Seleccionar un caso y repetir la suite:

```sh
npx playwright test -c playwright.clase-8.config.ts --grep C-EDAD-18
npx playwright test -c playwright.clase-8.config.ts --grep C-DATOS-02
npx playwright test -c playwright.clase-8.config.ts --repeat-each=3 --workers=2
```

Los dos primeros comandos deben dar **1 passed** cada uno. La repetición debe dar **18 passed**, porque ejecuta tres veces cada uno de los seis tests. Es una comprobación de esta práctica; no demuestra ausencia de todas las posibles carreras.

Después de cada ejecución, consultar los cursos que siguen en el servidor con este comando de Node.js. Las comillas simples y los saltos forman un único comando en la terminal usada para esta práctica:

```sh
node --input-type=module -e '
const respuesta = await fetch("http://127.0.0.1:4178/api/cursos");
if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
console.log(await respuesta.json());
'
```

Con solo los datos de los tests, se espera **`[]`**. El servidor también registra `Creado`, `Limpieza` y, si ocurre, `Colisión` con el nombre implicado. No hace falta reiniciarlo entre ejecuciones normales: el finally de cada test debe dejarlo limpio.

`--headed` abre la ventana del navegador durante la ejecución. Los comandos anteriores usan el navegador sin ventana visible, el modo llamado **headless**. Para ver una ejecución o consultar el reporte de la última corrida:

```sh
npx playwright test -c playwright.clase-8.config.ts --grep C-EDAD-18 --headed
npx playwright show-report
```

El reporte contiene la última selección ejecutada. Detener el visor con Control+C al terminar. La investigación con trazas, Inspector y retries se desarrolla en clase 9.

## 11. Observar el formulario y practicar la ejecución

Abrir `data/clase-8/casos-edad.ts` y `tests/clase-8/limites.spec.ts`. Identificar las cuatro filas y el `for` que está alrededor de `test(...)`. Ejecutar el comando con `--list` de la sección 10 y comprobar que cada fila produce un título distinto entre los seis tests descubiertos.

### 11.1. Ver el formulario paso a paso

Para observar la interfaz mientras practicás, ejecutar primero el caso de 18 años paso a paso. Desde la raíz de `practica-playwright`, mantener una terminal con el servidor activo:

```sh
node practica-clase-8/servidor.cjs 200
```

La opción `--debug` abre el navegador y **Playwright Inspector**, una ventana de control que te permite avanzar por las acciones del test y continuar cuando estés listo. También limita la corrida a un worker y quita el límite global de tiempo del test para que puedas detenerte a observar. En una segunda terminal, desde la misma carpeta, ejecutar:

```sh
npx playwright test -c playwright.clase-8.config.ts --grep C-EDAD-18 --debug
```

Colocar el navegador y el Inspector lado a lado. Usar el botón de avance paso a paso del Inspector para seguir este recorrido:

1. Avanzar hasta completar `await inscripcion.goto(curso.nombre)`. El test ya creó su curso mediante `crearCurso(request)`; esta llamada abre el formulario de ese curso en `/cursos/<nombre>/inscripcion`.
2. Revisar en el navegador el encabezado **Inscripción**, el nombre del curso, el contador en **0**, el campo **Edad** y el botón **Enviar inscripción**.
3. Continuar las acciones de `inscripcion.enviarEdad(caso.edad)`: primero se escribe **18** en el campo y después se pulsa el botón. Observar **Inscripción aceptada: 18 años.** y el contador en **1**.
4. Continuar hasta que termine el test. Sus assertions comprueban el resultado y el `finally` borra el curso. Se espera **1 passed**. Finalizar la sesión del Inspector antes de ejecutar otro comando y conservar activo el servidor.

La raíz `http://127.0.0.1:4178/` muestra un mensaje de estado; el formulario aparece en la ruta del curso que abrió `goto`. Al finalizar el test se elimina ese curso, por lo que su URL temporal deja de mostrar el formulario. Para volver a observarlo, ejecutar otra vez el comando: se creará un curso nuevo.

Para observar un rechazo, repetir el comando cambiando `C-EDAD-18` por `C-EDAD-121`. La página debe mostrar el mensaje de edad inválida y conservar el contador en **0**. Ese test también debe terminar con **1 passed**, porque comprueba un rechazo esperado.

### 11.2. Ejecutar los cuatro límites

Después de observar el caso de 18, ejecutar los cuatro límites sin `--debug`:

```sh
npx playwright test -c playwright.clase-8.config.ts --grep C-EDAD --workers=1
```

Se esperan **4 passed**. El `for` exterior declara cuatro tests y cada uno tiene su resultado. Si el bucle estuviera dentro de un único test, habría un solo resultado para las cuatro edades. Podés comprobar cómo están declarados los casos contando los títulos de la salida de `--list`.

### 11.3. Comparar el paralelismo dentro del archivo

En `playwright.clase-8.config.ts`, cambiar temporalmente una sola línea:

```ts
fullyParallel: false,
```

Ejecutar los cuatro límites con dos workers:

```sh
npx playwright test -c playwright.clase-8.config.ts --grep C-EDAD --workers=2
```

Al seleccionar un único archivo sin paralelismo interno, esos cuatro casos se ejecutan en un worker. El máximo solicitado es dos; no obliga a dividir el archivo. Se esperan **4 passed**. Restaurar la línea final:

```ts
fullyParallel: true,
```

Repetir el mismo comando: los cuatro tests pueden distribuirse entre dos workers y deben dar **4 passed**. La alternativa local `test.describe.configure({ mode: 'parallel' })` habilita ese modo en un archivo o grupo; no hace falta agregarla junto a la opción global de esta práctica.

## 12. Provocar y corregir una colisión entre tests

Comprobar primero que no hay cursos pendientes con la consulta de la sección 10. Guardar la línea que genera `nombre` en `helpers/clase-8/cursos.ts`, dentro de `crearCurso`. Reemplazar únicamente la declaración de `nombre` por:

```ts
const nombre = 'curso-demo';
```

Conservar `fullyParallel: true` y ejecutar los seis casos con un worker:

```sh
npx playwright test -c playwright.clase-8.config.ts --workers=1
```

Se esperan **6 passed**: cada caso crea y elimina el nombre antes de que empiece el siguiente. Ahora ejecutar los mismos casos con dos workers:

```sh
npx playwright test -c playwright.clase-8.config.ts --workers=2
```

Cuando dos preparaciones se superponen, una recibe **409** en vez de 201. El fallo señala `Debe crearse un curso propio: curso-demo`, y el servidor registra la colisión. La comprobación protege la propiedad del dato: el intento que no lo creó no ejecuta el borrado del curso ajeno.

La superposición depende de la planificación de procesos. Si esa corrida no muestra un conflicto, no demuestra aislamiento: podés repetir una vez agregando `--repeat-each=2 --workers=2` al comando. No agregar pausas fijas ni cambiar las assertions para aceptar el 409.

Restaurar exactamente la identidad por preparación:

```ts
const nombre = `curso-${randomUUID()}`;
```

Ejecutar de nuevo con dos workers y consultar los cursos pendientes. Se esperan **6 passed** y **`[]`**. Eliminar la interferencia exige corregir los datos y su ciclo de vida; reducir workers solo cambió la posibilidad de observarla.

## 13. Comprobar la limpieza después de un fallo

En `tests/clase-8/resumen.spec.ts`, localizar la assertion sobre `inscripcion.total` de `C-DATOS-01`, dentro del `try`. Cambiar solo su esperado:

```ts
await expect(inscripcion.total).toHaveText('99');
```

Ejecutar el caso:

```sh
npx playwright test -c playwright.clase-8.config.ts --grep C-DATOS-01
```

Se espera **1 failed**: el total real es cero. Sin detener ni reiniciar el servidor, consultar `/api/cursos` con el comando de la sección 10: debe seguir respondiendo **`[]`**. El curso se limpió aunque falló la assertion. Restaurar el esperado:

```ts
await expect(inscripcion.total).toHaveText('0');
```

La restauración es únicamente en el cuerpo de ese caso. Ejecutarlo de nuevo: **1 passed**. No se oculta ni se convierte en éxito el fallo deliberado.

## 14. Alcances y límites

| Recurso | Alcance en esta práctica | Quién lo limpia |
|---|---|---|
| `page`, `context` | Por test | Fixtures incorporadas de Playwright. |
| `request` | Por test | Fixture incorporada de Playwright. |
| `inscripcion` | Por test | Usa la página administrada por Playwright; no crea otro navegador. |
| `curso` y sus inscripciones | Por test, guardados en el servidor | El `finally` del test elimina ese curso. |
| `browser` | Compartido por los tests de un worker | Playwright al cerrar ese worker. |
| Servidor de práctica | Una instancia para la práctica | Quien lo inició, con Control+C al terminar. |

Las fixtures incorporadas tienen su ciclo administrado por Playwright. Nuestro curso se crea con un helper y se elimina explícitamente dentro del test. El objeto `InscripcionPage` usa la página de ese caso; no crea ni comparte un navegador.

El `finally` intenta borrar el curso cuando el `try` termina o lanza un error. Un cierre forzado del proceso, el vencimiento del tiempo total del test o una pérdida de conexión pueden impedir que ese borrado termine; un entorno real necesita una forma de detectar y retirar recursos pendientes. El ejemplo concentra la explicación en creaciones confirmadas por este servidor local.

Cada llamada a `crearCurso` genera un UUID, un identificador aleatorio nuevo, y lo incluye en el nombre temporal. No depende de un contador global ni del orden de los casos. Un curso propio no aísla otros recursos comunes de una aplicación, como límites por cuenta, archivos o configuración del servicio.

`workers: 1` limita concurrencia. El modo `serial` declara dependencia entre los tests de un grupo: un fallo omite los siguientes y, si se habilitan reintentos, el grupo se reintenta junto. Ninguno reemplaza la preparación y limpieza propias. El recorrido de dos altas de `C-DATOS-02` conserva su objetivo completo dentro de un test.

## 15. Comprobación final de tu práctica

1. Listar seis tests, ejecutar con uno y dos workers y seleccionar cada identificador por separado: `C-EDAD-17`, `C-EDAD-18`, `C-EDAD-120`, `C-EDAD-121`, `C-DATOS-01` y `C-DATOS-02`.
2. Seguir `crearCurso(request)`, la apertura del modelo y `borrarCurso(request, curso)` en cada spec. Identificar qué queda antes del `try`, qué se comprueba dentro y qué se hace en el `finally`.
3. Repetir las comparaciones de las secciones 11–13. Restaurar `fullyParallel: true`, el UUID y el total esperado cero. Comprobar seis resultados correctos y ningún curso pendiente.
4. Repetir tres veces con dos workers: dieciocho resultados correctos. Explicar por qué el título del caso permanece estable y el nombre temporal cambia.
5. Leer las lecciones 5.3 y 5.4 de Learn-up y completar sus preguntas y laboratorios: **Parametrizar límites con títulos únicos** y **Eliminar una colisión entre workers**.

Al terminar, detener el servidor. Para una consulta, conservar el comando, el título del caso, el primer mensaje de error y el nombre de curso implicado.

## Referencias

Consultadas el 2026-11-15. La aplicación, la regla y los casos son propios de esta práctica; las referencias verifican las APIs y sus alcances.

- [Parametrización de tests](https://playwright.dev/docs/test-parameterize).
- [Fixtures incorporadas y alternativa de fixtures personalizadas](https://playwright.dev/docs/test-fixtures) y [fixtures incorporadas](https://playwright.dev/docs/api/class-fixtures).
- [Workers, paralelismo y modo serial](https://playwright.dev/docs/test-parallel), [configuración de `fullyParallel`](https://playwright.dev/docs/api/class-testconfig#test-config-fully-parallel) y [CLI](https://playwright.dev/docs/test-cli).
- [Aislamiento del navegador](https://playwright.dev/docs/browser-contexts) y [peticiones para preparar datos](https://playwright.dev/docs/api/class-apirequestcontext).
