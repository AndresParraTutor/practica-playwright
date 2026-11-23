# Clase 4 — Código y comandos para copiar

Material de práctica de la [clase 4](presentation.md). La base tiene un test pendiente; usar la solución después de intentar el taller. El HTML incluido es el documento de práctica.

## 1. Preparación

Abrir el proyecto `practica-playwright` de la clase 3 y conservar `playwright.config.ts`, `package.json` y `package-lock.json`. El proyecto debe tener Playwright Test y Chromium instalados. Para completar una preparación pendiente, usar la [guía de código de clase 3](../playwright-class-3/clase-3-codigo.md); no hace falta reinicializar un proyecto que ya funciona.

Crear el archivo `tests/preferencias.spec.ts`. El caso de guardado parte de Nombre vacío, País sin elegir, Semanal seleccionado y Novedades marcado. La región Notificaciones contiene otro botón con el mismo nombre para practicar búsquedas con contexto.

## 2. Archivo base completo: tests/preferencias.spec.ts

Esta base tiene un test deliberadamente incompleto. Antes de agregar las acciones, falla porque el estado del perfil sigue vacío. Durante el taller, reemplazar el comentario pendiente por las acciones del caso; conservar la assertion final.

```ts
import { test, expect } from '@playwright/test';

const formulario = `
  <main>
    <h1>Preferencias</h1>
    <section aria-label="Perfil">
      <h2>Perfil</h2>
      <p>Preferencias del perfil</p>
      <form id="preferencias">
        <div>
          <label for="nombre">Nombre</label>
          <input id="nombre" name="nombre" required>
        </div>
        <div>
          <label for="pais">País</label>
          <select id="pais" name="pais" required>
            <option value="" selected>Elegir país</option>
            <option value="AR">Argentina</option>
            <option value="UY">Uruguay</option>
          </select>
        </div>
        <fieldset>
          <legend>Frecuencia</legend>
          <label>
            <input type="radio" name="frecuencia" value="Semanal" checked>
            Semanal
          </label>
          <label>
            <input type="radio" name="frecuencia" value="Mensual">
            Mensual
          </label>
        </fieldset>
        <div>
          <label>
            <input type="checkbox" name="novedades" checked>
            Novedades
          </label>
        </div>
        <div class="acciones"><button type="submit">Guardar cambios</button></div>
        <p id="estado-perfil" role="status" data-testid="estado-perfil"></p>
      </form>
    </section>
    <section aria-label="Notificaciones">
      <h2>Notificaciones</h2>
      <button id="guardar-notificaciones" type="button">Guardar cambios</button>
      <p id="estado-notificaciones" role="status"></p>
    </section>
  </main>
  <script>
    document.querySelector('#preferencias').addEventListener('submit', event => {
      event.preventDefault();
      const datos = new FormData(event.currentTarget);
      const novedades = datos.has('novedades') ? 'sí' : 'no';
      document.querySelector('#estado-perfil').textContent =
        'Perfil guardado: ' + datos.get('nombre') + ' · ' +
        datos.get('pais') + ' · ' + datos.get('frecuencia') +
        ' · novedades: ' + novedades + '.';
    });
    document.querySelector('#guardar-notificaciones').addEventListener('click', () => {
      document.querySelector('#estado-notificaciones').textContent =
        'Preferencias de notificaciones guardadas';
    });
  </script>
`;

test('C-PREF-01: guarda las preferencias del perfil', async ({ page }) => {
  await page.setContent(formulario);
  const perfil = page.getByRole('region', { name: 'Perfil', exact: true });

  // Completar aquí las acciones del caso C-PREF-01.

  await expect(perfil.getByRole('status')).toHaveText(
    'Perfil guardado: Lucía · AR · Mensual · novedades: sí.',
  );
});
```

## 3. Ejecución

Desde la raíz de `practica-playwright`:

```sh
npx playwright test tests/preferencias.spec.ts --project=chromium
```

Para ejecutar únicamente el caso de guardado:

```sh
npx playwright test tests/preferencias.spec.ts --project=chromium --grep C-PREF-01
```

Para repetir con ventana visible:

```sh
npx playwright test tests/preferencias.spec.ts --project=chromium --headed
```

La ventana puede cerrarse rápido. Leer el resultado de la consola; la depuración paso a paso se desarrolla en la clase 9. No se necesitan pausas fijas para que funcione este documento. En un equipo sin sesión gráfica, usar la ejecución sin `--headed`.

