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
