// Catálogo de props tipadas: qué se puede escribir en `props:` y con qué valores.
// Es la referencia para el hover, el autocompletado y (más adelante) los aplicadores.
//
// Criterios:
// - Props de estilo con nombre CSS (kebab-case) para que sean reconocibles; contenido y comportamiento en español.
// - Valores cerrados (escalas, nombres del tema) siempre que se pueda: más tipado = más valor frente a un prompt.
// - Medidas en px; el aplicador las traduce a la escala de Tailwind (16px → p-4) o a un valor arbitrario.
// - Estados y responsive con modificadores delante de las props de estilo: `hover:background`, `md:padding`.
// - Lo que no cabe aquí (animaciones, degradados, layouts complejos) va en la descripción (IA, Hito 3).

import { MODIFICADORES, PROPS_DE_CLASE, separarModificadores } from '../apply/tailwind';

export type TipoValor =
  | { tipo: 'texto' }
  | { tipo: 'url' }
  | { tipo: 'booleano' }
  | { tipo: 'color' }
  | { tipo: 'opciones'; opciones: string[] }
  /** Medida libre (px, %, rem…) con sugerencias; `opciones` son palabras clave admitidas además de la medida. */
  | { tipo: 'medida'; sugerencias: string[]; opciones?: string[] };

export interface DefinicionProp {
  nombre: string;
  categoria: Categoria;
  descripcion: string;
  valor: TipoValor;
}

