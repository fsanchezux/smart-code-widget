import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { aplicarProp, propSoportada } from '../src/apply/props';
import { cambiarUtilidad } from '../src/apply/tailwind';
import { contextoYaml, posicionEnProps } from '../src/parser/contextoYaml';
import { proponerCambios } from '../src/propuesta';
import { definicionDe } from '../src/schema/catalogo';
import { erroresPagina } from '../src/schema/validar';

const leerFixture = (ruta: string) => readFileSync(resolve(__dirname, '../../test/fixtures/web', ruta), 'utf8');
const homeJson = () => JSON.parse(leerFixture('frontend/paginas/Home.json'));
const HERO = ['rounded-2xl', 'bg-white', 'p-10', 'text-center', 'shadow-sm'];

test('modificadores: hover:background añade su clase sin tocar el bg-white base', () => {
  assert.deepEqual(cambiarUtilidad(HERO, 'hover:background', undefined, 'green-500'), [...HERO, 'hover:bg-green-500']);
  assert.deepEqual(
    cambiarUtilidad([...HERO, 'hover:bg-green-500'], 'hover:background', 'green-500', 'primario'),
    [...HERO, 'hover:bg-primario'],
  );
  assert.deepEqual(cambiarUtilidad(HERO, 'md:hover:padding', undefined, '24px'), [...HERO, 'md:hover:p-6']);
  assert.throws(() => cambiarUtilidad(HERO, 'raro:background', undefined, 'red-500'), /Modificador «raro:»/);
});

test('utilidades: cada prop reconoce solo su familia (text-center no es un color ni un tamaño)', () => {
  assert.deepEqual(cambiarUtilidad(HERO, 'background', undefined, 'slate-100'), ['rounded-2xl', 'bg-slate-100', 'p-10', 'text-center', 'shadow-sm']);
  assert.deepEqual(cambiarUtilidad(HERO, 'text-color', undefined, 'primario'), [...HERO, 'text-primario']);
  assert.deepEqual(cambiarUtilidad(HERO, 'font-size', undefined, '18px'), [...HERO, 'text-lg']);
  assert.deepEqual(cambiarUtilidad(HERO, 'text-align', 'center', 'left'), ['rounded-2xl', 'bg-white', 'p-10', 'text-left', 'shadow-sm']);
  assert.deepEqual(cambiarUtilidad(HERO, 'padding', undefined, '16px'), ['rounded-2xl', 'bg-white', 'p-4', 'text-center', 'shadow-sm']);
  assert.deepEqual(cambiarUtilidad(HERO, 'padding', undefined, '10px'), ['rounded-2xl', 'bg-white', 'p-2.5', 'text-center', 'shadow-sm']);
  assert.deepEqual(cambiarUtilidad(HERO, 'padding', undefined, '13px'), ['rounded-2xl', 'bg-white', 'p-[13px]', 'text-center', 'shadow-sm']);
  assert.deepEqual(cambiarUtilidad(HERO, 'shadow', 'sm', 'lg'), ['rounded-2xl', 'bg-white', 'p-10', 'text-center', 'shadow-lg']);
  assert.deepEqual(cambiarUtilidad(HERO, 'transition', undefined, 'colors'), [...HERO, 'transition-colors']);
  assert.deepEqual(cambiarUtilidad(HERO, 'opacity', undefined, '50%'), [...HERO, 'opacity-50']);
  assert.throws(() => cambiarUtilidad(HERO, 'shadow', 'md', 'lg'), /editó a mano/);
});

test('soporte: modificadores solo en props de estilo y con nombres conocidos', () => {
  assert.ok(propSoportada('hover:background'));
  assert.ok(propSoportada('md:padding'));
  assert.ok(!propSoportada('hover:texto'), 'el contenido no admite modificadores');
  assert.ok(!propSoportada('raro:background'));
  assert.equal(definicionDe('hover:background')?.nombre, 'background');
  assert.equal(definicionDe('hover:texto'), undefined);
});

test('yaml: los nombres con modificador se reconocen como props y en el autocompletado', () => {
  const md = ['## Hero', '```yaml', 'tipo: section', 'props:', '  border-radius: 16px', '  hover:background: green-500', '```'];
  assert.deepEqual(contextoYaml(md, 5)?.presentes, ['border-radius', 'hover:background']);
  assert.deepEqual(posicionEnProps('  hover:'), { tipo: 'clave', columna: 2, escrito: 'hover:' });
  assert.deepEqual(posicionEnProps('  /md:hov'), { tipo: 'barra', columna: 2, escrito: 'md:hov' });
  assert.deepEqual(posicionEnProps('  hover:background: gr'), { tipo: 'valor', prop: 'hover:background', columna: 20, escrito: 'gr' });
});

test('demo: «fondo verde al pasar el ratón» como props llega al código y al JSON', async () => {
  const md = leerFixture('frontend/paginas/Home.md')
    .replace(/(## Hero\r?\n```yaml\r?\ntipo: section\r?\nprops:\r?\n  border-radius: 16px)/, '$1\n  hover:background: green-500\n  transition: colors');
  const p = await proponerCambios(homeJson(), md, async (r) => leerFixture(r));

  assert.equal(p.fallidas.length, 0, JSON.stringify(p.fallidas));
  assert.deepEqual(p.aplicadas.map((o) => o.tipo === 'descripcion' ? o.tipo : o.prop), ['hover:background', 'transition']);
  assert.ok(p.ficheros[0].propuesto.includes(
    'data-uid="a1" className="rounded-2xl bg-white p-10 text-center shadow-sm hover:bg-green-500 transition-colors"',
  ));
  assert.deepEqual(p.json.componentes['Home/Hero'].props!['hover:background'], { valor: 'green-500', aplica: ['contenedor'] });
  assert.deepEqual(erroresPagina(p.json), []);
});

test('texto: {variable} con texto inicial fijo edita ese valor (useState o const)', () => {
  const conEstado = [
    "const [titulo, setTitulo] = useState('Hola');",
    'const x = <h1 data-uid="a2" onClick={() => setTitulo(\'Otro\')}>',
    '  {titulo}',
    '</h1>;',
  ].join('\n');
  assert.ok(aplicarProp(conEstado, 'X.tsx', 'a2', 'texto', 'Hola', "Adiós, l'amic").includes(String.raw`useState('Adiós, l\'amic')`));
  assert.throws(() => aplicarProp(conEstado, 'X.tsx', 'a2', 'texto', 'Otra cosa', 'Adiós'), /editó a mano/);

  const conConst = 'const saludo = "Hola";\nconst x = <p data-uid="a3">{saludo}</p>;';
  assert.ok(aplicarProp(conConst, 'X.tsx', 'a3', 'texto', 'Hola', 'Buenas').startsWith('const saludo = "Buenas";'));
  assert.throws(() => aplicarProp('const x = <p data-uid="a3">{f()}</p>;', 'X.tsx', 'a3', 'texto', 'a', 'b'), /no es un texto literal/);
});
