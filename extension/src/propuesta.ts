import { aplicarProp, propSoportada, reemplazarClassName } from './apply/props';
import { comparar, type Operacion } from './diff/comparar';
import type { Ancla, Pagina } from './modelo';
import { parsearPagina } from './parser/markdown';
import { validarPagina } from './schema/validar';

// .md guardado + JSON actual → propuesta de cambios (código y JSON nuevos), sin tocar disco.
// La E/S se inyecta (`leer`) para poder probarlo sin VS Code.

export type OperacionProp = Extract<Operacion, { tipo: 'prop' | 'prop-nueva' }>;
export type OperacionAplicable = OperacionProp | Extract<Operacion, { tipo: 'descripcion' }>;

/** Cambios de código que la IA propuso para lo que no cabe en props; acompañan a un cambio de descripción. */
export interface CambioIA {
  componente: string;
  /** uid → className completo nuevo. */
  clases: Record<string, string>;
}

export interface FicheroPropuesto {
  ruta: string;
  original: string;
  propuesto: string;
}

export interface Propuesta {
  ficheros: FicheroPropuesto[];
  json: Pagina;
  aplicadas: OperacionAplicable[];
  pendientes: Operacion[];
  fallidas: { op: OperacionAplicable; error: string }[];
}

export async function proponerCambios(
  jsonActual: unknown,
  md: string,
  leer: (ruta: string) => Promise<string>,
  cambiosIA: CambioIA[] = [],
): Promise<Propuesta> {
  validarPagina(jsonActual, 'El JSON actual');
  const ops = comparar(jsonActual, parsearPagina(md));

  const originales = new Map<string, string>();
  const codigo = new Map<string, string>();
  const json = structuredClone(jsonActual);
  const propuesta: Propuesta = { ficheros: [], json, aplicadas: [], pendientes: [], fallidas: [] };

  /** Aplica las ediciones sobre un borrador: si una falla, la op no deja nada a medias. */
  const editar = async (op: OperacionAplicable, pasos: [Ancla, (codigo: string, uid: string) => string][]) => {
    const borrador = new Map(codigo);
    try {
      for (const [ancla, aplicar] of pasos) {
        if (ancla.rol !== 'visual') throw new Error('el ancla es de lógica');
        if (!ancla.uid) throw new Error('el ancla usa selector CSS (aún no soportado)');
        if (!originales.has(ancla.fichero)) {
          const texto = await leer(ancla.fichero);
          originales.set(ancla.fichero, texto);
          borrador.set(ancla.fichero, texto);
        }
        borrador.set(ancla.fichero, aplicar(borrador.get(ancla.fichero)!, ancla.uid));
      }
    } catch (err) {
      propuesta.fallidas.push({ op, error: (err as Error).message });
      return false;
    }
    for (const [ruta, texto] of borrador) codigo.set(ruta, texto);
    propuesta.aplicadas.push(op);
    return true;
  };

  for (const op of ops) {
    const cambioIA = op.tipo === 'descripcion' ? cambiosIA.find((c) => c.componente === op.componente) : undefined;
    if (op.tipo === 'descripcion' && op.componente && cambioIA) {
      // La IA implementó en código lo que la nueva frase de la descripción cuenta.
      const anclas = Object.values(jsonActual.componentes[op.componente]?.anclas ?? {});
      const ajeno = Object.keys(cambioIA.clases).find((uid) => !anclas.some((a) => a.uid === uid));
      if (ajeno) {
        propuesta.fallidas.push({ op, error: `uid ${ajeno} no es un ancla de ${op.componente}` });
        continue;
      }
      const pasos = Object.entries(cambioIA.clases).map(([uid, clases]): [Ancla, (c: string, u: string) => string] => {
        const ancla = anclas.find((a) => a.uid === uid)!;
        return [ancla, (c, u) => reemplazarClassName(c, ancla.fichero, u, clases)];
      });
      if (await editar(op, pasos)) json.componentes[op.componente].descripcion = op.despues;
      continue;
    }

    if ((op.tipo !== 'prop' && op.tipo !== 'prop-nueva') || !propSoportada(op.prop)) {
      propuesta.pendientes.push(op);
      continue;
    }
    const comp = jsonActual.componentes[op.componente];
    const antes = op.tipo === 'prop' ? op.antes : undefined;
    let aplica: string[];
    if (op.tipo === 'prop') {
      aplica = comp.props![op.prop].aplica;
    } else {
      // Prop nueva: se aplica a la única ancla visual del componente; si hay varias, no se adivina.
      const visuales = Object.keys(comp.anclas).filter((n) => comp.anclas[n].rol === 'visual');
      if (visuales.length !== 1) {
        const error = visuales.length
          ? `tiene varias anclas visuales (${visuales.join(', ')}): aún no se sabe a cuál aplicarla`
          : 'no tiene anclas visuales';
        propuesta.fallidas.push({ op, error });
        continue;
      }
      aplica = visuales;
    }
    const pasos = aplica.map((nombre): [Ancla, (c: string, u: string) => string] => {
      const ancla = comp.anclas[nombre];
      return [ancla, (c, u) => aplicarProp(c, ancla.fichero, u, op.prop, antes, op.despues)];
    });
    if (await editar(op, pasos)) {
      const props = (json.componentes[op.componente].props ??= {});
      props[op.prop] = { valor: op.despues, aplica };
    }
  }

  validarPagina(json, 'El JSON resultante');
  for (const [ruta, propuesto] of codigo) {
    const original = originales.get(ruta)!;
    if (propuesto !== original) propuesta.ficheros.push({ ruta, original, propuesto });
  }
  return propuesta;
}
