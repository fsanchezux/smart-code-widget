import type { Valor } from '../modelo';
import { ErrorAplicacion } from '../resolver/jsx';

// Edición de clases Tailwind (v4). Funciones puras sobre la lista de clases.
// Solo se tocan utilidades sin variante (rounded-lg sí, hover:rounded-lg / rounded-t-lg no),
// salvo en color, donde se cambian también las variantes (hover:bg-primario-oscuro).

const RADIOS: Record<string, string> = {
  '0': 'rounded-none',
  '0px': 'rounded-none',
  '2px': 'rounded-xs',
  '4px': 'rounded-sm',
  '6px': 'rounded-md',
  '8px': 'rounded-lg',
  '12px': 'rounded-xl',
  '16px': 'rounded-2xl',
  '24px': 'rounded-3xl',
  '32px': 'rounded-4xl',
  '9999px': 'rounded-full',
  full: 'rounded-full',
};

const ES_RADIO = /^rounded(-(none|xs|sm|md|lg|xl|2xl|3xl|4xl|full|\[[^\]]+\]))?$/;

export function claseRadio(valor: Valor): string {
  const v = typeof valor === 'number' ? `${valor}px` : String(valor).trim();
  if (RADIOS[v]) return RADIOS[v];
  if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(v)) return `rounded-[${v}]`;
  throw new ErrorAplicacion(`border-radius «${v}» no válido (usa px, rem, em, % o full)`);
}

export function cambiarRadio(clases: string[], antes: Valor, despues: Valor): string[] {
  const esperada = claseRadio(antes);
  const nueva = claseRadio(despues);
  const actuales = clases.filter((c) => ES_RADIO.test(c));
  if (actuales.length && !actuales.includes(esperada)) {
    throw new ErrorAplicacion(`El código tiene ${actuales.join(' ')} pero el JSON dice ${antes} (${esperada}): ¿se editó a mano?`);
  }
  const posicion = clases.findIndex((c) => ES_RADIO.test(c));
  const resto = clases.filter((c) => !ES_RADIO.test(c));
  if (posicion === -1) return [...resto, nueva];
  resto.splice(posicion, 0, nueva);
  return resto;
}

const UTILIDADES_COLOR = ['bg', 'text', 'border', 'ring', 'outline', 'fill', 'stroke', 'decoration', 'accent', 'caret'];
const NOMBRE_COLOR = /^[a-z][a-z0-9-]*$/;

/** Cambia el color con nombre del tema: bg-primario → bg-secundario, hover:bg-primario-oscuro → hover:bg-secundario-oscuro. */
export function cambiarColor(clases: string[], antes: Valor, despues: Valor): string[] {
  for (const v of [antes, despues]) {
    if (typeof v !== 'string' || !NOMBRE_COLOR.test(v)) {
      throw new ErrorAplicacion(`color «${v}» no válido: usa un nombre del tema (primario, secundario…)`);
    }
  }
  const patron = new RegExp(`^((?:[\\w-]+:)*)(${UTILIDADES_COLOR.join('|')})-${antes}(-oscuro)?(/\\d+)?$`);
  let cambios = 0;
  const resultado = clases.map((c) => {
    const m = patron.exec(c);
    if (!m) return c;
    cambios++;
    return `${m[1]}${m[2]}-${despues}${m[3] ?? ''}${m[4] ?? ''}`;
  });
  if (!cambios) throw new ErrorAplicacion(`No hay clases con el color «${antes}» (bg-${antes}, text-${antes}…): ¿se editó a mano?`);
  return resultado;
}
