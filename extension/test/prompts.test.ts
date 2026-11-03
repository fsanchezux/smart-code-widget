import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { leerSalida, preguntarClaude } from '../src/ai/claude';
import { buscarPrompts, editarConRespuesta, leerRespuesta, promptAutomatico, promptChat } from '../src/ai/prompts';
import { ficherosSkill, RUTAS_SKILL } from '../src/ai/skill';
import { proponerCambios } from '../src/propuesta';

const fixtures = resolve(__dirname, '../../test/fixtures');
const leerFixture = (ruta: string) => readFileSync(resolve(fixtures, 'web', ruta), 'utf8');
const homeMd = leerFixture('frontend/paginas/Home.md');
const homeJson = () => JSON.parse(leerFixture('frontend/paginas/Home.json'));
const apertura = '<button data-uid="a4" className="mt-6 rounded-lg bg-primario">';

/** Home.md con un prompt bajo las props de BotonContacto. */
function conPrompt(linea = '  *texto verde al pasar el ratón*'): string[] {
  const lineas = homeMd.split(/\r?\n/);
  lineas.splice(lineas.indexOf('  color: primario') + 1, 0, linea);
  return lineas;
}

const aplicar = (lineas: string[], cambios: Map<number, string[]>) => lineas.flatMap((l, i) => cambios.get(i) ?? [l]);

