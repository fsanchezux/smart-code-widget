import * as vscode from 'vscode';
import type { AlmacenHistorial } from '../history/almacen';
import { componentesDe, type Paso } from '../history/historial';

// Historial como hilos de comentarios en el .md: uno en el título de la página (todos los pasos)
// y uno en cada componente (sus pasos y cómo quedaron sus props). Cada comentario tiene
// «Ver cambio» y «Volver a antes de este cambio».

const ID = 'smart-code-widget-historial';
const ESQUEMA = 'scw-historial';
const PAGINA = /frontend\/paginas\/([^/]+)\.md$/;

export class ComentarioPaso implements vscode.Comment {
  mode = vscode.CommentMode.Preview;
  contextValue = 'paso';
  author: vscode.CommentAuthorInformation;
  timestamp: Date;
  body: vscode.MarkdownString;

  constructor(readonly paso: Paso, componente?: string) {
    this.author = { name: `Paso ${paso.paso}${paso.via === 'ia' ? ' · IA' : paso.via === 'volver' ? ' · vuelta atrás' : ''}` };
    this.timestamp = new Date(paso.fecha);
    const cambios = componente ? paso.cambios.filter((c) => c.componente === componente) : paso.cambios;
    const lineas = componente
      ? cambios.map((c) => (c.descripcion ? '- descripción' : `- ${c.prop}: ${c.antes ?? '—'} → ${c.despues ?? '—'}`))
      : paso.resumen.map((r) => `- ${r}`);
    const props = componente ? paso.props[componente] : undefined;
    const quedan = props && Object.keys(props).length
      ? `\n\n*Props tras el cambio:* ${Object.entries(props).map(([k, v]) => `\`${k}: ${v}\``).join(' · ')}`
      : '';
    this.body = new vscode.MarkdownString(`${lineas.join('\n')}${quedan}`);
  }
}

export function registrarHistorialComentarios(
  context: vscode.ExtensionContext,
  historial: AlmacenHistorial,
  volver: (pagina: string, paso: number) => Promise<void>,
): void {
  const controlador = vscode.comments.createCommentController(ID, 'Historial de Smart Code Widget');
  const hilos = new Map<string, vscode.CommentThread[]>();
  const contenidos = new Map<string, string>();

  const pintar = async (doc: vscode.TextDocument) => {
    const pagina = PAGINA.exec(doc.uri.path)?.[1];
    if (!pagina || doc.uri.scheme !== 'file') return;
    const pasos = (await historial.leer()).filter((p) => p.pagina === pagina).sort((a, b) => b.paso - a.paso);
    for (const hilo of hilos.get(doc.uri.toString()) ?? []) hilo.dispose();

    const nuevos: vscode.CommentThread[] = [];
    const crear = (linea: number, etiqueta: string, comentarios: vscode.Comment[]) => {
      const hilo = controlador.createCommentThread(doc.uri, new vscode.Range(linea, 0, linea, 0), comentarios);
      hilo.label = etiqueta;
      hilo.canReply = false;
      hilo.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
      nuevos.push(hilo);
    };

    const lineas = doc.getText().split(/\r?\n/);
    for (const [i, linea] of lineas.entries()) {
      const titulo = /^#\s+(\S+)/.exec(linea);
      if (titulo && pasos.length) crear(i, `Historial de ${pagina} · ${pasos.length} cambio(s)`, pasos.map((p) => new ComentarioPaso(p)));
      const encabezado = /^#{2,6}\s+(\S+)/.exec(linea);
      if (!encabezado) continue;
      const nombre = encabezado[1];
      const suyos = pasos.filter((p) => componentesDe(p).includes(nombre));
      if (suyos.length) crear(i, `Historial de ${nombre} · ${suyos.length} cambio(s)`, suyos.map((p) => new ComentarioPaso(p, nombre)));
    }
    hilos.set(doc.uri.toString(), nuevos);
  };

  const pintarAbiertos = () => vscode.workspace.textDocuments.forEach((d) => void pintar(d));
  let espera: NodeJS.Timeout | undefined;
  const alEditar = (e: vscode.TextDocumentChangeEvent) => {
    if (!PAGINA.test(e.document.uri.path)) return;
    clearTimeout(espera);
    espera = setTimeout(() => void pintar(e.document), 600);
  };

  const verPaso = async (comentario: ComentarioPaso) => {
    const { paso } = comentario;
    for (const f of paso.ficheros) {
      const uri = (lado: string) => vscode.Uri.from({ scheme: ESQUEMA, path: `/${f.ruta}`, query: `${paso.paso}-${lado}` });
      contenidos.set(uri('antes').toString(), f.antes);
      contenidos.set(uri('despues').toString(), f.despues);
      await vscode.commands.executeCommand('vscode.diff', uri('antes'), uri('despues'), `Paso ${paso.paso}: ${f.ruta}`, { preview: false });
    }
  };

  context.subscriptions.push(
    controlador,
    vscode.workspace.registerTextDocumentContentProvider(ESQUEMA, { provideTextDocumentContent: (u) => contenidos.get(u.toString()) ?? '' }),
    historial.alCambiar(pintarAbiertos),
    vscode.workspace.onDidOpenTextDocument((d) => void pintar(d)),
    vscode.workspace.onDidChangeTextDocument(alEditar),
    vscode.commands.registerCommand('smartCodeWidget.verPaso', verPaso),
    vscode.commands.registerCommand('smartCodeWidget.volverAntesDePaso', (c: ComentarioPaso | string, paso?: number) =>
      typeof c === 'string' ? volver(c, paso!) : volver(c.paso.pagina, c.paso.paso)),
  );
  pintarAbiertos();
}
