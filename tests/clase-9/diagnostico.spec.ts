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

        // await page.pause();
        await inscripcion.enviarEdad(120);
        await expect(inscripcion.confirmacion).toHaveText(
          'Inscripción aceptada: 120 años.',
        );
        await expect(inscripcion.alerta).toBeHidden();
        await expect(inscripcion.total).toHaveText('1');

        await inscripcion.goto(curso.nombre);
        await expect(inscripcion.total).toHaveText('1');
        // if (testInfo.retry === 0) {
        //   throw new Error('Fallo simulado solo en el intento inicial.');
        // }
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
