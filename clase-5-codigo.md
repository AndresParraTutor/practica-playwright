# Clase 5 — Código y comandos para copiar

Material de práctica de la [clase 5](presentation.md). Incluye la aplicación local, el test base, los comandos de ejecución y las variantes del ejercicio. C-LOGIN-01 (acceso correcto) y C-LOGIN-02 (rechazo) están resueltos, en ese orden; completar C-FLUJO-01 antes de consultar su solución.

## 1. Preparación y estructura

Usar el proyecto `practica-playwright` de la clase 3, con Playwright Test, Chromium y una versión de Node compatible con esa instalación. Conservar `playwright.config.ts`, `package.json` y `package-lock.json`. El soporte de esta clase utiliza APIs incluidas en Node 20 o posterior y no necesita instalar paquetes adicionales. Para una preparación pendiente, retomar la [guía de clase 3](../playwright-class-3/clase-3-codigo.md).

Crear estas carpetas y archivos desde el editor:

```text
practica-playwright/
  practica-clase-5/
    servidor.cjs
    login.html
    solicitud.html
  tests/
    solicitud.spec.ts
    fixtures/
      nota.txt              (solo para la variante desde disco)
  playwright.config.ts     (se conserva)
  package.json             (se conserva)
  package-lock.json        (se conserva)
```

El servidor escucha únicamente en `127.0.0.1:4175`. La cuenta ficticia es `ana@example.test` con contraseña `clave-demo`. Las sesiones viven en memoria y desaparecen al detener el proceso. El formulario envía el archivo al servidor, que lee su contenido y devuelve una confirmación; no se guardan solicitudes ni archivos en disco.

## 2. Archivo de soporte: practica-clase-5/servidor.cjs

Copiar completo. El argumento del comando permite cambiar la demora de la respuesta sin editar el test. El código del servidor se entrega como soporte para la práctica, no como contenido para explicar línea por línea.

```js
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { setTimeout: esperar } = require('node:timers/promises');

const origen = 'http://127.0.0.1:4175';
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

servidor.listen(4175, '127.0.0.1', () => {
  console.log(`Abrir ${origen}/login — demora del envío: ${demora} ms`);
});
```

## 3. Archivo de soporte: practica-clase-5/login.html

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
    <p id="error" role="alert"></p>
  </main>
  <script>
    if (new URLSearchParams(location.search).get('error') === '1') {
      document.querySelector('#error').textContent = 'Credenciales inválidas';
    }
  </script>
</body>
</html>
```

## 4. Archivo de soporte: practica-clase-5/solicitud.html

El control de envío se habilita 400 ms después de seleccionar un archivo. Esa preparación pertenece a la aplicación y permite observar el auto-waiting del clic. El servidor agrega por separado la demora de respuesta que recibe en el comando.

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
    textarea, input, button { font: inherit; padding: .5rem; }
    textarea { width: 90%; }
    button { display: block; margin-top: 1rem; }
    [role="alert"] { color: #a31515; }
  </style>
</head>
<body>
  <main>
    <h1>Nueva solicitud</h1>
    <form id="solicitud" action="/solicitudes" method="post"
          enctype="multipart/form-data">
      <label for="descripcion">Descripción</label>
      <textarea id="descripcion" name="descripcion" required></textarea>
      <label for="adjunto">Adjuntar nota</label>
      <input id="adjunto" name="adjunto" type="file"
             accept=".txt,text/plain" required>
      <p>Archivo: <span data-testid="archivo-elegido">Sin archivo seleccionado</span></p>
      <button id="enviar" type="submit" disabled>Enviar solicitud</button>
    </form>
    <p id="estado" role="status"></p>
    <p id="error" role="alert"></p>
  </main>
  <script>
    const formulario = document.querySelector('#solicitud');
    const adjunto = document.querySelector('#adjunto');
    const enviar = document.querySelector('#enviar');
    const elegido = document.querySelector('[data-testid="archivo-elegido"]');
    const estado = document.querySelector('#estado');
    const error = document.querySelector('#error');
    let preparacion;

    adjunto.addEventListener('change', () => {
      clearTimeout(preparacion);
      enviar.disabled = true;
      estado.textContent = '';
      error.textContent = '';
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
      try {
        const respuesta = await fetch('/solicitudes', {
          method: 'POST',
          body: new FormData(formulario),
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) {
          estado.textContent = '';
          error.textContent = datos.error;
          return;
        }
        estado.textContent = datos.mensaje;
      } catch {
        estado.textContent = '';
        error.textContent = 'No se pudo enviar la solicitud';
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
node practica-clase-5/servidor.cjs 200
```

