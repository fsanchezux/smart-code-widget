import { PROPS_SOPORTADAS } from '../apply/props';
import { catalogoCompacto } from '../schema/catalogo';

// Skill que la extensión instala en el proyecto web (.claude/skills/ y .agents/skills/).
// Lo usan el chat de agentes y Claude Code para resolver los prompts *…* con el mínimo de pasos y tokens:
// el SKILL.md es corto y el catálogo va aparte, para leerlo solo si hace falta.

export const NOMBRE_SKILL = 'smart-code-widget';
/** Claude Code lee .claude/skills; el resto de agentes, la convención abierta .agents/skills. */
export const RUTAS_SKILL = [`.claude/skills/${NOMBRE_SKILL}`, `.agents/skills/${NOMBRE_SKILL}`];

const AVISO = '<!-- Generado por la extensión Smart Code Widget: se sobrescribe al cambiar el catálogo. -->';

export function skillMd(): string {
  return `---
name: ${NOMBRE_SKILL}
description: Resuelve un prompt *…* escrito en el bloque props de un documento de página de Smart Code Widget (frontend/paginas/*.md). Úsalo solo cuando se pida resolver un prompt *…*.
---
${AVISO}

# Resolver un prompt *…*

Haz SOLO estos pasos. No explores el proyecto, no toques otros ficheros, no ejecutes comandos, builds ni tests.

1. **Entender**: lee la sección del componente en el .md (desde su encabezado hasta el siguiente) y su entrada en \`frontend/paginas/<Pagina>.json\` (\`anclas\`: \`uid\` + \`fichero\`).
2. **Preparar**: exprésalo con props siempre que puedas, usando [catalogo.md](catalogo.md).
   - Props marcadas con ✓; para estados y responsive, con modificador delante de las props ◇: \`hover:background: green-500\`, \`hover:text-color: white\`, \`md:padding: 24px\`. Si cambia un estado, añade también \`transition: colors\`.
   - Solo si es imposible con props (animaciones, layouts complejos…) → cambio de código.
3. **Cambiar**:
   - **.md**: sustituye la línea \`*…*\` por las props (si una ya existe, cambia su valor; misma sangría). Las props ✓ las aplica la extensión al guardar: **no toques el código ni el JSON**.
   - **Código** (solo en el caso imposible): edita únicamente los elementos con \`data-uid\` de las anclas visuales del componente, normalmente su \`className\` (Tailwind v4), añade una frase que lo describa al final de la descripción del componente en el .md y deja la misma descripción en \`descripcion\` del JSON. Nada más del JSON.
4. Responde en una línea qué has cambiado.
`;
}

export function catalogoMd(): string {
  return `${AVISO}

# Catálogo de props

✓ = la extensión la aplica al código al guardar el .md. Las demás aún no tienen aplicador.

${catalogoCompacto(PROPS_SOPORTADAS)}
`;
}

/** Ficheros del skill: ruta relativa al proyecto → contenido. */
export function ficherosSkill(): Record<string, string> {
  return Object.fromEntries(
    RUTAS_SKILL.flatMap((ruta) => [[`${ruta}/SKILL.md`, skillMd()], [`${ruta}/catalogo.md`, catalogoMd()]]),
  );
}