export const CATEGORIAS = [
  'Contenido', 'Tipografía', 'Color', 'Espaciado', 'Tamaño', 'Layout', 'Borde y forma', 'Efectos', 'Estado y accesibilidad',
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

const ESPACIOS = ['0', '4px', '8px', '12px', '16px', '24px', '32px', '48px', '64px'];
const texto: TipoValor = { tipo: 'texto' };
const opciones = (...o: string[]): TipoValor => ({ tipo: 'opciones', opciones: o });
const medida = (sugerencias: string[], ...extra: string[]): TipoValor => ({ tipo: 'medida', sugerencias, opciones: extra });

const p = (categoria: Categoria, nombre: string, descripcion: string, valor: TipoValor): DefinicionProp =>
  ({ nombre, categoria, descripcion, valor });

export const CATALOGO: DefinicionProp[] = [
  p('Contenido', 'texto', 'Texto visible del elemento.', texto),
  p('Contenido', 'placeholder', 'Texto de ayuda de un campo vacío.', texto),
  p('Contenido', 'enlace', 'Destino al pulsar (href).', { tipo: 'url' }),
  p('Contenido', 'destino', 'Dónde se abre el enlace.', opciones('misma', 'nueva')),
  p('Contenido', 'imagen', 'Ruta o URL de la imagen (src).', { tipo: 'url' }),
  p('Contenido', 'alt', 'Texto alternativo de la imagen.', texto),
  p('Contenido', 'tooltip', 'Texto al pasar el ratón (title).', texto),

  p('Tipografía', 'font-size', 'Tamaño del texto.', medida(['12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px', '48px'])),
  p('Tipografía', 'font-weight', 'Grosor del texto.', opciones('light', 'normal', 'medium', 'semibold', 'bold', 'extrabold')),
  p('Tipografía', 'font-family', 'Familia tipográfica del tema.', opciones('sans', 'serif', 'mono')),
  p('Tipografía', 'font-style', 'Cursiva.', opciones('normal', 'italic')),
  p('Tipografía', 'text-align', 'Alineación del texto.', opciones('left', 'center', 'right', 'justify')),
  p('Tipografía', 'line-height', 'Interlineado.', opciones('none', 'tight', 'snug', 'normal', 'relaxed', 'loose')),
  p('Tipografía', 'letter-spacing', 'Espaciado entre letras.', opciones('tighter', 'tight', 'normal', 'wide', 'wider', 'widest')),
  p('Tipografía', 'text-transform', 'Mayúsculas / minúsculas.', opciones('none', 'uppercase', 'lowercase', 'capitalize')),
  p('Tipografía', 'text-decoration', 'Subrayado o tachado.', opciones('none', 'underline', 'line-through')),

  p('Color', 'color', 'Color del tema del componente: cambia a la vez fondo, texto, borde y su hover.', { tipo: 'color' }),
  p('Color', 'background', 'Color de fondo.', { tipo: 'color' }),
  p('Color', 'text-color', 'Color del texto.', { tipo: 'color' }),
  p('Color', 'border-color', 'Color del borde.', { tipo: 'color' }),
  p('Color', 'opacity', 'Opacidad (0–100 %).', medida(['0%', '25%', '50%', '75%', '100%'])),

  p('Espaciado', 'padding', 'Relleno interior en los cuatro lados.', medida(ESPACIOS)),
  p('Espaciado', 'padding-x', 'Relleno interior izquierda y derecha.', medida(ESPACIOS)),
  p('Espaciado', 'padding-y', 'Relleno interior arriba y abajo.', medida(ESPACIOS)),
  p('Espaciado', 'margin', 'Margen exterior en los cuatro lados.', medida(ESPACIOS, 'auto')),
  p('Espaciado', 'margin-x', 'Margen exterior izquierda y derecha (auto = centrar).', medida(ESPACIOS, 'auto')),
  p('Espaciado', 'margin-y', 'Margen exterior arriba y abajo.', medida(ESPACIOS, 'auto')),
  p('Espaciado', 'gap', 'Separación entre hijos (flex/grid).', medida(ESPACIOS)),

  p('Tamaño', 'width', 'Ancho.', medida(['320px', '50%', '100%'], 'auto', 'full', 'fit', 'screen')),
  p('Tamaño', 'height', 'Alto.', medida(['48px', '200px', '100%'], 'auto', 'full', 'fit', 'screen')),
  p('Tamaño', 'max-width', 'Ancho máximo.', medida(['640px', '768px', '1024px'], 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', 'prose', 'full', 'none')),
  p('Tamaño', 'min-height', 'Alto mínimo.', medida(['200px', '50%'], 'full', 'screen')),

  p('Layout', 'display', 'Cómo se muestra el elemento.', opciones('block', 'inline', 'inline-block', 'flex', 'grid', 'hidden')),
  p('Layout', 'flex-direction', 'Dirección de los hijos en flex.', opciones('row', 'column', 'row-reverse', 'column-reverse')),
  p('Layout', 'align-items', 'Alineación de los hijos en el eje cruzado.', opciones('start', 'center', 'end', 'stretch', 'baseline')),
  p('Layout', 'justify-content', 'Reparto de los hijos en el eje principal.', opciones('start', 'center', 'end', 'between', 'around', 'evenly')),
  p('Layout', 'flex-wrap', 'Si los hijos saltan de línea.', opciones('nowrap', 'wrap')),
  p('Layout', 'columns', 'Número de columnas de la rejilla (grid).', opciones('1', '2', '3', '4', '5', '6', '12')),
  p('Layout', 'position', 'Posicionamiento.', opciones('static', 'relative', 'absolute', 'fixed', 'sticky')),
  p('Layout', 'overflow', 'Qué pasa con el contenido que no cabe.', opciones('visible', 'hidden', 'auto', 'scroll')),
  p('Layout', 'z-index', 'Orden de apilado.', opciones('0', '10', '20', '30', '40', '50', 'auto')),

  p('Borde y forma', 'border-radius', 'Redondeo de las esquinas.', medida(['0', '4px', '6px', '8px', '12px', '16px', '24px', '32px'], 'full')),
  p('Borde y forma', 'border-width', 'Grosor del borde.', opciones('0', '1px', '2px', '4px', '8px')),
  p('Borde y forma', 'border-style', 'Estilo del borde.', opciones('solid', 'dashed', 'dotted', 'none')),

  p('Efectos', 'shadow', 'Sombra.', opciones('none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl')),
  p('Efectos', 'cursor', 'Cursor al pasar el ratón.', opciones('default', 'pointer', 'not-allowed', 'text')),
  p('Efectos', 'transition', 'Transición suave al cambiar de estado.', opciones('none', 'colors', 'all')),

  p('Estado y accesibilidad', 'visible', 'Si el elemento se muestra.', { tipo: 'booleano' }),
  p('Estado y accesibilidad', 'deshabilitado', 'Botón o campo deshabilitado.', { tipo: 'booleano' }),
  p('Estado y accesibilidad', 'requerido', 'Campo obligatorio en un formulario.', { tipo: 'booleano' }),
  p('Estado y accesibilidad', 'tipo-campo', 'Tipo de un campo de texto.', opciones('text', 'email', 'password', 'number', 'search', 'tel', 'url')),
  p('Estado y accesibilidad', 'etiqueta-accesible', 'Nombre para lectores de pantalla (aria-label).', texto),
];

export const PROPS_POR_NOMBRE = new Map(CATALOGO.map((d) => [d.nombre, d]));

export { MODIFICADORES };

/** ¿Admite modificadores (hover:, md:…)? Solo las props de estilo que se aplican con clases. */
export const admiteModificadores = (nombre: string) => PROPS_DE_CLASE.has(nombre);

/** Definición de una prop, también con modificadores (`hover:background` → background); undefined si no es válida. */
export function definicionDe(nombre: string): DefinicionProp | undefined {
  const { variante, base } = separarModificadores(nombre);
  const def = PROPS_POR_NOMBRE.get(base);
  if (!def || !variante) return def;
  const validos = variante.split(':').every((m) => MODIFICADORES.includes(m));
  return validos && admiteModificadores(base) ? def : undefined;
}

/** Tipos de componente sugeridos para `tipo:`. */
export const TIPOS_COMPONENTE = ['grupo', 'section', 'text', 'heading', 'button', 'link', 'input', 'select', 'image', 'list', 'item', 'form', 'nav'];

/** Valores que se sugieren para una prop; `colores` son los nombres del tema del proyecto. */
export function valoresSugeridos(def: DefinicionProp, colores: string[]): string[] {
  switch (def.valor.tipo) {
    case 'opciones': return def.valor.opciones;
    case 'medida': return [...def.valor.sugerencias, ...(def.valor.opciones ?? [])];
    case 'booleano': return ['true', 'false'];
    case 'color': return colores;
    default: return [];
  }
}

/** Catálogo en texto compacto para la IA (una línea por prop; ✓ = tiene aplicador; ◇ = admite modificadores). */
export function catalogoCompacto(soportadas: Set<string>): string {
  const lista = CATEGORIAS.map((categoria) => {
    const props = CATALOGO.filter((d) => d.categoria === categoria).map((d) => {
      const marcas = `${soportadas.has(d.nombre) ? ' ✓' : ''}${admiteModificadores(d.nombre) ? ' ◇' : ''}`;
      return `- ${d.nombre}${marcas}: ${resumenValores(d)} — ${d.descripcion}`;
    });
    return `${categoria}:\n${props.join('\n')}`;
  }).join('\n');
  return `Modificadores para las props ◇ (estados y responsive): ${MODIFICADORES.map((m) => `${m}:`).join(' ')} — p. ej. \`hover:background: green-500\`, \`md:padding: 24px\`.\n\n${lista}`;
}

/** Resumen corto de los valores admitidos, para el hover. */
export function resumenValores(def: DefinicionProp): string {
  switch (def.valor.tipo) {
    case 'texto': return 'texto';
    case 'url': return 'ruta o URL';
    case 'booleano': return 'true | false';
    case 'color': return 'color del tema (primario) o de la paleta (green-500)';
    case 'opciones': return def.valor.opciones.join(' | ');
    case 'medida': return ['medida (px, %, rem)', ...(def.valor.opciones ?? [])].join(' | ');
  }
}
