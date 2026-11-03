import { PROPS_SOPORTADAS } from '../apply/props';
import type { Valor } from '../modelo';
import { contextoYaml, type ContextoYaml, enProps } from '../parser/contextoYaml';
import { catalogoCompacto, definicionDe } from '../schema/catalogo';
import { NOMBRE_SKILL } from './skill';

// Prompts para la IA dentro de un bloque de props:
//   props:
//     border-radius: 8px
//     *texto verde al pasar el ratón*
// Lo que cabe en props ✓ lo aplica la extensión; lo demás la IA lo resuelve en el código de las anclas
// y lo describe en una frase del componente. Sin dependencias de vscode.

export interface PromptEnDoc {
  linea: number;
  peticion: string;
  componente: string;
  /** Líneas de la sección del componente (encabezado, yaml y descripción). */
  seccion: string;
  ctx: ContextoYaml;
}

export interface RespuestaIA {
  props: Record<string, Valor>;
  /** uid → className completo nuevo, para lo que no cabe en props. */
  clases: Record<string, string>;
  /** Frase que describe el cambio de código, para añadir a la descripción del componente. */
  descripcion?: string;
  explicacion: string;
}

/** Ancla visual del componente con su etiqueta de apertura, para que la IA pueda proponer clases. */
export interface AnclaParaIA {
  uid: string;
  fichero: string;
  apertura: string;
}

