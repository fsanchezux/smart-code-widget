import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Pagina } from '../src/modelo';
import { erroresPagina } from '../src/schema/validar';

// Valida el ejemplo vivo (examples/web-demo), no las fixtures.
// Compilado en extension/out/test → la raíz del repo está tres niveles arriba.
const webDemo = resolve(__dirname, '../../../examples/web-demo');
const home: Pagina = JSON.parse(readFileSync(resolve(webDemo, 'frontend/paginas/Home.json'), 'utf8'));

test('Home.json cumple el JSON Schema v0 y es coherente', () => {
  assert.deepEqual(erroresPagina(home), []);
});

test('el esquema rechaza un ancla sin uid ni selector', () => {
  const roto = structuredClone(home);
  delete roto.componentes['Home/Titulo'].anclas.texto.uid;
  assert.notDeepEqual(erroresPagina(roto), []);
});

test('el esquema rechaza un ancla con uid y selector a la vez', () => {
  const roto = structuredClone(home);
  roto.componentes['Home/Titulo'].anclas.texto.selector = 'h1';
  assert.notDeepEqual(erroresPagina(roto), []);
});

test('la coherencia detecta un aplica a un ancla inexistente', () => {
  const roto = structuredClone(home);
  roto.componentes['Home/Titulo'].props!.texto.aplica = ['boton'];
  assert.match(erroresPagina(roto).join(), /aplica a "boton"/);
});

test('cada uid de Home.json existe en el código de la web demo', () => {
  for (const [id, c] of Object.entries(home.componentes)) {
    for (const [nombre, ancla] of Object.entries(c.anclas)) {
      if (!ancla.uid) continue;
      const codigo = readFileSync(resolve(webDemo, ancla.fichero), 'utf8').replace(/\r\n/g, '\n');
      const marca = ancla.rol === 'logica' ? `// @uid ${ancla.uid}\n` : `data-uid="${ancla.uid}"`;
      assert.ok(codigo.includes(marca), `${id}.${nombre}: no se encuentra «${marca.trim()}» en ${ancla.fichero}`);
    }
  }
});
