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
      // await expect(inscripcion.total).toHaveText('99');
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

        await inscripcion.enviarEdad(28);
        await expect(inscripcion.confirmacion).toHaveText(
          'Inscripción aceptada: 28 años.',
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
