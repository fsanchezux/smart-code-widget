import Ajv2020 from 'ajv/dist/2020';
import type { Pagina } from '../modelo';
import esquema from './pagina.schema.json';

const validarEsquema = new Ajv2020({ allErrors: true }).compile(esquema);

/** Errores de esquema y de coherencia (referencias cruzadas que JSON Schema no expresa). */
export function erroresPagina(datos: unknown): string[] {
  if (!validarEsquema(datos)) {
    return (validarEsquema.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`);
  }
  const pagina = datos as unknown as Pagina;
  const errores: string[] = [];
  const ids = Object.keys(pagina.componentes);

  const referencias = [...pagina.raiz, ...ids.flatMap((id) => pagina.componentes[id].hijos ?? [])];
  for (const ref of new Set(referencias)) {
    if (!ids.includes(ref)) errores.push(`${ref} se referencia pero no existe`);
  }
  for (const id of ids) {
    const veces = referencias.filter((r) => r === id).length;
    if (veces !== 1) errores.push(`${id} debe aparecer exactamente una vez en raiz/hijos (aparece ${veces})`);
  }

  const uids = new Set<string>();
  for (const [id, c] of Object.entries(pagina.componentes)) {
    for (const [prop, { aplica }] of Object.entries(c.props ?? {})) {
      for (const ancla of aplica) {
        if (!(ancla in c.anclas)) errores.push(`${id}.${prop} aplica a "${ancla}", que no es un ancla de ${id}`);
      }
    }
    for (const ancla of Object.values(c.anclas)) {
      if (!ancla.uid) continue;
      if (uids.has(ancla.uid)) errores.push(`uid ${ancla.uid} repetido`);
      uids.add(ancla.uid);
    }
  }
  return errores;
}

export function validarPagina(datos: unknown, nombre = 'JSON'): asserts datos is Pagina {
  const errores = erroresPagina(datos);
  if (errores.length) throw new Error(`${nombre} no es válido:\n- ${errores.join('\n- ')}`);
}
