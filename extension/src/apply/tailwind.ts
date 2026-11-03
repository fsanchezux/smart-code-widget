import type { Valor } from '../modelo';
import { ErrorAplicacion } from '../resolver/jsx';

// Edición de clases Tailwind (v4). Funciones puras sobre la lista de clases.
// Cada prop de estilo es una "utilidad": cómo se escribe su clase y cómo reconocer las clases de su familia.
// Un modificador (hover:, md:…) solo toca las clases con ese mismo prefijo: rounded-lg y hover:rounded-xl son independientes.

export interface Utilidad {
  /** Clase (sin modificador) para un valor; lanza ErrorAplicacion si el valor no es válido. */
  clase(valor: Valor): string;
  /** ¿Esta clase (sin modificador) es de la familia de la utilidad? */
  esFamilia(clase: string): boolean;
}

const texto = (v: Valor) => (typeof v === 'number' ? `${v}px` : String(v).trim());
const invalido = (prop: string, v: Valor, ayuda: string) => new ErrorAplicacion(`${prop} «${v}» no válido (${ayuda})`);
const MEDIDA = /^\d+(\.\d+)?(px|rem|em|%)$/;
const ARBITRARIO = '\\[[^\\]]+\\]';

/** Valor de una lista cerrada → clase. */
function opciones(prop: string, tabla: Record<string, string>, familia: RegExp): Utilidad {
  return {
    clase(v) {
      const c = tabla[texto(v)];
      if (!c) throw invalido(prop, v, Object.keys(tabla).join(', '));
      return c;
    },
    esFamilia: (c) => familia.test(c),
  };
}

/** Espaciado: 16px → p-4 (escala de 0.25rem); otros valores → p-[10px]. */
function espaciado(prop: string, prefijo: string, conAuto = false): Utilidad {
  return {
    clase(v) {
      const t = texto(v);
      if (t === '0' || t === '0px') return `${prefijo}-0`;
      if (conAuto && t === 'auto') return `${prefijo}-auto`;
      const px = /^(\d+(?:\.\d+)?)px$/.exec(t);
      if (px && (Number(px[1]) / 4) % 0.5 === 0) return `${prefijo}-${Number(px[1]) / 4}`;
      if (MEDIDA.test(t)) return `${prefijo}-[${t}]`;
      throw invalido(prop, v, `medida en px, rem, em o %${conAuto ? ', o auto' : ''}`);
    },
    esFamilia: (c) => new RegExp(`^${prefijo}-(\\d+(\\.\\d+)?|px|auto|${ARBITRARIO})$`).test(c),
  };
}

// Sufijos de bg-/text-/border- que no son colores (para no confundir text-center con un color).
const NO_COLOR: Record<string, RegExp> = {
  bg: /^(cover|contain|auto|center|top|bottom|left|right|left-top|left-bottom|right-top|right-bottom|fixed|local|scroll|repeat.*|no-repeat|clip-.*|origin-.*|none|linear-.*|radial.*|conic.*|gradient-.*|blend-.*)$/,
  text: /^(xs|sm|base|lg|xl|\d+xl|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|shadow.*|\[.*\])$/,
  border: /^(\d+|solid|dashed|dotted|double|hidden|none|collapse|separate|spacing.*|[trblxyse]|[trblxyse]-.*)$/,
};
const COLOR = /^([a-z]+(-[a-z]+)*(-\d{2,3})?|\[[^\]]+\])(\/\d+)?$/;

/** Color: nombre del tema (primario) o de la paleta (green-500), white, black, transparent. */
function color(prop: string, prefijo: 'bg' | 'text' | 'border'): Utilidad {
  return {
    clase(v) {
      const t = texto(v);
      if (!/^[a-z]+(-[a-z]+)*(-\d{2,3})?$/.test(t)) throw invalido(prop, v, 'nombre de color del tema o de la paleta, p. ej. primario o green-500');
      return `${prefijo}-${t}`;
    },
    esFamilia(c) {
      if (!c.startsWith(`${prefijo}-`)) return false;
      const sufijo = c.slice(prefijo.length + 1);
      return COLOR.test(sufijo) && !NO_COLOR[prefijo].test(sufijo);
    },
  };
}

