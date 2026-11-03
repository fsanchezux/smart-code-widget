import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cambiarColor, cambiarRadio, claseRadio } from '../src/apply/tailwind';
import { comparar } from '../src/diff/comparar';
import { ErrorDocumento, parsearPagina } from '../src/parser/markdown';
import { proponerCambios } from '../src/propuesta';

// Copias congeladas del ejemplo: no cambian aunque la web demo evolucione.
const fixtures = resolve(__dirname, '../../test/fixtures/web');
const leerFixture = (ruta: string) => readFileSync(resolve(fixtures, ruta), 'utf8');
const homeMd = leerFixture('frontend/paginas/Home.md');
const homeJson = () => JSON.parse(leerFixture('frontend/paginas/Home.json'));
const leer = async (ruta: string) => leerFixture(ruta);

/** Cambia una línea del yaml dentro de la sección de un componente. */
function editar(md: string, componente: string, de: string, a: string): string {
  const inicio = md.search(new RegExp(`^#+ ${componente}$`, 'm'));
  const fin = inicio + md.slice(inicio).indexOf(de);
  assert.ok(inicio >= 0 && fin >= inicio, `no encuentro «${de}» en ${componente}`);
  return md.slice(0, fin) + a + md.slice(fin + de.length);
}

/** Líneas que cambian entre dos versiones del mismo fichero (mismo número de líneas). */
function lineasCambiadas(antes: string, despues: string): [string, string][] {
  const a = antes.split('\n');
  const b = despues.split('\n');
  assert.equal(a.length, b.length);
  return a.flatMap((l, i) => (l === b[i] ? [] : [[l.trim(), b[i].trim()] as [string, string]]));
}

// --- parser ---

test('parser: Home.md → árbol con anidamiento por nivel de encabezado', () => {
  const doc = parsearPagina(homeMd);
  assert.equal(doc.pagina, 'Home');
  assert.deepEqual(doc.raiz.map((c) => c.nombre), ['Hero', 'BuscadorResultados']);
  const buscador = doc.raiz[1];
  assert.deepEqual(buscador.hijos.map((c) => c.nombre), ['InputBuscador', 'ListaResultados', 'Acciones']);
  assert.equal(buscador.hijos[1].hijos[0].nombre, 'TarjetaProducto');
  const boton = doc.raiz[0].hijos[2];
  assert.deepEqual(boton.props, { texto: 'Contáctanos', 'border-radius': '8px', color: 'primario' });
  assert.equal(boton.descripcion, 'Botón que abre el formulario de contacto. Al pasar el ratón se oscurece.');
});

test('parser: errores con su línea', () => {
  const casos: [string, RegExp, number][] = [
    ['# Home\n\n## Hero\nTexto sin yaml\n', /Falta el bloque/, 2],
    ['# Home\n\n#### Hero\n```yaml\ntipo: section\n```\n', /Salto de nivel/, 2],
    ['# Home\n\n## Hero\n```yaml\ntipo: section\nprops: [1, 2\n```\n', /YAML no válido/, 5],
    ['# Home\n\n## Hero\n```yaml\ntipo: section\ncolor: rojo\n```\n', /Clave desconocida «color»/, 4],
    ['# Home\n\n## mi hero\n```yaml\ntipo: section\n```\n', /PascalCase/, 2],
  ];
  for (const [md, mensaje, linea] of casos) {
    assert.throws(() => parsearPagina(md), (e) => e instanceof ErrorDocumento && mensaje.test(e.message) && e.linea === linea);
  }
});

// --- diff ---

test('diff: el .md original coincide con el JSON (sin operaciones)', () => {
  assert.deepEqual(comparar(homeJson(), parsearPagina(homeMd)), []);
});

test('diff: clasifica props, descripciones y estructura', () => {
  let md = editar(homeMd, 'BotonContacto', 'border-radius: 8px', 'border-radius: 16px');
  md = editar(md, 'BotonContacto', 'color: primario', 'sombra: grande');
  md = editar(md, 'Hero', 'sombra suave.', 'sombra fuerte.');
  md = md.replace('### Titulo', '### TituloNuevo');

  const tipos = comparar(homeJson(), parsearPagina(md)).map((o) => `${o.tipo}:${'prop' in o ? o.prop : ''}`);
  assert.deepEqual(tipos.sort(), [
    'componente-eliminado:', 'componente-nuevo:', 'descripcion:',
    'prop-eliminada:color', 'prop-nueva:sombra', 'prop:border-radius',
  ]);
});

