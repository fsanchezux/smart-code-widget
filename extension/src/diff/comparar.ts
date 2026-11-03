import type { Pagina, Valor } from '../modelo';
import type { ComponenteDoc, PaginaDoc } from '../parser/markdown';

// JSON actual vs documento editado → lista de operaciones.
// En el Hito 1 solo se ejecutan las de tipo 'prop'; el resto quedan pendientes.

export type Operacion =
  | { tipo: 'prop'; componente: string; prop: string; antes: Valor; despues: Valor; linea: number }
  | { tipo: 'prop-nueva'; componente: string; prop: string; despues: Valor; linea: number }
  | { tipo: 'prop-eliminada'; componente: string; prop: string; antes: Valor; linea: number }
  | { tipo: 'tipo'; componente: string; antes: string; despues: string; linea: number }
  | { tipo: 'descripcion'; componente?: string; antes: string; despues: string; linea: number }
  | { tipo: 'componente-nuevo'; componente: string; linea: number }
  | { tipo: 'componente-eliminado'; componente: string }
  | { tipo: 'estructura'; detalle: string };

export function comparar(json: Pagina, doc: PaginaDoc): Operacion[] {
  const ops: Operacion[] = [];

  if (doc.pagina !== json.pagina) {
    ops.push({ tipo: 'estructura', detalle: `renombrar la página ${json.pagina} → ${doc.pagina}` });
    return ops;
  }
  if (doc.descripcion !== (json.descripcion ?? '')) {
    ops.push({ tipo: 'descripcion', antes: json.descripcion ?? '', despues: doc.descripcion, linea: 0 });
  }

  const enDoc = aplanar(json.pagina, doc.raiz);
  const id = (c: ComponenteDoc) => `${json.pagina}/${c.nombre}`;

  for (const [cid, { comp }] of enDoc) {
    const previo = json.componentes[cid];
    if (!previo) {
      ops.push({ tipo: 'componente-nuevo', componente: cid, linea: comp.linea });
      continue;
    }
    if (comp.tipo !== previo.tipo) {
      ops.push({ tipo: 'tipo', componente: cid, antes: previo.tipo, despues: comp.tipo, linea: comp.linea });
    }
    const propsPrevias = previo.props ?? {};
    for (const [prop, despues] of Object.entries(comp.props)) {
      const anterior = propsPrevias[prop];
      if (!anterior) ops.push({ tipo: 'prop-nueva', componente: cid, prop, despues, linea: comp.linea });
      else if (anterior.valor !== despues) {
        ops.push({ tipo: 'prop', componente: cid, prop, antes: anterior.valor, despues, linea: comp.linea });
      }
    }
    for (const [prop, { valor }] of Object.entries(propsPrevias)) {
      if (!(prop in comp.props)) ops.push({ tipo: 'prop-eliminada', componente: cid, prop, antes: valor, linea: comp.linea });
    }
    if (comp.descripcion !== (previo.descripcion ?? '')) {
      ops.push({
        tipo: 'descripcion', componente: cid, antes: previo.descripcion ?? '', despues: comp.descripcion, linea: comp.linea,
      });
    }
  }
  for (const cid of Object.keys(json.componentes)) {
    if (!enDoc.has(cid)) ops.push({ tipo: 'componente-eliminado', componente: cid });
  }

  // Orden y anidamiento, solo entre componentes que existen en ambos lados.
  const enAmbos = (cid: string) => enDoc.has(cid) && cid in json.componentes;
  const padres = new Set<string | null>([null, ...[...enDoc.keys()].filter(enAmbos)]);
  for (const padre of padres) {
    const hijosJson = (padre ? json.componentes[padre].hijos ?? [] : json.raiz).filter(enAmbos);
    const hijosDoc = (padre ? enDoc.get(padre)!.comp.hijos : doc.raiz).map(id).filter(enAmbos);
    if (hijosJson.join() !== hijosDoc.join()) {
      ops.push({ tipo: 'estructura', detalle: padre ? `cambian los hijos de ${padre}` : 'cambia el orden de la raíz' });
    }
  }
  return ops;
}

function aplanar(pagina: string, raiz: ComponenteDoc[]): Map<string, { comp: ComponenteDoc }> {
  const mapa = new Map<string, { comp: ComponenteDoc }>();
  const visitar = (comps: ComponenteDoc[]) => {
    for (const comp of comps) {
      mapa.set(`${pagina}/${comp.nombre}`, { comp });
      visitar(comp.hijos);
    }
  };
  visitar(raiz);
  return mapa;
}

/** Texto legible para mensajes y el canal de salida. */
export function describir(op: Operacion): string {
  const nombre = (cid?: string) => cid?.split('/')[1] ?? 'la página';
  switch (op.tipo) {
    case 'prop':
      return `${nombre(op.componente)}.${op.prop}: ${op.antes} → ${op.despues}`;
    case 'prop-nueva':
      return `${nombre(op.componente)}.${op.prop}: nueva = ${op.despues}`;
    case 'prop-eliminada':
      return `${nombre(op.componente)}: quitar la prop «${op.prop}»`;
    case 'tipo':
      return `${nombre(op.componente)}: cambiar tipo ${op.antes} → ${op.despues}`;
    case 'descripcion':
      return `descripción de ${nombre(op.componente)}`;
    case 'componente-nuevo':
      return `componente nuevo ${nombre(op.componente)} (Hito 4)`;
    case 'componente-eliminado':
      return `eliminar ${nombre(op.componente)} (Hito 4)`;
    case 'estructura':
      return `${op.detalle} (Hito 4)`;
  }
}
