import { aplicarProp, PROPS_SOPORTADAS } from './apply/props';
import { comparar, type Operacion } from './diff/comparar';
import type { Pagina } from './modelo';
import { parsearPagina } from './parser/markdown';
import { validarPagina } from './schema/validar';

// .md guardado + JSON actual → propuesta de cambios (código y JSON nuevos), sin tocar disco.
// La E/S se inyecta (`leer`) para poder probarlo sin VS Code.

export type OperacionProp = Extract<Operacion, { tipo: 'prop' }>;

export interface FicheroPropuesto {
  ruta: string;
  original: string;
  propuesto: string;
}

export interface Propuesta {
  ficheros: FicheroPropuesto[];
  json: Pagina;
  aplicadas: OperacionProp[];
  pendientes: Operacion[];
  fallidas: { op: OperacionProp; error: string }[];
}

export async function proponerCambios(
  jsonActual: unknown,
  md: string,
  leer: (ruta: string) => Promise<string>,
): Promise<Propuesta> {
  validarPagina(jsonActual, 'El JSON actual');
  const ops = comparar(jsonActual, parsearPagina(md));

  const originales = new Map<string, string>();
  const codigo = new Map<string, string>();
  const json = structuredClone(jsonActual);
  const propuesta: Propuesta = { ficheros: [], json, aplicadas: [], pendientes: [], fallidas: [] };

  for (const op of ops) {
    if (op.tipo !== 'prop' || !PROPS_SOPORTADAS.has(op.prop)) {
      propuesta.pendientes.push(op);
      continue;
    }
    const comp = jsonActual.componentes[op.componente];
    const prop = comp.props![op.prop];
    // Cada op se aplica sobre un borrador: si falla en un ancla, no deja nada a medias.
    const borrador = new Map(codigo);
    try {
      for (const nombreAncla of prop.aplica) {
        const ancla = comp.anclas[nombreAncla];
        if (ancla.rol !== 'visual') throw new Error(`el ancla «${nombreAncla}» es de lógica`);
        if (!ancla.uid) throw new Error(`el ancla «${nombreAncla}» usa selector CSS (aún no soportado)`);
        if (!originales.has(ancla.fichero)) {
          const texto = await leer(ancla.fichero);
          originales.set(ancla.fichero, texto);
          borrador.set(ancla.fichero, texto);
        }
        borrador.set(ancla.fichero, aplicarProp(borrador.get(ancla.fichero)!, ancla.fichero, ancla.uid, op.prop, op.antes, op.despues));
      }
    } catch (err) {
      propuesta.fallidas.push({ op, error: (err as Error).message });
      continue;
    }
    for (const [ruta, texto] of borrador) codigo.set(ruta, texto);
    json.componentes[op.componente].props![op.prop].valor = op.despues;
    propuesta.aplicadas.push(op);
  }

  validarPagina(json, 'El JSON resultante');
  for (const [ruta, propuesto] of codigo) {
    const original = originales.get(ruta)!;
    if (propuesto !== original) propuesta.ficheros.push({ ruta, original, propuesto });
  }
  return propuesta;
}