const RADIOS: Record<string, string> = {
  '0': 'rounded-none', '0px': 'rounded-none', '2px': 'rounded-xs', '4px': 'rounded-sm', '6px': 'rounded-md',
  '8px': 'rounded-lg', '12px': 'rounded-xl', '16px': 'rounded-2xl', '24px': 'rounded-3xl', '32px': 'rounded-4xl',
  '9999px': 'rounded-full', full: 'rounded-full',
};

export function claseRadio(valor: Valor): string {
  const v = texto(valor);
  if (RADIOS[v]) return RADIOS[v];
  if (MEDIDA.test(v)) return `rounded-[${v}]`;
  throw invalido('border-radius', valor, 'usa px, rem, em, % o full');
}

const TAMAÑOS_TEXTO: Record<string, string> = {
  '12px': 'text-xs', '14px': 'text-sm', '16px': 'text-base', '18px': 'text-lg', '20px': 'text-xl', '24px': 'text-2xl',
  '30px': 'text-3xl', '36px': 'text-4xl', '48px': 'text-5xl', '60px': 'text-6xl', '72px': 'text-7xl',
};

const UTILIDADES: Record<string, Utilidad> = {
  'border-radius': {
    clase: claseRadio,
    esFamilia: (c) => new RegExp(`^rounded(-(none|xs|sm|md|lg|xl|2xl|3xl|4xl|full|${ARBITRARIO}))?$`).test(c),
  },
  background: color('background', 'bg'),
  'text-color': color('text-color', 'text'),
  'border-color': color('border-color', 'border'),
  'font-size': {
    clase(v) {
      const t = texto(v);
      if (TAMAÑOS_TEXTO[t]) return TAMAÑOS_TEXTO[t];
      if (MEDIDA.test(t)) return `text-[${t}]`;
      throw invalido('font-size', v, 'medida en px, rem o em');
    },
    esFamilia: (c) => new RegExp(`^text-(xs|sm|base|lg|xl|[2-9]xl|\\[\\d+(\\.\\d+)?(px|rem|em)\\])$`).test(c),
  },
  'font-weight': opciones('font-weight',
    { light: 'font-light', normal: 'font-normal', medium: 'font-medium', semibold: 'font-semibold', bold: 'font-bold', extrabold: 'font-extrabold' },
    /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/),
  'text-align': opciones('text-align',
    { left: 'text-left', center: 'text-center', right: 'text-right', justify: 'text-justify' },
    /^text-(left|center|right|justify|start|end)$/),
  'text-transform': opciones('text-transform',
    { none: 'normal-case', uppercase: 'uppercase', lowercase: 'lowercase', capitalize: 'capitalize' },
    /^(normal-case|uppercase|lowercase|capitalize)$/),
  'text-decoration': opciones('text-decoration',
    { none: 'no-underline', underline: 'underline', 'line-through': 'line-through' },
    /^(no-underline|underline|line-through|overline)$/),
  opacity: {
    clase(v) {
      const n = Number(texto(v).replace('%', ''));
      if (!Number.isInteger(n) || n < 0 || n > 100) throw invalido('opacity', v, 'porcentaje entero de 0% a 100%');
      return `opacity-${n}`;
    },
    esFamilia: (c) => /^opacity-\d+$/.test(c),
  },
  padding: espaciado('padding', 'p'),
  'padding-x': espaciado('padding-x', 'px'),
  'padding-y': espaciado('padding-y', 'py'),
  margin: espaciado('margin', 'm', true),
  'margin-x': espaciado('margin-x', 'mx', true),
  'margin-y': espaciado('margin-y', 'my', true),
  gap: espaciado('gap', 'gap'),
  'border-width': opciones('border-width',
    { '0': 'border-0', '1px': 'border', '2px': 'border-2', '4px': 'border-4', '8px': 'border-8' },
    /^border(-(0|2|4|8))?$/),
  shadow: opciones('shadow',
    { none: 'shadow-none', xs: 'shadow-xs', sm: 'shadow-sm', md: 'shadow-md', lg: 'shadow-lg', xl: 'shadow-xl', '2xl': 'shadow-2xl' },
    /^shadow(-(none|2xs|xs|sm|md|lg|xl|2xl))?$/),
  transition: opciones('transition',
    { none: 'transition-none', colors: 'transition-colors', all: 'transition-all' },
    /^transition(-(none|colors|all|opacity|shadow|transform))?$/),
  cursor: opciones('cursor',
    { default: 'cursor-default', pointer: 'cursor-pointer', 'not-allowed': 'cursor-not-allowed', text: 'cursor-text' },
    /^cursor-[a-z-]+$/),
};

