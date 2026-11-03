import type { Valor } from '../modelo';
import { atributoLiteral, buscarPorUid, ErrorAplicacion, textoLiteral } from '../resolver/jsx';
import { cambiarColor, cambiarRadio } from './tailwind';

// Camino rápido determinista: cambiar el valor de una prop tipada sin IA.
// Recibe el código del fichero y devuelve el código nuevo; nunca escribe en disco.

type Aplicador = (codigo: string, fichero: string, uid: string, antes: Valor, despues: Valor) => string;

const editarClases = (cambiar: (clases: string[], antes: Valor, despues: Valor) => string[]): Aplicador =>
  (codigo, fichero, uid, antes, despues) => {
    const clase = atributoLiteral(buscarPorUid(codigo, fichero, uid), 'className');
    if (!clase) throw new ErrorAplicacion(`data-uid="${uid}" no tiene className`);
    const nuevas = cambiar(clase.valor.split(/\s+/).filter(Boolean), antes, despues).join(' ');
    return reemplazar(codigo, clase.inicio, clase.fin, `"${nuevas}"`);
  };

const editarAtributo = (nombre: string): Aplicador => (codigo, fichero, uid, antes, despues) => {
  const attr = atributoLiteral(buscarPorUid(codigo, fichero, uid), nombre);
  if (!attr) throw new ErrorAplicacion(`data-uid="${uid}" no tiene ${nombre}`);
  comprobar(attr.valor, antes);
  const texto = String(despues);
  return reemplazar(codigo, attr.inicio, attr.fin, texto.includes('"') ? `{${JSON.stringify(texto)}}` : `"${texto}"`);
};

const editarTexto: Aplicador = (codigo, fichero, uid, antes, despues) => {
  const texto = textoLiteral(buscarPorUid(codigo, fichero, uid));
  comprobar(texto.valor, antes);
  const nuevo = String(despues);
  return reemplazar(codigo, texto.inicio, texto.fin, /[{}<>]/.test(nuevo) ? `{${JSON.stringify(nuevo)}}` : nuevo);
};

const APLICADORES: Record<string, Aplicador> = {
  'border-radius': editarClases(cambiarRadio),
  color: editarClases(cambiarColor),
  texto: editarTexto,
  placeholder: editarAtributo('placeholder'),
};

export const PROPS_SOPORTADAS = new Set(Object.keys(APLICADORES));

export function aplicarProp(codigo: string, fichero: string, uid: string, prop: string, antes: Valor, despues: Valor): string {
  const aplicador = APLICADORES[prop];
  if (!aplicador) throw new ErrorAplicacion(`La prop «${prop}» aún no tiene aplicador`);
  return aplicador(codigo, fichero, uid, antes, despues);
}

// Si el código no coincide con el JSON, alguien lo editó a mano: no se pisa.
function comprobar(enCodigo: string, antes: Valor) {
  if (enCodigo !== String(antes)) {
    throw new ErrorAplicacion(`El código dice «${enCodigo}» pero el JSON dice «${antes}»: ¿se editó a mano?`);
  }
}

function reemplazar(codigo: string, inicio: number, fin: number, texto: string): string {
  return codigo.slice(0, inicio) + texto + codigo.slice(fin);
}