Si se conserva el reporter de la clase 3, consultar el reporte con:

```sh
npx playwright show-report
```

Al terminar, detener el servidor del reporte con Control+C. Si falta la descarga de Chromium o una biblioteca del sistema, retomar los pasos de preparación de clase 3 y conservar el mensaje exacto.

## 4. Solución del caso de guardado

Después del taller, reemplazar solamente el bloque `test('C-PREF-01...')` de la base por el siguiente. Conservar el import y la constante `formulario`. No agregar un segundo test con el mismo nombre.

```ts
test('C-PREF-01: guarda las preferencias del perfil', async ({ page }) => {
  await page.setContent(formulario);
  const perfil = page.getByRole('region', { name: 'Perfil', exact: true });

  await perfil.getByLabel('Nombre', { exact: true }).fill('Lucía');
  await perfil.getByLabel('País', { exact: true }).selectOption({ value: 'AR' });
  await perfil.getByRole('checkbox', { name: 'Novedades', exact: true }).check();
  await perfil.getByRole('radio', { name: 'Mensual', exact: true }).check();
  await perfil.getByRole('button', {
    name: 'Guardar cambios', exact: true,
  }).click();

  await expect(perfil.getByRole('status')).toHaveText(
    'Perfil guardado: Lucía · AR · Mensual · novedades: sí.',
  );
});
```

Resultado esperado: `passed` y resumen «Perfil guardado: Lucía · AR · Mensual · novedades: sí.».

## 5. Test adicional de teclado

Agregar al final del mismo archivo, después del caso C-PREF-01. Usa el import y la constante `formulario` ya declarados. Cada test carga su propio documento; C-PREF-02 puede ejecutarse independientemente del caso de guardado.

```ts
test('C-PREF-02: recorre Nombre y País con el teclado', async ({ page }) => {
  await page.setContent(formulario);
  const perfil = page.getByRole('region', { name: 'Perfil', exact: true });
  const nombre = perfil.getByLabel('Nombre', { exact: true });
  const pais = perfil.getByLabel('País', { exact: true });

  await nombre.focus();
  await expect(nombre).toBeFocused();
  await nombre.press('Tab');
  await expect(pais).toBeFocused();
  await pais.press('Shift+Tab');
  await expect(nombre).toBeFocused();
});
```

Ejecutar solo este caso:

```sh
npx playwright test tests/preferencias.spec.ts --project=chromium --grep C-PREF-02
```

El orden esperado en este documento es Nombre → Tab → País → Shift+Tab → Nombre. No se agregan llamadas a `focus()` entre la pulsación y la assertion de su consecuencia.

## 6. Cambio de estructura del segundo taller

Con el caso C-PREF-01 resuelto, buscar en la constante `formulario` esta línea:

```html
<div class="acciones"><button type="submit">Guardar cambios</button></div>
```

Reemplazarla por:

```html
<div class="acciones"><span><button type="submit">Guardar cambios</button></span></div>
```

Guardar el archivo y volver a ejecutar C-PREF-01. El localizador por región, rol y nombre conserva el objetivo; el test debe seguir pasando con el mismo resultado esperado.

Para comparar con la dependencia de estructura, reemplazar temporalmente **solo la acción de guardar** por:

```ts
await page.locator('#preferencias > div:nth-child(5) > button').click({
  timeout: 1500,
});
```

Ese selector encuentra el botón con el HTML original y deja de encontrarlo con el span agregado. El límite de 1500 ms se usa solo para observar ese fallo previsto sin consumir el taller. No se propone como configuración general de los tests. Restaurar la acción semántica al terminar la comparación.

## 7. Errores para interpretar

| Resultado | Primera revisión |
|---|---|
| Resumen vacío en la base | El bloque de acciones todavía está pendiente |
| `strict mode violation` al guardar | El botón se buscó en toda la página y coincide con dos regiones |
| Resumen con `novedades: no` | Un `click()` pudo desmarcar la casilla que empezaba marcada |
| Resumen con `Semanal` | Revisar la acción sobre el radio Mensual |
| Timeout tras agregar el span con el CSS del punto 6 | Se rompió la relación de hijo directo exigida por el selector |
| Falla el recorrido de foco | Revisar el documento usado y la presencia de controles enfocables entre Nombre y País |
