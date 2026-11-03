// Historial paso a paso (Hito 2). Cada cambio aceptado guarda el contenido antes/después de los ficheros
// que tocó (código, JSON y .md), así que volver atrás es restaurar contenidos en orden inverso.
// Sin dependencias de vscode.

import type { Pagina, Valor } from '../modelo';

export interface FicheroPaso {
  ruta: string;
  antes: string;
  despues: string;
}

/** Un cambio de prop o de descripción dentro de un paso. */
export interface CambioPaso {
  /** Nombre del componente, sin página. */
  componente: string;
  prop?: string;
  antes?: Valor;
  despues?: Valor;
  descripcion?: boolean;
}

export interface Paso {
  paso: number;
  fecha: string;
  pagina: string;
  via: 'determinista' | 'ia' | 'volver';
  /** Una línea legible por operación. */
  resumen: string[];
  cambios: CambioPaso[];
  /** Props de cada componente afectado tal como quedaron tras el paso. */
  props: Record<string, Record<string, Valor>>;
  ficheros: FicheroPaso[];
}

/** Componentes que toca un paso. */
export const componentesDe = (p: Paso) => [...new Set(p.cambios.map((c) => c.componente))];

/** Props (nombre → valor) de los componentes indicados, según el JSON de la página. */
export function propsDe(json: Pagina, componentes: string[]): Record<string, Record<string, Valor>> {
  return Object.fromEntries(componentes.map((nombre) => {
    const props = json.componentes[`${json.pagina}/${nombre}`]?.props ?? {};
    return [nombre, Object.fromEntries(Object.entries(props).map(([k, v]) => [k, v.valor]))];
  }));
}

/** Valores que ha tenido una prop, del más reciente al más antiguo, con el paso que la dejó así. */
export function valoresAnteriores(pasos: Paso[], pagina: string, componente: string, prop: string) {
  return pasos
    .filter((p) => p.pagina === pagina)
    .flatMap((p) => p.cambios.filter((c) => c.componente === componente && c.prop === prop).map((c) => ({ paso: p.paso, fecha: p.fecha, ...c })))
    .sort((a, b) => b.paso - a.paso);
}

export const RUTA_HISTORIAL = '.lenguaje/historial.jsonl';

export function leerHistorial(jsonl: string): Paso[] {
  return jsonl.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l) as Paso);
}

export function serializarPaso(paso: Paso): string {
  return JSON.stringify(paso) + '\n';
}

export function siguientePaso(pasos: Paso[]): number {
  return pasos.reduce((max, p) => Math.max(max, p.paso), 0) + 1;
}

const sinCR = (texto: string) => texto.replace(/\r\n/g, '\n');
const conFinDeLinea = (texto: string, modelo: string) => (modelo.includes('\r\n') ? sinCR(texto).replace(/\n/g, '\r\n') : sinCR(texto));

export interface CambioVolver {
  ruta: string;
  original: string;
  propuesto: string;
}

/**
 * Qué hay que escribir para dejar la página como estaba antes del paso `desde`:
 * se deshacen ese paso y todos los posteriores de la misma página, del más reciente al más antiguo.
 * Si un fichero no coincide con lo que dejó un paso (se editó después), no se puede volver sin pisarlo.
 */
export function planVolver(pasos: Paso[], pagina: string, desde: number, actuales: Map<string, string>): CambioVolver[] {
  const aDeshacer = pasos.filter((p) => p.pagina === pagina && p.paso >= desde).sort((a, b) => b.paso - a.paso);
  if (!aDeshacer.length) throw new Error(`no hay pasos desde el ${desde} en ${pagina}`);

  const estado = new Map<string, string>();
  for (const p of aDeshacer) {
    for (const f of p.ficheros) {
      const actual = estado.get(f.ruta) ?? actuales.get(f.ruta);
      if (actual === undefined) throw new Error(`falta ${f.ruta}`);
      if (sinCR(actual) !== sinCR(f.despues)) {
        throw new Error(`${f.ruta} ha cambiado después del paso ${p.paso} (¿edición manual o cambio sin sincronizar?)`);
      }
      estado.set(f.ruta, f.antes);
    }
  }
  return [...estado]
    .map(([ruta, texto]) => {
      const original = actuales.get(ruta)!;
      return { ruta, original, propuesto: conFinDeLinea(texto, original) };
    })
    .filter((c) => sinCR(c.original) !== sinCR(c.propuesto));
}
