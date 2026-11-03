import * as vscode from 'vscode';
import { PROPS_SOPORTADAS } from '../apply/props';
import { contextoYaml, enProps, posicionEnProps } from '../parser/contextoYaml';
import {
  admiteModificadores, CATALOGO, CATEGORIAS, type DefinicionProp, definicionDe, MODIFICADORES, resumenValores, TIPOS_COMPONENTE,
  valoresSugeridos,
} from '../schema/catalogo';
import type { AlmacenHistorial } from '../history/almacen';
import { valoresAnteriores } from '../history/historial';
import type { ColoresDelTema } from './coloresTema';

// Ayuda al escribir props en los .md de frontend/:
// - hover sobre `props:` → catálogo completo; cada prop es un enlace que la inserta.
// - hover sobre una prop → descripción y valores admitidos.
// - `/` en una línea de props (o Ctrl+Espacio) → lista de props y modificadores (hover:, md:…); tras `nombre: ` → sus valores.

const INSERTAR = 'smartCodeWidget.insertarProp';
const VOLVER = 'smartCodeWidget.volverAntesDePaso';
const AYUDA_MODIFICADOR: Record<string, string> = {
  hover: 'al pasar el ratón', focus: 'con el foco', active: 'al pulsar', disabled: 'deshabilitado',
  sm: 'desde 640px', md: 'desde 768px', lg: 'desde 1024px', xl: 'desde 1280px', '2xl': 'desde 1536px',
};

export function registrarAsistenteProps(
  context: vscode.ExtensionContext,
  raiz: vscode.WorkspaceFolder,
  colores: ColoresDelTema,
  historial: AlmacenHistorial,
): void {
  const selector: vscode.DocumentSelector = {
    language: 'markdown', scheme: 'file', pattern: new vscode.RelativePattern(raiz, 'frontend/**/*.md'),
  };
  const lineasDe = (doc: vscode.TextDocument) => doc.getText().split(/\r?\n/);

  const hover: vscode.HoverProvider = {
    async provideHover(doc, pos) {
      const lineas = lineasDe(doc);
      const ctx = contextoYaml(lineas, pos.line);
      if (!ctx) return;
      const rango = doc.getWordRangeAtPosition(pos, /(?:[a-z0-9]+:)*[a-z][a-z0-9-]*/);
      if (!rango) return;

      if (pos.line === ctx.lineaProps) return new vscode.Hover(hoverCatalogo(doc.uri, ctx.lineaProps, ctx.presentes), rango);
      if (enProps(ctx, lineas, pos.line)) {
        const prop = doc.getText(rango);
        const def = definicionDe(prop);
        if (def && rango.start.character === lineas[pos.line].search(/\S/)) {
          // Valores que ha tenido esta prop en este componente, con enlace para volver a cada uno.
          const pagina = /([^/]+)\.md$/.exec(doc.uri.path)?.[1] ?? '';
          let inicio = ctx.inicio;
          while (inicio > 0 && !/^#{2,6}\s/.test(lineas[inicio])) inicio--;
          const componente = /^#{2,6}\s+(\S+)/.exec(lineas[inicio])?.[1] ?? '';
          const anteriores = valoresAnteriores(await historial.leer(), pagina, componente, prop);
          return new vscode.Hover(hoverProp(def, prop, pagina, anteriores), rango);
        }
      }
    },
  };

  const completado: vscode.CompletionItemProvider = {
    async provideCompletionItems(doc, pos) {
      const lineas = lineasDe(doc);
      const ctx = contextoYaml(lineas, pos.line);
      if (!ctx) return;
      const hastaCursor = lineas[pos.line].slice(0, pos.character);

      const tipo = /^(tipo:\s*)(\S*)$/.exec(hastaCursor);
      if (tipo) {
        const rango = new vscode.Range(pos.line, tipo[1].length, pos.line, pos.character);
        return TIPOS_COMPONENTE.map((t) => Object.assign(new vscode.CompletionItem(t, vscode.CompletionItemKind.EnumMember), { range: rango }));
      }
      if (!enProps(ctx, lineas, pos.line)) return;

      const posicion = posicionEnProps(hastaCursor);
      if (!posicion) return;
      const rango = new vscode.Range(pos.line, posicion.columna, pos.line, pos.character);

      if (posicion.tipo === 'valor') {
        const def = definicionDe(posicion.prop);
        if (!def) return;
        if (def.valor.tipo === 'color') {
          return (await colores.obtener()).map(([nombre, hex], i) =>
            Object.assign(new vscode.CompletionItem(nombre, vscode.CompletionItemKind.Color), {
              range: rango, documentation: hex, sortText: String(i).padStart(3, '0'),
            }));
        }
        return valoresSugeridos(def, []).map((v, i) =>
          Object.assign(new vscode.CompletionItem(v, vscode.CompletionItemKind.Value), {
            range: rango, sortText: String(i).padStart(3, '0'),
          }));
      }

      // Lista de props. Con "/" la barra se sustituye; en la columna 0 se añade la sangría.
      // Tras un modificador (hover:) solo se ofrecen las props de estilo, con el modificador delante.
      const sangria = posicion.columna === 0 ? ctx.sangria : '';
      const barra = posicion.tipo === 'barra' ? '/' : '';
      const variante = posicion.escrito.slice(0, posicion.escrito.lastIndexOf(':') + 1);
      const props = CATALOGO
        .filter((d) => (!variante || admiteModificadores(d.nombre)) && !ctx.presentes.includes(variante + d.nombre))
        .map((def, i) => {
          const nombre = variante + def.nombre;
          const item = new vscode.CompletionItem({ label: nombre, description: def.categoria }, vscode.CompletionItemKind.Property);
          item.range = rango;
          item.insertText = `${sangria}${nombre}: `;
          item.filterText = barra + nombre;
          item.sortText = String(i).padStart(3, '0');
          item.detail = resumenValores(def);
          item.documentation = new vscode.MarkdownString(`${def.descripcion}\n\n${estado(def)}`);
          item.command = { command: 'editor.action.triggerSuggest', title: 'Valores' };
          return item;
        });
      const modificadores = MODIFICADORES.map((m, i) => {
        const nombre = `${variante}${m}:`;
        const item = new vscode.CompletionItem({ label: nombre, description: 'modificador' }, vscode.CompletionItemKind.Keyword);
        item.range = rango;
        item.insertText = sangria + nombre;
        item.filterText = barra + nombre;
        item.sortText = `z${String(i).padStart(3, '0')}`;
        item.detail = `Aplica la prop que sigue solo ${AYUDA_MODIFICADOR[m]}`;
        item.command = { command: 'editor.action.triggerSuggest', title: 'Props' };
        return item;
      });
      return [...props, ...modificadores];
    },
  };

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, hover),
    vscode.languages.registerCompletionItemProvider(selector, completado, '/', ':', ' '),
    vscode.commands.registerCommand(INSERTAR, insertarProp),
  );
}

