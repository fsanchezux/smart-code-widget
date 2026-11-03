// Dónde está el cursor dentro del bloque ```yaml de un componente.
// Sin dependencias de vscode: lo usan el hover y el autocompletado, y se testea con node:test.

export interface ContextoYaml {
  /** Líneas de las vallas ``` de apertura y cierre. */
  inicio: number;
  fin: number;
  /** Línea `props:` del bloque, si existe. */
  lineaProps?: number;
  /** Última línea de la zona de props (igual a lineaProps si está vacía). */
  finProps?: number;
  /** Props ya escritas en el bloque. */
  presentes: string[];
  /** Sangría de las props existentes (2 espacios si no hay). */
  sangria: string;
}

// Nombre de prop, con modificadores opcionales (hover:background). El ":" del valor va seguido de espacio o fin de línea.
const NOMBRE_PROP = '(?:[a-z0-9]+:)*[a-z][a-z0-9-]*';
const LINEA_PROP = new RegExp(`^(\\s+)(${NOMBRE_PROP})\\s*:(\\s|$)`);

/** Bloque yaml que contiene la línea `n`, o undefined si no está dentro de uno. */
export function contextoYaml(lineas: string[], n: number): ContextoYaml | undefined {
  let apertura: number | undefined;
  let esYaml = false;
  for (let i = 0; i < lineas.length; i++) {
    const valla = /^```\s*(\S*)\s*$/.exec(lineas[i]);
    if (!valla) continue;
    if (apertura === undefined) {
      apertura = i;
      esYaml = valla[1] === 'yaml';
      continue;
    }
    if (valla[1] !== '') continue;
    if (esYaml && apertura < n && n < i) return analizar(lineas, apertura, i);
    if (i >= n) return undefined;
    apertura = undefined;
  }
  return undefined;
}

function analizar(lineas: string[], inicio: number, fin: number): ContextoYaml {
  const ctx: ContextoYaml = { inicio, fin, presentes: [], sangria: '  ' };
  for (let i = inicio + 1; i < fin; i++) {
    if (!/^props:\s*$/.test(lineas[i])) continue;
    ctx.lineaProps = ctx.finProps = i;
    let sangriaVista = false;
    for (let j = i + 1; j < fin && enZonaProps(lineas[j]); j++) {
      const prop = LINEA_PROP.exec(lineas[j]);
      if (prop) {
        ctx.presentes.push(prop[2]);
        if (!sangriaVista) ctx.sangria = prop[1];
        sangriaVista = true;
      }
      if (lineas[j].trim()) ctx.finProps = j;
    }
    break;
  }
  return ctx;
}

// Sangrada, vacía, o empezando por "/" (listar props) o "*" (prompt para la IA), aunque estén en la columna 0.
function enZonaProps(linea: string): boolean {
  return /^\s/.test(linea) || !linea.trim() || linea.startsWith('/') || linea.startsWith('*');
}

/** ¿La línea `n` pertenece a la zona de props de su bloque? */
export function enProps(ctx: ContextoYaml, lineas: string[], n: number): boolean {
  if (ctx.lineaProps === undefined || n <= ctx.lineaProps || n >= ctx.fin) return false;
  for (let i = ctx.lineaProps + 1; i <= n; i++) if (!enZonaProps(lineas[i])) return false;
  return true;
}

export type PosicionEnProps =
  | { tipo: 'barra'; columna: number; escrito: string }
  | { tipo: 'clave'; columna: number; escrito: string }
  | { tipo: 'valor'; prop: string; columna: number; escrito: string };

/** Qué se está escribiendo en una línea de props, mirando el texto hasta el cursor. `escrito` puede llevar modificadores (hover:). */
export function posicionEnProps(hastaCursor: string): PosicionEnProps | undefined {
  let m = /^(\s*)\/((?:[a-z0-9]+:)*[a-z0-9-]*)$/.exec(hastaCursor);
  if (m) return { tipo: 'barra', columna: m[1].length, escrito: m[2] };
  m = /^(\s+)((?:[a-z0-9]+:)*[a-z0-9-]*)$/.exec(hastaCursor);
  if (m) return { tipo: 'clave', columna: m[1].length, escrito: m[2] };
  m = new RegExp(`^(\\s+(${NOMBRE_PROP})\\s*:\\s+)(.*)$`).exec(hastaCursor);
  if (m) return { tipo: 'valor', prop: m[2], columna: m[1].length, escrito: m[3] };
  return undefined;
}
