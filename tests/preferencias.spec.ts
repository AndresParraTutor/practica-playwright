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
  
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await perfil.getByLabel('Nombre', { exact: true }).fill('Lucía');
  await perfil.getByLabel('País', { exact: true }).selectOption({ value: 'AR' });
  await perfil.getByRole('checkbox', { name: 'Novedades', exact: true }).check();
  await perfil.getByRole('radio', { name: 'Mensual', exact: true }).check();
  await perfil.getByRole('button', {
    name: 'Guardar cambios', exact: true,
  }).click();
  
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  await expect(perfil.getByRole('status')).toHaveText(
    'Perfil guardado: Lucía · AR · Mensual · novedades: sí.',
  );
});