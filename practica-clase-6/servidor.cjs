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
