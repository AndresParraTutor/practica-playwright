# Clase 6 — Código para practicar validaciones con assertions

Este material acompaña la presentación de la clase 6. Durante el encuentro el tutor demuestra los ejemplos; después se pueden repetir en el proyecto `practica-playwright`.

Primero comprobar el acceso correcto y el envío válido; después, los estados de los controles y el rechazo esperado. Los cuatro casos están completos. Las variantes indican qué fragmento reemplazar y cuándo restaurar la solución.

La aplicación es una copia independiente de la práctica de clase 5, en el puerto 4176. No guarda solicitudes ni envía correos. El objetivo es comprobar resultados y estados observables de la interfaz.

## 1. Preparación y estructura

Usar el proyecto `practica-playwright` de la clase 3, con Playwright Test, Chromium y Node 20 o posterior compatible con la versión instalada. Conservar `playwright.config.ts`, `package.json` y `package-lock.json`. No hacen falta dependencias nuevas. Si falta el entorno, retomar la [guía de clase 3](../playwright-class-3/clase-3-codigo.md).

Crear los siguientes archivos desde el editor. Los cuatro de esta clase son nuevos; no reemplazan los de clases anteriores:

```text
practica-playwright/
  practica-clase-6/
    servidor.cjs
    login.html
    solicitud.html
  tests/
    validaciones.spec.ts
  playwright.config.ts     (se conserva)
  package.json             (se conserva)
  package-lock.json        (se conserva)
```

La cuenta ficticia es `ana@example.test` / `clave-demo`. El servidor escucha en `127.0.0.1:4176`. Las sesiones viven en memoria y desaparecen al detenerlo. La confirmación informa la recepción de la descripción y el archivo; no se guardan solicitudes ni archivos. Los controles Motivo, Recibir copia por correo y Notificaciones se usan para observar estados de interfaz; el servidor no guarda esas selecciones ni envía correos. Cuenta es un campo de solo lectura con el dato de la cuenta ficticia.

## 2. Archivo de soporte: practica-clase-6/servidor.cjs

Copiar completo. Es una copia del soporte de clase 5 con el puerto de esta práctica. El argumento establece la demora de respuesta del envío. No se explica este servidor línea por línea durante la clase.

```js
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { setTimeout: esperar } = require('node:timers/promises');

const origen = 'http://127.0.0.1:4176';
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

servidor.listen(4176, '127.0.0.1', () => {
  console.log(`Abrir ${origen}/login — demora del envío: ${demora} ms`);
});
```

## 3. Archivo de soporte: practica-clase-6/login.html

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

## 4. Archivo de soporte: practica-clase-6/solicitud.html

La preparación de un archivo habilita el botón después de 400 ms, como en clase 5. La demora del servidor se aplica por separado. El alert se muestra únicamente cuando hay un error. El botón Notificaciones comienza con `aria-pressed="false"` y alterna ese atributo al hacer clic; no envía una petición.

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

## 5. Iniciar y comprobar la aplicación

Desde la raíz de `practica-playwright`, en una terminal:

```sh
node practica-clase-6/servidor.cjs 200
```

Abrir `http://127.0.0.1:4176/login` e ingresar con la cuenta ficticia. Debe aparecer Nueva solicitud con la cuenta de solo lectura, los controles y el botón de envío inicialmente deshabilitado. Mantener abierta esta terminal mientras se ejecutan los tests. Control+C detiene el servidor.

El número `200` simula milisegundos de respuesta del envío. No configura un timeout de Playwright. La sesión del navegador manual y las sesiones de los tests son independientes.

## 6. Archivo completo: tests/validaciones.spec.ts

Copiar completo. Los cuatro casos están resueltos y se pueden ejecutar de forma independiente. La secuencia del archivo comienza con acceso y envío correctos, sigue con los estados de los controles y termina con el rechazo esperado. La preparación de login queda explícita en cada caso; la clase 7 desarrolla su organización y reutilización.