Abrir `http://127.0.0.1:4175/login`. Deben aparecer los controles Correo, Contraseña e Ingresar. Mantener esa terminal abierta mientras se ejecutan los tests. Control+C detiene el servidor.

El valor `200` representa la demora de respuesta del envío en milisegundos. No cambia el resultado esperado ni modifica los timeouts de Playwright. La demostración manual y los tests usan sesiones de navegador separadas.

## 6. Archivo base: tests/solicitud.spec.ts

Copiar completo. C-LOGIN-01 (acceso correcto) y C-LOGIN-02 (rechazo) están resueltos, en ese orden. C-FLUJO-01 está deliberadamente incompleto: inicialmente falla en `toHaveURL()` porque aún no realiza el ingreso. El tutor completa los dos comentarios pendientes durante la demostración. Para practicar después de clase, completar esa misma base y conservar las comprobaciones antes de consultar la solución.

```ts
import { test, expect } from '@playwright/test';

const origen = 'http://127.0.0.1:4175';

test('C-LOGIN-01: acepta credenciales correctas', async ({ page }) => {
  await page.goto(`${origen}/login`);
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();

  await expect(page).toHaveURL(`${origen}/solicitud`);
  await expect(page.getByRole('heading', {
    name: 'Nueva solicitud', exact: true,
  })).toBeVisible();
});

test('C-LOGIN-02: rechaza una contraseña incorrecta', async ({ page }) => {
  await page.goto(`${origen}/login`);
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText('Credenciales inválidas');
  await expect(page).toHaveURL(`${origen}/login?error=1`);
});

test('C-FLUJO-01: envía una solicitud con una nota', async ({ page }) => {
  await page.goto(`${origen}/login`);

  // Completar aquí el ingreso con la cuenta ficticia válida.

  await expect(page).toHaveURL(`${origen}/solicitud`);
  await expect(page.getByRole('heading', {
    name: 'Nueva solicitud', exact: true,
  })).toBeVisible();

  // Completar descripción, seleccionar nota.txt en memoria y enviar.

  await expect(page.getByRole('status')).toHaveText(
    'Solicitud recibida: Actualizar mis datos · nota.txt.',
  );
});
```

## 7. Ejecutar los casos

Abrir otra terminal en la raíz de `practica-playwright`:

```sh
npx playwright test tests/solicitud.spec.ts --project=chromium
```

Para demostrar primero el login correcto, paso a paso en el Inspector:

```sh
npx playwright test tests/solicitud.spec.ts --project=chromium --grep C-LOGIN-01 --debug
```

Después, para ejecutar únicamente el rechazo del login:

```sh
npx playwright test tests/solicitud.spec.ts --project=chromium --grep C-LOGIN-02
```

Para ejecutar solamente el flujo con archivo:

```sh
npx playwright test tests/solicitud.spec.ts --project=chromium --grep C-FLUJO-01
```

Para mostrar la ventana, si el equipo tiene una sesión gráfica:

```sh
npx playwright test tests/solicitud.spec.ts --project=chromium --headed
```

Con el reporter de la clase 3, abrir el reporte después de ejecutar:

```sh
npx playwright show-report
```

Detener el servidor del reporte con Control+C al terminar. Ese proceso es distinto del servidor de la aplicación de práctica.

## 8. Solución del flujo completo

Para consultar la solución de la demostración, reemplazar únicamente el bloque `test('C-FLUJO-01...')` de la base por este. Conservar el import, la constante `origen` y los dos tests de login, C-LOGIN-01 y C-LOGIN-02. No agregar un segundo test con el mismo título.

```ts
test('C-FLUJO-01: envía una solicitud con una nota', async ({ page }) => {
  await page.goto(`${origen}/login`);
  await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();

  await expect(page).toHaveURL(`${origen}/solicitud`);
  await expect(page.getByRole('heading', {
    name: 'Nueva solicitud', exact: true,
  })).toBeVisible();

  await page.getByLabel('Descripción', { exact: true }).fill('Actualizar mis datos');
  await page.getByLabel('Adjuntar nota', { exact: true }).setInputFiles({
    name: 'nota.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('evidencia de prueba'),
  });
  await page.getByRole('button', {
    name: 'Enviar solicitud', exact: true,
  }).click();

  await expect(page.getByRole('status')).toHaveText(
    'Solicitud recibida: Actualizar mis datos · nota.txt.',
  );
});
```

