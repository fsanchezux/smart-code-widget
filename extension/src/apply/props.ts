import ts from 'typescript';
import type { Valor } from '../modelo';
import { apertura, atributoLiteral, buscarPorUid, ErrorAplicacion, textoLiteral } from '../resolver/jsx';
import { cambiarColor, cambiarUtilidad, MODIFICADORES, PROPS_DE_CLASE, separarModificadores } from './tailwind';

// Camino rápido determinista: cambiar el valor de una prop tipada sin IA.
// Recibe el código del fichero y devuelve el código nuevo; nunca escribe en disco.
// `antes` undefined = prop nueva (el componente no la tenía en el JSON).
// `prop` puede llevar modificadores (hover:background, md:padding) en las props de estilo.

type Aplicador = (codigo: string, fichero: string, uid: string, prop: string, antes: Valor | undefined, despues: Valor) => string;
type CambioClases = (clases: string[], prop: string, antes: Valor | undefined, despues: Valor) => string[];

const editarClases = (cambiar: CambioClases): Aplicador => (codigo, fichero, uid, prop, antes, despues) => {
  const el = buscarPorUid(codigo, fichero, uid);
  const clase = atributoLiteral(el, 'className');
  if (!clase) {
    if (antes !== undefined) throw new ErrorAplicacion(`data-uid="${uid}" no tiene className`);
    return insertarAtributo(codigo, apertura(el), `className="${cambiar([], prop, antes, despues).join(' ')}"`);
  }
  const nuevas = cambiar(clase.valor.split(/\s+/).filter(Boolean), prop, antes, despues).join(' ');
  return reemplazar(codigo, clase.inicio, clase.fin, `"${nuevas}"`);
};

const editarAtributo = (nombre: string): Aplicador => (codigo, fichero, uid, _prop, antes, despues) => {
  const el = buscarPorUid(codigo, fichero, uid);
  const attr = atributoLiteral(el, nombre);
  const texto = String(despues);
  const valor = texto.includes('"') ? `{${JSON.stringify(texto)}}` : `"${texto}"`;
  if (attr) {
    if (antes !== undefined) comprobar(attr.valor, antes);
    return reemplazar(codigo, attr.inicio, attr.fin, valor);
  }
  if (antes !== undefined) throw new ErrorAplicacion(`data-uid="${uid}" no tiene ${nombre}`);
  return insertarAtributo(codigo, apertura(el), `${nombre}=${valor}`);
};

const editarTexto: Aplicador = (codigo, fichero, uid, _prop, antes, despues) => {
  const texto = textoLiteral(buscarPorUid(codigo, fichero, uid));
  if (antes !== undefined) comprobar(texto.valor, antes);
  return reemplazar(codigo, texto.inicio, texto.fin, texto.escribir(String(despues)));
};

const APLICADORES: Record<string, Aplicador> = {
  color: editarClases((clases, _prop, antes, despues) => cambiarColor(clases, antes, despues)),
  texto: editarTexto,
  placeholder: editarAtributo('placeholder'),
  ...Object.fromEntries([...PROPS_DE_CLASE].map((p) => [p, editarClases(cambiarUtilidad)])),
};

/** Props (sin modificador) que la extensión sabe aplicar al código. */
export const PROPS_SOPORTADAS = new Set(Object.keys(APLICADORES));

/** ¿Se aplica esta prop, con sus modificadores si los lleva? */
export function propSoportada(prop: string): boolean {
  const { variante, base } = separarModificadores(prop);
  if (!PROPS_SOPORTADAS.has(base)) return false;
  return !variante || (PROPS_DE_CLASE.has(base) && variante.split(':').every((m) => MODIFICADORES.includes(m)));
}

export function aplicarProp(
  codigo: string, fichero: string, uid: string, prop: string, antes: Valor | undefined, despues: Valor,
): string {
  const { variante, base } = separarModificadores(prop);
  const aplicador = APLICADORES[base];
  if (!aplicador) throw new ErrorAplicacion(`La prop «${base}» aún no tiene aplicador`);
  if (variante && !PROPS_DE_CLASE.has(base)) throw new ErrorAplicacion(`«${base}» no admite modificadores (${variante}:)`);
  return aplicador(codigo, fichero, uid, prop, antes, despues);
}

/** Sustituye el className completo del elemento (cambios propuestos por la IA fuera del catálogo). */
export function reemplazarClassName(codigo: string, fichero: string, uid: string, clases: string): string {
  const el = buscarPorUid(codigo, fichero, uid);
  const clase = atributoLiteral(el, 'className');
  if (clase) return reemplazar(codigo, clase.inicio, clase.fin, `"${clases}"`);
  return insertarAtributo(codigo, apertura(el), `className="${clases}"`);
}

// Si el código no coincide con el JSON, alguien lo editó a mano: no se pisa.
function comprobar(enCodigo: string, antes: Valor) {
  if (enCodigo !== String(antes)) {
    throw new ErrorAplicacion(`El código dice «${enCodigo}» pero el JSON dice «${antes}»: ¿se editó a mano?`);
  }
}

// Detrás del último atributo, respetando el formato: si van uno por línea, en una línea nueva con la misma sangría.
function insertarAtributo(codigo: string, el: ts.JsxOpeningLikeElement, atributo: string): string {
  const ultimo = el.attributes.properties.at(-1);
  if (!ultimo) return reemplazar(codigo, el.tagName.getEnd(), el.tagName.getEnd(), ` ${atributo}`);
  const inicioLinea = codigo.lastIndexOf('\n', ultimo.getStart()) + 1;
  const sangria = codigo.slice(inicioLinea, ultimo.getStart());
  const finDeLinea = codigo.includes('\r\n') ? '\r\n' : '\n';
  const separador = /^\s*$/.test(sangria) ? `${finDeLinea}${sangria}` : ' ';
  return reemplazar(codigo, ultimo.getEnd(), ultimo.getEnd(), `${separador}${atributo}`);
}

function reemplazar(codigo: string, inicio: number, fin: number, texto: string): string {
  return codigo.slice(0, inicio) + texto + codigo.slice(fin);
}
