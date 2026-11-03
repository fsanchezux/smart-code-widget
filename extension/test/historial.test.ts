import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  componentesDe, leerHistorial, type Paso, planVolver, propsDe, serializarPaso, siguientePaso, valoresAnteriores,
} from '../src/history/historial';
import { proponerCambios } from '../src/propuesta';

const leerFixture = (ruta: string) => readFileSync(resolve(__dirname, '../../test/fixtures/web', ruta), 'utf8');

/** Paso de prueba que lleva cada fichero de `antes` a `despues`. */
function paso(n: number, ficheros: Record<string, [string, string]>, cambios: Paso['cambios'] = [], pagina = 'Home'): Paso {
  return {
    paso: n, fecha: `2026-11-03T10:0${n}:00Z`, pagina, via: 'determinista', resumen: [], cambios, props: {},
    ficheros: Object.entries(ficheros).map(([ruta, [antes, despues]]) => ({ ruta, antes, despues })),
  };
}

test('jsonl: ida y vuelta, y numeración de pasos', () => {
  const pasos = [paso(1, { a: ['1', '2'] }), paso(2, { a: ['2', '3'] })];
  const jsonl = pasos.map(serializarPaso).join('');
  assert.deepEqual(leerHistorial(jsonl), pasos);
  assert.equal(siguientePaso(pasos), 3);
  assert.equal(siguientePaso([]), 1);
});

test('volver: deshace el paso elegido y los posteriores, en orden inverso', () => {
  const pasos = [
    paso(1, { 'Home.tsx': ['v0', 'v1'], 'Home.md': ['m0', 'm1'] }),
    paso(2, { 'Home.tsx': ['v1', 'v2'] }),
    paso(3, { 'Home.tsx': ['v2', 'v3'], 'Home.md': ['m1', 'm3'] }),
    paso(4, { 'Otra.tsx': ['o0', 'o1'] }, [], 'Otra'),
  ];
  const actuales = new Map([['Home.tsx', 'v3'], ['Home.md', 'm3'], ['Otra.tsx', 'o1']]);

  assert.deepEqual(planVolver(pasos, 'Home', 2, actuales), [
    { ruta: 'Home.tsx', original: 'v3', propuesto: 'v1' },
    { ruta: 'Home.md', original: 'm3', propuesto: 'm1' },
  ]);
  assert.deepEqual(planVolver(pasos, 'Home', 1, actuales).map((c) => c.propuesto), ['v0', 'm0']);
});

test('volver: si un fichero se editó después, no se pisa', () => {
  const pasos = [paso(1, { 'Home.tsx': ['v0', 'v1'] }), paso(2, { 'Home.tsx': ['v1', 'v2'] })];
  assert.throws(() => planVolver(pasos, 'Home', 1, new Map([['Home.tsx', 'v2 + edición a mano']])), /ha cambiado después del paso 2/);
  assert.throws(() => planVolver(pasos, 'Home', 9, new Map()), /no hay pasos/);
});

test('volver: ignora la diferencia LF/CRLF y respeta el fin de línea actual', () => {
  const pasos = [paso(1, { 'Home.tsx': ['a\nb\n', 'a\nc\n'] })];
  assert.deepEqual(planVolver(pasos, 'Home', 1, new Map([['Home.tsx', 'a\r\nc\r\n']])), [
    { ruta: 'Home.tsx', original: 'a\r\nc\r\n', propuesto: 'a\r\nb\r\n' },
  ]);
});

test('props: valores anteriores de una prop, del más reciente al más antiguo', () => {
  const pasos = [
    paso(1, {}, [{ componente: 'Hero', prop: 'border-radius', antes: '8px', despues: '16px' }]),
    paso(2, {}, [{ componente: 'Hero', prop: 'hover:background', despues: 'green-500' }, { componente: 'Titulo', prop: 'texto', antes: 'a', despues: 'b' }]),
    paso(3, {}, [{ componente: 'Hero', prop: 'border-radius', antes: '16px', despues: '24px' }]),
  ];
  assert.deepEqual(valoresAnteriores(pasos, 'Home', 'Hero', 'border-radius').map((v) => [v.paso, v.antes, v.despues]), [
    [3, '16px', '24px'], [1, '8px', '16px'],
  ]);
  assert.deepEqual(componentesDe(pasos[1]), ['Hero', 'Titulo']);
});

test('ciclo completo: un cambio aceptado se puede deshacer dejando código, JSON y .md como estaban', async () => {
  const md = leerFixture('frontend/paginas/Home.md');
  const json = leerFixture('frontend/paginas/Home.json');
  const tsx = leerFixture('src/pages/Home.tsx');
  const mdNuevo = md.replace(/(## Hero\r?\n```yaml\r?\ntipo: section\r?\nprops:\r?\n  border-radius: )16px/, '$124px');

  const p = await proponerCambios(JSON.parse(json), mdNuevo, async (r) => leerFixture(r));
  const jsonNuevo = JSON.stringify(p.json, null, 2) + '\n';
  assert.deepEqual(propsDe(p.json, ['Hero']), { Hero: { 'border-radius': '24px' } });

  const registrado = paso(1, {
    'src/pages/Home.tsx': [tsx, p.ficheros[0].propuesto],
    'frontend/paginas/Home.json': [json, jsonNuevo],
    'frontend/paginas/Home.md': [md, mdNuevo],
  });
  const actuales = new Map(registrado.ficheros.map((f) => [f.ruta, f.despues]));
  const plan = planVolver([registrado], 'Home', 1, actuales);

  assert.equal(plan.length, 3);
  for (const c of plan) assert.equal(c.propuesto.replace(/\r\n/g, '\n'), registrado.ficheros.find((f) => f.ruta === c.ruta)!.antes.replace(/\r\n/g, '\n'));
});