Con la base completada se esperan `3 passed`. Cada caso se puede ejecutar por separado. El caso de envío conserva el estado inicial y las credenciales dentro de su propio recorrido.

## 9. Variante del archivo desde disco

Crear `tests/fixtures/nota.txt` con el siguiente contenido:

```text
evidencia de prueba
```

En la solución, reemplazar solamente la llamada a `setInputFiles()` y su objeto por:

```ts
await page.getByLabel('Adjuntar nota', { exact: true })
  .setInputFiles('tests/fixtures/nota.txt');
```

Ejecutar desde la raíz del proyecto. El mismo resultado esperado sigue siendo válido porque el archivo conserva su nombre y tiene contenido de texto. Para el taller principal se conserva la versión en memoria.

Para explorar la limpieza del control, antes del envío se puede usar:

```ts
await page.getByLabel('Adjuntar nota', { exact: true }).setInputFiles([]);
await expect(page.getByTestId('archivo-elegido'))
  .toHaveText('Sin archivo seleccionado');
await expect(page.getByRole('button', {
  name: 'Enviar solicitud', exact: true,
})).toBeDisabled();
```

Este fragmento cambia el estado del caso: vuelve a seleccionar el archivo antes de enviar o probalo en un caso independiente. La assertion de botón deshabilitado se profundiza en la clase 6.

## 10. Comparación con la respuesta más lenta

Primero ejecutar la solución con el servidor iniciado con `200`. Para cambiar la demora, detener ese servidor con Control+C y volver a iniciarlo:

```sh
node practica-clase-5/servidor.cjs 2500
```

En la terminal de tests:

```sh
npx playwright test tests/solicitud.spec.ts --project=chromium --grep C-FLUJO-01
```

La solución por condición debe seguir pasando. No se cambia el timeout de expect: en la configuración de clase se conserva el valor predeterminado de 5000 ms, y la demora simulada es de 2500 ms.

Para la demostración del tutor, reemplazar temporalmente **solo la assertion final** del test resuelto por este fragmento. Es la variante deliberadamente dependiente del tiempo que analizamos en las diapositivas 20 y 21:

```ts
const esperado = 'Solicitud recibida: Actualizar mis datos · nota.txt.';
await page.waitForTimeout(1000);
const texto = await page.getByRole('status').textContent();
expect(texto).toBe(esperado);
```

Con una respuesta de 200 ms, esta variante puede pasar; con 2500 ms, la lectura normalmente encuentra «Enviando…» y la comparación falla. La demostración depende de cuándo se ejecute la lectura: en un equipo detenido o muy sobrecargado puede ocurrir más tarde. El punto es que una pausa fija no garantiza haber alcanzado la condición.

Restaurar la assertion `await expect(page.getByRole('status')).toHaveText(...)` después de la comparación. Si se desea volver a la demora inicial, detener el servidor y reiniciarlo con `200`. No dejar el fragmento de pausa como solución del caso.

## 11. Variante de consulta: observar una respuesta concreta

Este fragmento acompaña la explicación de la diapositiva 23; no es un requisito del taller. En el caso resuelto, puede reemplazar el clic en Enviar solicitud y la assertion final cuando el objetivo incluye observar también la respuesta HTTP. Los datos y el archivo ya deben estar preparados.

```ts
const respuestaPendiente = page.waitForResponse(respuesta =>
  respuesta.url() === `${origen}/solicitudes` &&
  respuesta.request().method() === 'POST',
);

await page.getByRole('button', {
  name: 'Enviar solicitud', exact: true,
}).click();

const respuesta = await respuestaPendiente;
expect(respuesta.status()).toBe(201);
await expect(page.getByRole('status')).toHaveText(
  'Solicitud recibida: Actualizar mis datos · nota.txt.',
);
```

La primera línea registra la espera antes del clic. Se guarda la promesa sin hacer `await` todavía, porque la respuesta llegará después de enviar. Luego se espera esa promesa y se comprueba el código HTTP que devuelve el servidor de práctica. La condición de captura filtra por URL y método; una respuesta de error también se captura y permite observar su código. La assertion de interfaz se conserva porque recibir la respuesta no demuestra que el mensaje se haya mostrado.

Para consultar la otra variante de la diapositiva 23, se puede reemplazar la assertion de URL posterior al ingreso por:

```ts
await page.waitForURL(`${origen}/solicitud`);
```

Esta llamada coordina el siguiente paso con la URL indicada y, por defecto, con su estado de carga `load`. En el caso principal se prefiere `toHaveURL()` para expresar el destino esperado como una assertion. No hace falta agregar ambos métodos para la misma necesidad.
