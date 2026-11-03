import { parse as parsearYaml, YAMLParseError } from 'yaml';
import type { Valor } from '../modelo';

// .md de página → árbol de componentes tal como lo escribe el usuario.
// No conoce las anclas: esas viven solo en el JSON.
//
//   # Home                 → nombre de la página (una vez, al principio)
//   texto                  → descripción de la página
//   ## Hero                → componente de primer nivel
//   ```yaml tipo/props```  → justo debajo del encabezado (obligatorio)
//   texto                  → descripción del componente
//   ### Titulo             → hijo del encabezado anterior de un nivel menos

export interface ComponenteDoc {
  nombre: string;
  tipo: string;
  props: Record<string, Valor>;
  descripcion: string;
  hijos: ComponenteDoc[];
  /** Línea del encabezado (0-based). */
  linea: number;
}

export interface PaginaDoc {
  pagina: string;
  descripcion: string;
  raiz: ComponenteDoc[];
}

export class ErrorDocumento extends Error {
  /** linea: 0-based. */
  constructor(mensaje: string, readonly linea: number) {
    super(mensaje);
  }
}

const ENCABEZADO = /^(#{1,6})\s+(.+?)\s*$/;
const VALLA = /^```\s*(\S*)\s*$/;
const NOMBRE = /^[A-Z][A-Za-z0-9]*$/;

interface EnCurso {
  comp: ComponenteDoc;
  nivel: number;
  texto: string[];
  conYaml: boolean;
}

export function parsearPagina(md: string): PaginaDoc {
  const lineas = md.split(/\r?\n/);
  let pagina: string | undefined;
  const descripcionPagina: string[] = [];
  const raiz: ComponenteDoc[] = [];
  const nombres = new Set<string>();
  const pila: EnCurso[] = [];
  let actual: EnCurso | undefined;

  const cerrar = () => {
    if (!actual) return;
    if (!actual.conYaml) {
      throw new ErrorDocumento(`Falta el bloque \`\`\`yaml con «tipo» debajo de «${actual.comp.nombre}»`, actual.comp.linea);
    }
    actual.comp.descripcion = unir(actual.texto);
  };

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];

    const valla = VALLA.exec(linea);
    if (valla) {
      let fin = i + 1;
      while (fin < lineas.length && !/^```\s*$/.test(lineas[fin])) fin++;
      if (fin >= lineas.length) throw new ErrorDocumento('Bloque de código sin cerrar', i);

      const esBloqueDelComponente =
        valla[1] === 'yaml' && actual && !actual.conYaml && actual.texto.every((t) => !t.trim());
      if (esBloqueDelComponente) {
        Object.assign(actual!.comp, leerYaml(lineas.slice(i + 1, fin).join('\n'), i + 1));
        actual!.conYaml = true;
      } else {
        (actual?.texto ?? descripcionPagina).push(...lineas.slice(i, fin + 1));
      }
      i = fin;
      continue;
    }

    const encabezado = ENCABEZADO.exec(linea);
    if (encabezado) {
      const nivel = encabezado[1].length;
      const nombre = encabezado[2];

      if (nivel === 1) {
        if (pagina !== undefined || actual) throw new ErrorDocumento('Solo puede haber un título «#», al principio', i);
        pagina = nombre;
        continue;
      }
      if (pagina === undefined) throw new ErrorDocumento('Falta el título «# Pagina» antes de los componentes', i);
      if (!NOMBRE.test(nombre)) throw new ErrorDocumento(`«${nombre}» no es un nombre válido (PascalCase, sin espacios)`, i);
      if (nombres.has(nombre)) throw new ErrorDocumento(`El componente «${nombre}» está repetido en la página`, i);
      nombres.add(nombre);

      cerrar();
      while (pila.length && pila[pila.length - 1].nivel >= nivel) pila.pop();
      const padre = pila[pila.length - 1];
      if ((padre?.nivel ?? 1) !== nivel - 1) {
        throw new ErrorDocumento(`Salto de nivel: «${nombre}» (${'#'.repeat(nivel)}) no tiene un padre de nivel ${nivel - 1}`, i);
      }

      const comp: ComponenteDoc = { nombre, tipo: '', props: {}, descripcion: '', hijos: [], linea: i };
      (padre ? padre.comp.hijos : raiz).push(comp);
      actual = { comp, nivel, texto: [], conYaml: false };
      pila.push(actual);
      continue;
    }

    (actual?.texto ?? descripcionPagina).push(linea);
  }

  cerrar();
  if (pagina === undefined) throw new ErrorDocumento('Falta el título «# Pagina»', 0);
  return { pagina, descripcion: unir(descripcionPagina), raiz };
}

function leerYaml(contenido: string, lineaInicio: number): Pick<ComponenteDoc, 'tipo' | 'props'> {
  let datos: unknown;
  try {
    datos = parsearYaml(contenido);
  } catch (err) {
    const linea = err instanceof YAMLParseError ? (err.linePos?.[0].line ?? 1) - 1 : 0;
    throw new ErrorDocumento(`YAML no válido: ${(err as Error).message.split('\n')[0]}`, lineaInicio + linea);
  }
  if (!esMapa(datos)) throw new ErrorDocumento('El bloque yaml debe ser un mapa con «tipo» y «props»', lineaInicio);

  const { tipo, props = {}, ...resto } = datos;
  const desconocida = Object.keys(resto)[0];
  if (desconocida) throw new ErrorDocumento(`Clave desconocida «${desconocida}» (solo se admiten «tipo» y «props»)`, lineaInicio);
  if (typeof tipo !== 'string' || !tipo) throw new ErrorDocumento('Falta «tipo» en el bloque yaml', lineaInicio);
  if (!esMapa(props)) throw new ErrorDocumento('«props» debe ser un mapa nombre: valor', lineaInicio);

  for (const [nombre, valor] of Object.entries(props)) {
    if (!['string', 'number', 'boolean'].includes(typeof valor)) {
      throw new ErrorDocumento(`La prop «${nombre}» debe ser un valor simple (texto, número o booleano)`, lineaInicio);
    }
  }
  return { tipo, props: props as Record<string, Valor> };
}

function esMapa(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function unir(lineas: string[]): string {
  return lineas.join('\n').trim();
}