test('buscarPrompts: encuentra el prompt, su componente y la sección sin la línea del prompt', () => {
  const lineas = conPrompt();
  const [p, ...otros] = buscarPrompts(lineas);
  assert.equal(otros.length, 0);
  assert.equal(p.peticion, 'texto verde al pasar el ratón');
  assert.equal(p.componente, 'BotonContacto');
  assert.equal(p.linea, lineas.indexOf('  *texto verde al pasar el ratón*'));
  assert.match(p.seccion, /^### BotonContacto\n```yaml\ntipo: button/);
  assert.ok(!p.seccion.includes('*texto verde'));
  assert.match(p.seccion, /Al pasar el ratón se oscurece\.$/);
});

test('buscarPrompts: la cursiva fuera del yaml no es un prompt; en la columna 0 sí', () => {
  assert.deepEqual(buscarPrompts(homeMd.replace('Busca productos', '*Busca* productos').split(/\r?\n/)), []);
  assert.equal(buscarPrompts(conPrompt('*sin sangría*'))[0]?.peticion, 'sin sangría');
  assert.deepEqual(buscarPrompts(conPrompt('  **negrita**')), []);
});

test('skill: se instala para Claude y para el resto de agentes, con el mismo contenido', () => {
  const ficheros = ficherosSkill();
  assert.deepEqual(Object.keys(ficheros).sort(), [
    '.agents/skills/smart-code-widget/SKILL.md', '.agents/skills/smart-code-widget/catalogo.md',
    '.claude/skills/smart-code-widget/SKILL.md', '.claude/skills/smart-code-widget/catalogo.md',
  ]);
  assert.equal(ficheros['.agents/skills/smart-code-widget/SKILL.md'], ficheros['.claude/skills/smart-code-widget/SKILL.md']);
});

test('skill: procedimiento corto (entender → preparar → cambiar) y catálogo aparte', () => {
  const ficheros = ficherosSkill();
  const [RUTA_SKILL] = RUTAS_SKILL;
  const skill = ficheros[`${RUTA_SKILL}/SKILL.md`];
  assert.match(skill, /^---\nname: smart-code-widget\ndescription: /);
  assert.match(skill, /\*\*Entender\*\*[\s\S]*\*\*Preparar\*\*[\s\S]*\*\*Cambiar\*\*/);
  assert.match(skill, /No explores el proyecto/);
  assert.match(skill, /\[catalogo\.md\]\(catalogo\.md\)/);
  assert.ok(!skill.includes('font-weight'), 'el catálogo no va en SKILL.md');
  assert.match(ficheros[`${RUTA_SKILL}/catalogo.md`], /- border-radius ✓ ◇: medida/);
});

test('prompt del chat: solo apunta al skill y a las líneas', () => {
  const lineas = conPrompt();
  const chat = promptChat('frontend/paginas/Home.md', buscarPrompts(lineas));
  assert.equal(chat, [
    'Usa el skill smart-code-widget. Resuelve en `frontend/paginas/Home.md`:',
    `- línea ${lineas.indexOf('  *texto verde al pasar el ratón*') + 1} (BotonContacto): *texto verde al pasar el ratón*`,
  ].join('\n'));
});

test('prompt automático: JSON con props y clases, catálogo, componente y anclas', () => {
  const [prompt] = buscarPrompts(conPrompt());
  const auto = promptAutomatico({ prompt, colores: ['primario'], anclas: [{ uid: 'a4', fichero: 'src/pages/Home.tsx', apertura }] });
  assert.match(auto, /Responde SOLO con JSON/);
  assert.match(auto, /"clases": \{\}/);
  assert.match(auto, /- border-radius ✓ ◇: medida/);
  assert.match(auto, /- uid a4 \(src\/pages\/Home\.tsx\): <button data-uid="a4"/);
  assert.match(auto, /Petición: texto verde al pasar el ratón$/);
});

test('leerRespuesta: extrae el JSON, descarta props fuera del catálogo y clases de uids ajenos', () => {
  const texto = 'Claro:\n```json\n{"props": {"shadow": "lg", "brillo": 3}, "clases": {"a4": " a  b ", "a9": "x"}, "explicacion": "ok"}\n```';
  const { respuesta, descartadas } = leerRespuesta(texto, ['a4']);
  assert.deepEqual(respuesta, { props: { shadow: 'lg' }, clases: { a4: 'a b' }, explicacion: 'ok', descripcion: 'ok' });
  assert.deepEqual(descartadas, ['brillo', 'clases de a9']);
  assert.throws(() => leerRespuesta('no sé'), /no devolvió JSON/);
});

test('editarConRespuesta: actualiza props existentes, pone las nuevas en lugar del prompt y amplía la descripción', () => {
  const lineas = conPrompt();
  const [prompt] = buscarPrompts(lineas);
  const resultado = aplicar(lineas, editarConRespuesta(lineas, prompt, { 'border-radius': '24px', texto: 'Hola: ya' }, 'Se vuelve verde.'));
  const inicio = resultado.indexOf('### BotonContacto');
  assert.deepEqual(resultado.slice(inicio, inicio + 9), [
    '### BotonContacto', '```yaml', 'tipo: button', 'props:',
    '  texto: "Hola: ya"', '  border-radius: 24px', '  color: primario', '```',
    'Botón que abre el formulario de contacto. Al pasar el ratón se oscurece. Se vuelve verde.',
  ]);
});

test('editarConRespuesta: sin props ni descripción borra la línea; sin descripción previa la añade tras el yaml', () => {
  const lineas = conPrompt();
  const [prompt] = buscarPrompts(lineas);
  assert.deepEqual([...editarConRespuesta(lineas, prompt, {})], [[prompt.linea, []]]);

  const titulo = homeMd.split(/\r?\n/);
  titulo.splice(titulo.indexOf('  texto: "Encuentra lo que buscas"') + 1, 0, '  *verde*');
  const [p] = buscarPrompts(titulo);
  const r = aplicar(titulo, editarConRespuesta(titulo, p, {}, 'Es verde.'));
  assert.deepEqual(r.slice(r.indexOf('### Titulo'), r.indexOf('### Titulo') + 7), [
    '### Titulo', '```yaml', 'tipo: text', 'props:', '  texto: "Encuentra lo que buscas"', '```', 'Es verde.',
  ]);
});

test('propuesta: las clases de la IA entran en el diff junto al cambio de descripción y actualizan el JSON', async () => {
  const lineas = conPrompt();
  const [prompt] = buscarPrompts(lineas);
  const md = aplicar(lineas, editarConRespuesta(lineas, prompt, {}, 'Al pasar el ratón el texto se vuelve verde.')).join('\n');
  const clases = 'mt-6 rounded-lg bg-primario px-5 py-2.5 font-medium text-white hover:bg-primario-oscuro hover:text-green-300';

  const p = await proponerCambios(homeJson(), md, async (r) => leerFixture(r), [{ componente: 'Home/BotonContacto', clases: { a4: clases } }]);
  assert.deepEqual(p.aplicadas.map((o) => o.tipo), ['descripcion']);
  assert.equal(p.pendientes.length, 0);
  assert.ok(p.ficheros[0].propuesto.includes(`className="${clases}"`));
  assert.match(p.json.componentes['Home/BotonContacto'].descripcion!, /se oscurece\. Al pasar el ratón el texto se vuelve verde\.$/);

  const sinIA = await proponerCambios(homeJson(), md, async (r) => leerFixture(r));
  assert.deepEqual(sinIA.pendientes.map((o) => o.tipo), ['descripcion'], 'sin cambios de la IA, la descripción queda pendiente');
});

test('claude: leerSalida devuelve el resultado o el error de la CLI', () => {
  assert.equal(leerSalida('{"type":"result","is_error":false,"result":"hola"}'), 'hola');
  assert.throws(() => leerSalida('{"is_error":true,"result":"OAuth session expired"}'), /OAuth session expired/);
});

test('claude: lanza el proceso, le pasa el prompt por stdin y sin herramientas', { skip: process.platform !== 'win32' }, async () => {
  const comando = `"${process.execPath}" "${resolve(fixtures, 'claude-falso.js')}"`;
  const texto = await preguntarClaude('...\nPetición: texto verde al pasar el ratón', { comando, cwd: fixtures, modelo: 'haiku' });
  const { respuesta, descartadas } = leerRespuesta(texto, ['a4']);

  assert.deepEqual(respuesta.props, { 'border-radius': '24px' });
  assert.deepEqual(respuesta.clases, { a4: 'mt-6 rounded-lg bg-primario hover:text-green-600' });
  assert.equal(respuesta.descripcion, 'Al pasar el ratón el texto se vuelve verde.');
  assert.deepEqual(descartadas, ['inventada', 'clases de a99']);
  const { args, recibido } = JSON.parse(respuesta.explicacion);
  assert.ok(recibido, 'el prompt llega por stdin');
  assert.equal(args[args.indexOf('--tools') + 1], '', '--tools vacío = sin herramientas');
  assert.deepEqual(args.slice(-2), ['--model', 'haiku']);
});