test('diff: mover un bloque en el .md es un cambio de estructura', () => {
  const corte = homeMd.indexOf('## BuscadorResultados');
  const inicioHero = homeMd.indexOf('## Hero');
  const md = homeMd.slice(0, inicioHero) + homeMd.slice(corte).trimEnd() + '\n\n' + homeMd.slice(inicioHero, corte);

  const ops = comparar(homeJson(), parsearPagina(md));
  assert.deepEqual(ops, [{ tipo: 'estructura', detalle: 'cambia el orden de la raíz' }]);
});

// --- aplicadores Tailwind ---

test('tailwind: escala de radios y valores arbitrarios', () => {
  assert.equal(claseRadio('8px'), 'rounded-lg');
  assert.equal(claseRadio(16), 'rounded-2xl');
  assert.equal(claseRadio('10px'), 'rounded-[10px]');
  assert.equal(claseRadio('full'), 'rounded-full');
  assert.throws(() => claseRadio('grande'));
  assert.deepEqual(cambiarRadio(['mt-6', 'rounded-lg', 'px-5', 'hover:rounded-xl'], '8px', '16px'), ['mt-6', 'rounded-2xl', 'px-5', 'hover:rounded-xl']);
  assert.throws(() => cambiarRadio(['rounded-md'], '8px', '16px'), /editó a mano/);
});

test('tailwind: color con nombre, incluidas variantes', () => {
  assert.deepEqual(
    cambiarColor(['bg-primario', 'text-white', 'hover:bg-primario-oscuro', 'focus:border-primario/50'], 'primario', 'secundario'),
    ['bg-secundario', 'text-white', 'hover:bg-secundario-oscuro', 'focus:border-secundario/50'],
  );
  assert.throws(() => cambiarColor(['bg-white'], 'primario', 'secundario'), /No hay clases/);
});

// --- propuesta completa (demo de éxito del Hito 1) ---

test('demo: border-radius 8px → 16px en BotonContacto cambia solo rounded-lg del botón', async () => {
  const md = editar(homeMd, 'BotonContacto', 'border-radius: 8px', 'border-radius: 16px');
  const p = await proponerCambios(homeJson(), md, leer);

  assert.equal(p.fallidas.length, 0);
  assert.equal(p.pendientes.length, 0);
  assert.equal(p.ficheros.length, 1);
  const [f] = p.ficheros;
  assert.equal(f.ruta, 'src/pages/Home.tsx');
  const [[antes, despues], ...otras] = lineasCambiadas(f.original, f.propuesto);
  assert.equal(otras.length, 0);
  assert.match(antes, /mt-6 rounded-lg bg-primario/);
  assert.equal(despues, antes.replace('rounded-lg', 'rounded-2xl'));
  assert.equal(p.json.componentes['Home/BotonContacto'].props!['border-radius'].valor, '16px');
});

test('propuesta: varias props sobre el mismo elemento se encadenan', async () => {
  let md = editar(homeMd, 'BotonContacto', 'texto: "Contáctanos"', 'texto: "Escríbenos {ya}"');
  md = editar(md, 'BotonContacto', 'color: primario', 'color: secundario');
  md = editar(md, 'InputBuscador', 'placeholder: "Buscar productos…"', 'placeholder: "¿Qué buscas?"');
  const p = await proponerCambios(homeJson(), md, leer);

  assert.equal(p.aplicadas.length, 3);
  const cambios = lineasCambiadas(p.ficheros[0].original, p.ficheros[0].propuesto).map(([, d]) => d);
  assert.ok(cambios.includes('{"Escríbenos {ya}"}'), 'texto con llaves escapado como expresión');
  assert.ok(cambios.some((l) => l.includes('bg-secundario') && l.includes('hover:bg-secundario-oscuro')));
  assert.ok(cambios.includes('placeholder="¿Qué buscas?"'));
});

test('propuesta: si el código se editó a mano, la op falla y no se toca nada', async () => {
  const md = editar(homeMd, 'BotonContacto', 'border-radius: 8px', 'border-radius: 16px');
  const leerEditado = async (ruta: string) => (await leer(ruta)).replace('mt-6 rounded-lg', 'mt-6 rounded-md');
  const p = await proponerCambios(homeJson(), md, leerEditado);

  assert.equal(p.aplicadas.length, 0);
  assert.equal(p.ficheros.length, 0);
  assert.match(p.fallidas[0].error, /rounded-md/);
  assert.equal(p.json.componentes['Home/BotonContacto'].props!['border-radius'].valor, '8px');
});

test('propuesta: lo no soportado queda pendiente y no cambia el JSON', async () => {
  const md = editar(homeMd, 'Hero', 'sombra suave.', 'sombra fuerte.');
  const p = await proponerCambios(homeJson(), md, leer);

  assert.equal(p.aplicadas.length, 0);
  assert.deepEqual(p.pendientes.map((o) => o.tipo), ['descripcion']);
  assert.deepEqual(p.json, homeJson());
});