```ts
import { test, expect } from '@playwright/test';

const origen = 'http://127.0.0.1:4176';

test('C-LOGIN-01: acepta credenciales correctas', async ({ page }) => {
  await page.goto(`${origen}/login`);
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();

  await expect(page).toHaveURL(`${origen}/solicitud`);
  const encabezado = page.getByRole('heading', { level: 1 });
  await expect(encabezado).toBeVisible();
  await expect(encabezado).toHaveText('Nueva solicitud');
});

test('C-FLUJO-01: confirma la descripción y el archivo recibidos', async ({ page }) => {
  await page.goto(`${origen}/login`);
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(`${origen}/solicitud`);

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

test('C-ESTADOS-01: refleja los estados de los controles', async ({ page }) => {
  await page.goto(`${origen}/login`);
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(`${origen}/solicitud`);

  const cuenta = page.getByLabel('Cuenta', { exact: true });
  await expect(cuenta).toHaveValue('ana@example.test');
  await expect(cuenta).not.toBeEditable();
  await expect(page.getByLabel('Descripción', { exact: true })).toBeEditable();

  const motivo = page.getByLabel('Motivo', { exact: true });
  await motivo.selectOption('consulta');
  await expect(motivo).toHaveValue('consulta');

  const copia = page.getByRole('checkbox', {
    name: 'Recibir copia por correo', exact: true,
  });
  await copia.check();
  await expect(copia).toBeChecked();

  const notificaciones = page.getByRole('button', {
    name: 'Notificaciones', exact: true,
  });
  await expect(notificaciones).toHaveAttribute('aria-pressed', 'false');
  await notificaciones.click();
  await expect(notificaciones).toHaveAttribute('aria-pressed', 'true');

  const enviar = page.getByRole('button', {
    name: 'Enviar solicitud', exact: true,
  });
  await expect(enviar).toBeDisabled();
  const adjunto = page.getByLabel('Adjuntar nota', { exact: true });
  await adjunto.setInputFiles({
    name: 'nota.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('evidencia de prueba'),
  });
  await expect(enviar).toBeEnabled();
  await adjunto.setInputFiles([]);
  await expect(enviar).toBeDisabled();
  await expect(page.getByTestId('archivo-elegido'))
    .toHaveText('Sin archivo seleccionado');
});

test('C-LOGIN-02: rechaza una contraseña incorrecta', async ({ page }) => {
  await page.goto(`${origen}/login`);
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();

  const error = page.getByRole('alert');
  await expect(error).toBeVisible();
  await expect(error).toHaveText('Credenciales inválidas');
  await expect(page).toHaveURL(`${origen}/login?error=1`);
});
```

Se esperan `4 passed`. Cada resultado debe leerse con su título y sus comprobaciones. El caso de estados no envía una solicitud y el de rechazo no depende de una sesión creada antes.

## 7. Comandos para ejecutar y depurar

En otra terminal, desde la raíz de `practica-playwright`, ejecutar los cuatro casos de esta clase:

```sh
npx playwright test tests/validaciones.spec.ts --project=chromium
```

Ejecutar primero el acceso correcto:

```sh
npx playwright test tests/validaciones.spec.ts --project=chromium --grep C-LOGIN-01
```

Ejecutar el flujo completo, los estados o el rechazo por separado:

```sh
npx playwright test tests/validaciones.spec.ts --project=chromium --grep C-FLUJO-01
npx playwright test tests/validaciones.spec.ts --project=chromium --grep C-ESTADOS-01
npx playwright test tests/validaciones.spec.ts --project=chromium --grep C-LOGIN-02
```

`--grep` filtra los títulos con una expresión regular. En este archivo cada identificador selecciona un solo caso. El nombre de archivo limita la ejecución a los tests de esta clase y `--project=chromium` elige el proyecto de la configuración del curso.

Para ver el navegador sin pausar el caso:

```sh
npx playwright test tests/validaciones.spec.ts --project=chromium --grep C-FLUJO-01 --headed
```

Para avanzar por instrucciones con Playwright Inspector:

```sh
npx playwright test tests/validaciones.spec.ts --project=chromium --grep C-FLUJO-01 --debug
```

En VS Code se puede usar la extensión oficial [Playwright Test de Microsoft](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright): abrir el proyecto, poner un breakpoint dentro del test, elegir **Debug Test** junto al caso y avanzar con **Step Over**. La terminal del servidor debe seguir abierta. Para la comparación de timeouts usar una ejecución normal: el modo debug modifica los límites para permitir las pausas del depurador.

## 8. Variantes de lectura, texto y URL

Estas variantes se insertan en un caso existente, en el punto indicado. No son tests adicionales completos. Guardar una copia del archivo resuelto para restaurarlo al terminar.

