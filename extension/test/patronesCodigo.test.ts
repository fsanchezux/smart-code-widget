import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mostrar, ocultar, patronesCodigo } from '../src/views/patronesCodigo';

const raizWebDemo = [
  'Configuracion.md', 'Stack.md', 'frontend', 'src', 'node_modules',
  'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', '.vscode',
];

test('oculta todo lo que no es documento y los .json de frontend', () => {
  assert.deepEqual(patronesCodigo(raizWebDemo), [
    '.vscode', 'index.html', 'node_modules', 'package-lock.json', 'package.json',
    'src', 'tsconfig.json', 'vite.config.ts', 'frontend/**/*.json',
  ]);
});

test('ocultar respeta las exclusiones del usuario y mostrar solo quita las propias', () => {
  const delUsuario = { '**/.git': true, src: true };
  const { exclusiones, añadidos } = ocultar(delUsuario, ['src', 'index.html']);

  assert.deepEqual(exclusiones, { '**/.git': true, src: true, 'index.html': true });
  assert.deepEqual(añadidos, ['index.html']);
  assert.deepEqual(mostrar(exclusiones, añadidos), delUsuario);
});