function hoverCatalogo(uri: vscode.Uri, lineaProps: number, presentes: string[]): vscode.MarkdownString {
  const md = new vscode.MarkdownString('**Props disponibles** — pulsa una para añadirla\n\n');
  md.isTrusted = { enabledCommands: [INSERTAR] };
  for (const categoria of CATEGORIAS) {
    const enlaces = CATALOGO.filter((d) => d.categoria === categoria).map((d) => {
      const nombre = `${d.nombre}${PROPS_SOPORTADAS.has(d.nombre) ? ' ✓' : ''}${admiteModificadores(d.nombre) ? ' ◇' : ''}`;
      if (presentes.includes(d.nombre)) return `~~${nombre}~~`;
      const args = encodeURIComponent(JSON.stringify([uri.toString(), lineaProps, d.nombre]));
      return `[${nombre}](command:${INSERTAR}?${args} "${d.descripcion} — ${resumenValores(d)}")`;
    });
    md.appendMarkdown(`**${categoria}:** ${enlaces.join(' · ')}\n\n`);
  }
  const modificadores = MODIFICADORES.map((m) => `\`${m}:\``).join(' ');
  md.appendMarkdown(`**Modificadores** (props ◇): ${modificadores} — p. ej. \`hover:background: green-500\`\n\n`);
  md.appendMarkdown('---\n✓ se aplica al código al guardar · ◇ admite modificadores · el resto queda pendiente · tachadas: ya están en el bloque\n\n');
  md.appendMarkdown('También: escribe `/` en una línea bajo `props:`, o `*tu petición*` para que la IA elija las props.');
  return md;
}

function hoverProp(
  def: DefinicionProp, prop: string, pagina: string, anteriores: ReturnType<typeof valoresAnteriores>,
): vscode.MarkdownString {
  const md = new vscode.MarkdownString(
    `**${prop}** · ${def.categoria}\n\n${def.descripcion}\n\nValores: \`${resumenValores(def)}\`\n\n${estado(def)}`,
  );
  if (anteriores.length) {
    md.isTrusted = { enabledCommands: [VOLVER] };
    md.appendMarkdown('\n\n---\n**Historial**\n');
    for (const a of anteriores.slice(0, 8)) {
      const args = encodeURIComponent(JSON.stringify([pagina, a.paso]));
      const volver = a.antes === undefined ? 'quitarla' : `volver a ${a.antes}`;
      md.appendMarkdown(`\n- paso ${a.paso}: \`${a.antes ?? '—'}\` → \`${a.despues ?? '—'}\` · [${volver}](command:${VOLVER}?${args} "Deshace el paso ${a.paso} y los posteriores, con diff")`);
    }
  }
  return md;
}

function estado(def: DefinicionProp): string {
  return PROPS_SOPORTADAS.has(def.nombre)
    ? '✓ Al cambiar su valor y guardar, se propone el cambio en el código.'
    : '⏳ Aún sin aplicador: al guardar queda como cambio pendiente.';
}

async function insertarProp(uri: string, lineaProps: number, nombre: string): Promise<void> {
  const editor = await vscode.window.showTextDocument(vscode.Uri.parse(uri));
  const lineas = editor.document.getText().split(/\r?\n/);
  const ctx = contextoYaml(lineas, lineaProps + 1);
  if (ctx?.lineaProps !== lineaProps || ctx.finProps === undefined) return;
  if (ctx.presentes.includes(nombre)) return;

  const linea = ctx.finProps + 1;
  const texto = `${ctx.sangria}${nombre}: `;
  await editor.edit((e) => e.insert(new vscode.Position(linea, 0), `${texto}\n`));
  const fin = new vscode.Position(linea, texto.length);
  editor.selection = new vscode.Selection(fin, fin);
  await vscode.commands.executeCommand('editor.action.triggerSuggest');
}
