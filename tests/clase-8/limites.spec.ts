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