const PROMPT = /^\s*\*(?!\*)(.+?)\*\s*$/;
const ENCABEZADO = /^(#{2,6})\s+(\S+)/;

export function buscarPrompts(lineas: string[]): PromptEnDoc[] {
  const prompts: PromptEnDoc[] = [];
  for (let i = 0; i < lineas.length; i++) {
    const m = PROMPT.exec(lineas[i]);
    if (!m) continue;
    const ctx = contextoYaml(lineas, i);
    if (!ctx || !enProps(ctx, lineas, i)) continue;

    let inicio = ctx.inicio;
    while (inicio > 0 && !ENCABEZADO.test(lineas[inicio])) inicio--;
    const fin = finDeSeccion(lineas, ctx.fin);
    const componente = ENCABEZADO.exec(lineas[inicio])?.[2] ?? '?';
    const seccion = lineas.slice(inicio, fin + 1).filter((_, j) => inicio + j !== i).join('\n').trim();
    prompts.push({ linea: i, peticion: m[1].trim(), componente, seccion, ctx });
  }
  return prompts;
}

/** Última línea con texto de la sección que empieza tras el bloque yaml (o la valla de cierre si no hay descripción). */
function finDeSeccion(lineas: string[], vallaCierre: number): number {
  let fin = vallaCierre;
  for (let i = vallaCierre + 1; i < lineas.length && !/^#{1,6}\s/.test(lineas[i]); i++) {
    if (lineas[i].trim()) fin = i;
  }
  return fin;
}

/** Prompt para el chat de agentes: solo apunta al skill del proyecto y a las líneas a resolver. */
export function promptChat(ruta: string, prompts: PromptEnDoc[]): string {
  const lineas = prompts.map((p) => `- línea ${p.linea + 1} (${p.componente}): *${p.peticion}*`);
  return `Usa el skill ${NOMBRE_SKILL}. Resuelve en \`${ruta}\`:\n${lineas.join('\n')}`;
}

/** Prompt para el agente lanzado directamente (sin herramientas): mismo procedimiento que el skill, respuesta en JSON. */
export function promptAutomatico(datos: { prompt: PromptEnDoc; colores: string[]; anclas: AnclaParaIA[] }): string {
  const anclas = datos.anclas.map((a) => `- uid ${a.uid} (${a.fichero}): ${a.apertura}`).join('\n') || '(ninguna)';
  return `Resuelve un prompt de Smart Code Widget. Responde SOLO con JSON, sin texto alrededor:
{"props": {}, "clases": {}, "descripcion": "", "explicacion": ""}

- props: exprésalo con props siempre que puedas: las ✓ del catálogo y, para estados y responsive, con modificador delante de las ◇ (p. ej. "hover:background": "green-500", "md:padding": "24px"; si cambia un estado, añade "transition": "colors"). Si una ya existe, con el valor nuevo.
- clases: SOLO si es imposible con props (animaciones, layouts complejos…): uid → className COMPLETO nuevo (Tailwind v4). Solo uids de las anclas de abajo.
- descripcion: si usas clases, una frase que describa el cambio.
- explicacion: una frase en español.

Colores del tema: ${datos.colores.join(', ') || '(ninguno)'}

Catálogo:
${catalogoCompacto(PROPS_SOPORTADAS)}

Componente:
${datos.prompt.seccion}

Anclas visuales:
${anclas}

Petición: ${datos.prompt.peticion}`;
}

/** Extrae y valida la respuesta JSON del agente; descarta props fuera del catálogo y clases de uids ajenos. */
export function leerRespuesta(texto: string, uidsPermitidos: string[] = []): { respuesta: RespuestaIA; descartadas: string[] } {
  const inicio = texto.indexOf('{');
  const fin = texto.lastIndexOf('}');
  if (inicio === -1 || fin < inicio) throw new Error('la IA no devolvió JSON');
  const datos = JSON.parse(texto.slice(inicio, fin + 1));
  if (typeof datos !== 'object' || datos === null || typeof datos.props !== 'object' || datos.props === null) {
    throw new Error('la respuesta de la IA no tiene «props»');
  }

  const descartadas: string[] = [];
  const props: Record<string, Valor> = {};
  for (const [nombre, valor] of Object.entries(datos.props)) {
    if (definicionDe(nombre) && ['string', 'number', 'boolean'].includes(typeof valor)) props[nombre] = valor as Valor;
    else descartadas.push(nombre);
  }
  const clases: Record<string, string> = {};
  for (const [uid, valor] of Object.entries(datos.clases ?? {})) {
    if (uidsPermitidos.includes(uid) && typeof valor === 'string' && valor.trim()) clases[uid] = valor.trim().replace(/\s+/g, ' ');
    else descartadas.push(`clases de ${uid}`);
  }

  const explicacion = String(datos.explicacion ?? '');
  const respuesta: RespuestaIA = { props, clases, explicacion };
  const descripcion = String(datos.descripcion ?? '').trim() || (Object.keys(clases).length ? explicacion : '');
  if (Object.keys(clases).length && descripcion) respuesta.descripcion = descripcion;
  return { respuesta, descartadas };
}

/**
 * Cambios de líneas para sustituir el prompt por las props (las existentes se actualizan en su línea)
 * y, si hay `descripcion`, añadirla al final de la descripción del componente.
 * Devuelve línea → líneas que la sustituyen ([] = borrar).
 */
export function editarConRespuesta(
  lineas: string[], prompt: PromptEnDoc, props: Record<string, Valor>, descripcion?: string,
): Map<number, string[]> {
  const cambios = new Map<number, string[]>();
  const nuevas: string[] = [];
  const { ctx } = prompt;
  for (const [nombre, valor] of Object.entries(props)) {
    const linea = `${ctx.sangria}${nombre}: ${formatear(valor)}`;
    let existente = -1;
    for (let i = (ctx.lineaProps ?? ctx.fin) + 1; i <= (ctx.finProps ?? -1); i++) {
      if (new RegExp(`^\\s+${nombre}\\s*:`).test(lineas[i])) existente = i;
    }
    if (existente === -1) nuevas.push(linea);
    else cambios.set(existente, [linea]);
  }
  cambios.set(prompt.linea, nuevas);

  if (descripcion) {
    const fin = finDeSeccion(lineas, ctx.fin);
    cambios.set(fin, fin === ctx.fin ? [lineas[fin], descripcion] : [`${lineas[fin].trimEnd()} ${descripcion}`]);
  }
  return cambios;
}

function formatear(valor: Valor): string {
  if (typeof valor !== 'string') return String(valor);
  return /^[A-Za-z0-9][A-Za-z0-9._%/-]*$/.test(valor) && !['true', 'false', 'null'].includes(valor) ? valor : JSON.stringify(valor);
}
