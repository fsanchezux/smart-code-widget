import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROPS_SOPORTADAS } from '../src/apply/props';
import { contextoYaml, enProps, posicionEnProps } from '../src/parser/contextoYaml';
import { CATALOGO, PROPS_POR_NOMBRE } from '../src/schema/catalogo';

const lineas = readFileSync(resolve(__dirname, '../../test/fixtures/web/frontend/paginas/Home.md'), 'utf8').split(/\r?\n/);
const linea = (texto: string, desde = 0) => lineas.indexOf(texto, desde);

test('catálogo: nombres únicos, válidos para el esquema, e incluye todas las props con aplicador', () => {
  assert.equal(PROPS_POR_NOMBRE.size, CATALOGO.length);
  for (const { nombre } of CATALOGO) assert.match(nombre, /^[a-z][a-z0-9-]*$/);
  for (const prop of PROPS_SOPORTADAS) assert.ok(PROPS_POR_NOMBRE.has(prop), `${prop} no está en el catálogo`);
});

test('contexto: bloque yaml de BotonContacto con sus props', () => {
  const boton = linea('### BotonContacto');
  const ctx = contextoYaml(lineas, boton + 3);
  assert.ok(ctx);
  assert.equal(ctx.inicio, boton + 1);
  assert.equal(ctx.lineaProps, boton + 3);
  assert.equal(ctx.finProps, boton + 6);
  assert.deepEqual(ctx.presentes, ['texto', 'border-radius', 'color']);
  assert.equal(ctx.sangria, '  ');
  assert.ok(enProps(ctx, lineas, boton + 5));
  assert.ok(!enProps(ctx, lineas, boton + 2), 'la línea tipo: no es zona de props');
});

test('contexto: fuera de un bloque yaml no hay contexto', () => {
  assert.equal(contextoYaml(lineas, linea('### BotonContacto')), undefined);
  assert.equal(contextoYaml(lineas, linea('Botón que abre el formulario de contacto. Al pasar el ratón se oscurece.')), undefined);
  assert.equal(contextoYaml(lineas, 0), undefined);
});

test('contexto: una línea con "/" bajo props cuenta como zona de props, también en la columna 0', () => {
  const md = ['## Hero', '```yaml', 'tipo: section', 'props:', '  border-radius: 16px', '/', '```'];
  const ctx = contextoYaml(md, 5)!;
  assert.ok(enProps(ctx, md, 5));
  assert.deepEqual(ctx.presentes, ['border-radius']);
});

test('posición: barra, clave y valor', () => {
  assert.deepEqual(posicionEnProps('/'), { tipo: 'barra', columna: 0, escrito: '' });
  assert.deepEqual(posicionEnProps('  /bor'), { tipo: 'barra', columna: 2, escrito: 'bor' });
  assert.deepEqual(posicionEnProps('  font'), { tipo: 'clave', columna: 2, escrito: 'font' });
  assert.deepEqual(posicionEnProps('  border-radius: 8'), { tipo: 'valor', prop: 'border-radius', columna: 17, escrito: '8' });
  assert.equal(posicionEnProps('tipo: button'), undefined);
});