/** Props de estilo que se aplican editando clases (admiten modificadores hover:, md:…). */
export const PROPS_DE_CLASE = new Set(Object.keys(UTILIDADES));

/** Modificadores admitidos delante de una prop de estilo: `hover:background`, `md:padding`, `md:hover:…`. */
export const MODIFICADORES = ['hover', 'focus', 'active', 'disabled', 'sm', 'md', 'lg', 'xl', '2xl'];

/** `md:hover:background` → { variante: 'md:hover', base: 'background' }. */
export function separarModificadores(prop: string): { variante: string; base: string } {
  const partes = prop.split(':');
  return { variante: partes.slice(0, -1).join(':'), base: partes[partes.length - 1] };
}

/**
 * Cambia la clase de una utilidad con su variante. antes undefined = prop nueva:
 * sustituye la clase de la familia que hubiera con esa variante o la añade al final.
 */
export function cambiarUtilidad(clases: string[], prop: string, antes: Valor | undefined, despues: Valor): string[] {
  const { variante, base } = separarModificadores(prop);
  const utilidad = UTILIDADES[base];
  if (!utilidad) throw new ErrorAplicacion(`La prop «${base}» no se aplica con clases`);
  const desconocido = variante.split(':').find((m) => m && !MODIFICADORES.includes(m));
  if (desconocido) throw new ErrorAplicacion(`Modificador «${desconocido}:» no admitido (${MODIFICADORES.join(', ')})`);

  const prefijo = variante ? `${variante}:` : '';
  const esDeLaFamilia = (c: string) => {
    if (!c.startsWith(prefijo)) return false;
    const resto = c.slice(prefijo.length);
    return !resto.includes(':') && utilidad.esFamilia(resto);
  };
  const nueva = prefijo + utilidad.clase(despues);
  const actuales = clases.filter(esDeLaFamilia);
  const esperada = antes === undefined ? undefined : prefijo + utilidad.clase(antes);
  if (esperada && actuales.length && !actuales.includes(esperada)) {
    throw new ErrorAplicacion(`El código tiene ${actuales.join(' ')} pero el JSON dice ${antes} (${esperada}): ¿se editó a mano?`);
  }
  const posicion = clases.findIndex(esDeLaFamilia);
  const resto = clases.filter((c) => !esDeLaFamilia(c));
  if (posicion === -1) return [...resto, nueva];
  resto.splice(posicion, 0, nueva);
  return resto;
}

export function cambiarRadio(clases: string[], antes: Valor | undefined, despues: Valor): string[] {
  return cambiarUtilidad(clases, 'border-radius', antes, despues);
}

const UTILIDADES_COLOR = ['bg', 'text', 'border', 'ring', 'outline', 'fill', 'stroke', 'decoration', 'accent', 'caret'];
const NOMBRE_COLOR = /^[a-z][a-z0-9-]*$/;

/** Cambia el color con nombre del tema: bg-primario → bg-secundario, hover:bg-primario-oscuro → hover:bg-secundario-oscuro. */
export function cambiarColor(clases: string[], antes: Valor | undefined, despues: Valor): string[] {
  if (antes === undefined) {
    throw new ErrorAplicacion('«color» nuevo: no se sabe qué clases de color sustituir; usa background o text-color');
  }
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
