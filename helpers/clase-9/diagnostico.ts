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
