// Qué se ve en "modo documento": solo los documentos del lenguaje.
// Todo lo demás de la raíz del proyecto (código, config, node_modules…) se oculta.
// Sin dependencias de vscode para poder testearlo con node:test.

export const DOCUMENTOS = new Set(['Stack.md', 'Configuracion.md', 'Backend.md', 'frontend']);

// Dentro de frontend/ los .json son la representación interna: no se editan a mano.
const OCULTOS_FIJOS = ['frontend/**/*.json'];

export type Exclusiones = Record<string, unknown>;

/** Patrones de files.exclude para ocultar todo lo que no es documento. */
export function patronesCodigo(entradasRaiz: string[]): string[] {
  const codigo = entradasRaiz.filter((e) => !DOCUMENTOS.has(e)).sort();
  return [...codigo, ...OCULTOS_FIJOS];
}

/**
 * Añade los patrones a las exclusiones actuales sin pisar las del usuario.
 * Devuelve también cuáles se han añadido de verdad, para poder quitar solo esos.
 */
export function ocultar(actual: Exclusiones, patrones: string[]): { exclusiones: Exclusiones; añadidos: string[] } {
  const exclusiones = { ...actual };
  const añadidos: string[] = [];
  for (const p of patrones) {
    if (p in exclusiones) continue;
    exclusiones[p] = true;
    añadidos.push(p);
  }
  return { exclusiones, añadidos };
}

/** Quita solo los patrones que añadió la extensión. */
export function mostrar(actual: Exclusiones, añadidos: string[]): Exclusiones {
  const exclusiones = { ...actual };
  for (const p of añadidos) delete exclusiones[p];
  return exclusiones;
}