**Valor y atributo en login — diapositiva 11.** En C-LOGIN-01, después del `fill()` de Correo y antes del clic, agregar temporalmente:

```ts
await expect(page.getByLabel('Correo', { exact: true }))
  .toHaveValue('ana@example.test');
await expect(page.locator('form')).toHaveAttribute('action', '/login');
```

La primera comprueba el valor actual; la segunda, el atributo del formulario. El comportamiento del acceso se sigue comprobando con el resultado posterior al clic.

**Lectura instantánea — diapositiva 7.** En C-FLUJO-01, para comparar el patrón, reemplazar temporalmente las comprobaciones posteriores al clic en Enviar solicitud por:

```ts
const mensaje = page.getByRole('status');
const texto = await mensaje.textContent();
expect(texto).toBe('Solicitud recibida: Actualizar mis datos · nota.txt.');
```

La lectura puede encontrar la confirmación si ya llegó o capturar un estado anterior. Un resultado verde aislado no transforma esta lectura en una espera del texto. Restaurar las assertions originales al terminar. No agregar una pausa fija como solución.

**Texto parcial — diapositiva 10.** La siguiente línea es una alternativa más amplia que la comprobación completa del mensaje:

```ts
await expect(page.getByRole('status')).toContainText('Solicitud recibida:');
```

No cubre por sí sola la descripción y el archivo que exige C-FLUJO-01. Conservar la comprobación completa en el caso resuelto.

**URL por patrón — diapositiva 16.** En C-LOGIN-01, reemplazar temporalmente la comprobación de URL completa por:

```ts
await expect(page).toHaveURL(/\/solicitud$/);
```

El patrón comprueba ese final y deja libre el origen. No equivale a comprobar toda la URL. Restaurar la expectativa completa si ese es el contrato del caso.

## 9. Provocar, leer y restaurar un fallo

Esta es la demostración de la diapositiva 20. En C-FLUJO-01 reemplazar temporalmente la assertion del texto completo por:

```ts
await expect(page.getByRole('status')).toHaveText('Solicitud guardada.');
```

Conservar la acción de envío y ejecutar ese caso sin `--debug`:

```sh
npx playwright test tests/validaciones.spec.ts --project=chromium --grep C-FLUJO-01
```

Se espera que falle: el servidor devuelve `Solicitud recibida: Actualizar mis datos · nota.txt.`. Revisar archivo y línea, texto esperado, texto recibido, localizador y call log. La causa de este fallo provocado es una expectativa que no corresponde al contrato del ejercicio.

Restaurar la comprobación original:

```ts
await expect(
  confirmacion,
  'La confirmación debe identificar la descripción y el archivo recibidos',
).toHaveText('Solicitud recibida: Actualizar mis datos · nota.txt.');
```

Ejecutar otra vez el flujo y después los cuatro casos. Deben pasar. No conservar el cambio deliberado ni silenciar el fallo.

## 10. Un timeout local justificado

El siguiente fragmento ilustra el ajuste de la diapositiva 21. En el flujo completo puede reemplazar la comprobación del texto si un comportamiento válido y el entorno justifican esperar hasta diez segundos:

```ts
await expect(page.getByRole('status')).toHaveText(
  'Solicitud recibida: Actualizar mis datos · nota.txt.',
  { timeout: 10_000 },
);
```

El test sigue sujeto a su timeout total. La demora de `200` o `2500` ms usada en esta práctica cabe en el límite predeterminado de expect, por lo que el archivo resuelto conserva ese valor. Un texto esperado incorrecto seguirá fallando aunque se amplíe el tiempo.

## 11. Práctica posterior en Learn-up

Revisar lecciones y preguntas de 4.1, 4.2 y 4.3. Los laboratorios proponen transferir el mismo criterio a otros ejemplos:

- [4.1 · Convertir una lectura instantánea en assertion web-first](../../../content/playwright/labs/4.1/convertir-assertion-web-first.yaml): esperar Procesado sobre el localizador con await.
- [4.2 · Elegir evidencia semántica](../../../content/playwright/labs/4.2/elegir-evidencia-semantica.yaml): comprobar aria-pressed para un botón de alternancia.
- [4.3 · Validar un resultado de error completo](../../../content/playwright/labs/4.3/validar-error-completo.yaml): comprobar el mensaje y la URL del registro rechazado.

Al terminar la práctica, detener el servidor con Control+C en la terminal donde se inició.
