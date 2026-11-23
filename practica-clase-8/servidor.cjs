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
