import * as vscode from 'vscode';
import { ResolverPrompts } from './ai/resolverPrompts';
import { describir } from './diff/comparar';
import type { AlmacenHistorial } from './history/almacen';
import { type CambioPaso, propsDe } from './history/historial';
import { ErrorDocumento } from './parser/markdown';
import { type OperacionAplicable, proponerCambios } from './propuesta';
import type { ColoresDelTema } from './views/coloresTema';
import type { Revision } from './views/revision';

const PAGINA = /^frontend\/paginas\/([^/]+)\.md$/;

// Al guardar un .md de frontend/paginas/: parsear, comparar con el JSON y proponer cambios de código.
// Al aceptar, el paso queda en el historial con el contenido antes/después de código, JSON y .md.
export function registrarSincronizacion(
  context: vscode.ExtensionContext,
  raiz: vscode.WorkspaceFolder,
  salida: vscode.OutputChannel,
  colores: ColoresDelTema,
  revision: Revision,
  historial: AlmacenHistorial,
): void {
  const diagnosticos = vscode.languages.createDiagnosticCollection('smart-code-widget');
  const prompts = new ResolverPrompts(raiz, salida, colores);
  /** .md tal como estaba en el último punto sincronizado (se captura antes de guardar), para el historial. */
  const mdSincronizado = new Map<string, string>();

  const leer = async (uri: vscode.Uri) => new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  const paginaDe = (doc: vscode.TextDocument) => {
    if (vscode.workspace.getWorkspaceFolder(doc.uri)?.index !== raiz.index) return undefined;
    return PAGINA.exec(vscode.workspace.asRelativePath(doc.uri, false))?.[1];
  };

  const antesDeGuardar = (e: vscode.TextDocumentWillSaveEvent) => {
    const clave = e.document.uri.toString();
    if (!paginaDe(e.document) || mdSincronizado.has(clave)) return;
    e.waitUntil(leer(e.document.uri).then((texto) => void mdSincronizado.set(clave, texto), () => undefined));
  };

  const alGuardar = async (doc: vscode.TextDocument) => {
    const pagina = paginaDe(doc);
    if (!pagina) return;
    const relativa = vscode.workspace.asRelativePath(doc.uri, false);

    diagnosticos.delete(doc.uri);
    // Los prompts *…* se resuelven primero; al sustituirlos por props se vuelve a guardar y entonces se sincroniza.
    if (await prompts.alGuardar(doc, pagina)) return;

    const rutaJson = `frontend/paginas/${pagina}.json`;
    try {
      let textoJson = '';
      let json: unknown;
      try {
        textoJson = await leer(vscode.Uri.joinPath(raiz.uri, rutaJson));
        json = JSON.parse(textoJson);
      } catch (err) {
        throw new Error(err instanceof vscode.FileSystemError ? `no existe ${pagina}.json junto al .md` : `${pagina}.json no es JSON válido`);
      }

      const cambiosIA = prompts.tomarCambiosIA(doc.uri);
      const propuesta = await proponerCambios(json, doc.getText(), (ruta) => leer(vscode.Uri.joinPath(raiz.uri, ruta)), cambiosIA);

      salida.appendLine(`— ${relativa} guardado`);
      for (const op of propuesta.pendientes) salida.appendLine(`  pendiente: ${describir(op)}`);
      for (const { op, error } of propuesta.fallidas) salida.appendLine(`  ✖ ${describir(op)}: ${error}`);

      if (propuesta.fallidas.length) {
        const [{ op, error }] = propuesta.fallidas;
        vscode.window.showErrorMessage(`Smart Code Widget: no se pudo aplicar ${describir(op)}: ${error}`, 'Ver detalles')
          .then((v) => v && salida.show());
      }
      if (propuesta.pendientes.length) {
        vscode.window.showWarningMessage(
          `Smart Code Widget: ${propuesta.pendientes.length} cambio(s) aún no soportados quedan pendientes: ` +
            propuesta.pendientes.map(describir).join('; '),
        );
      }
      const sinCambios = !propuesta.aplicadas.length && !propuesta.pendientes.length && !propuesta.fallidas.length;
      if (sinCambios) mdSincronizado.delete(doc.uri.toString()); // el .md coincide con el JSON: nuevo punto de partida
      if (!propuesta.aplicadas.length) return;

      const fin = textoJson.includes('\r\n') ? '\r\n' : '\n';
      const jsonNuevo = JSON.stringify(propuesta.json, null, 2).replace(/\n/g, fin) + fin;
      const ficheros = [...propuesta.ficheros, { ruta: rutaJson, original: textoJson, propuesto: jsonNuevo, oculto: true }];
      const mdAntes = mdSincronizado.get(doc.uri.toString()) ?? doc.getText();

      await revision.mostrar(raiz.uri, {
        ficheros,
        resumen: propuesta.aplicadas.map(describir).join(', '),
        alAceptar: async () => {
          const componentes = [...new Set(propuesta.aplicadas.map(nombreDe).filter(Boolean))] as string[];
          await historial.agregar({
            pagina,
            via: cambiosIA.length ? 'ia' : 'determinista',
            resumen: propuesta.aplicadas.map(describir),
            cambios: propuesta.aplicadas.map(cambioDe),
            props: propsDe(propuesta.json, componentes),
            ficheros: [
              ...ficheros.map((f) => ({ ruta: f.ruta, antes: f.original, despues: f.propuesto })),
              { ruta: relativa, antes: mdAntes, despues: doc.getText() },
            ],
          });
          mdSincronizado.delete(doc.uri.toString());
        },
      });
    } catch (err) {
      if (err instanceof ErrorDocumento) {
        const rango = new vscode.Range(err.linea, 0, err.linea, Number.MAX_SAFE_INTEGER);
        diagnosticos.set(doc.uri, [new vscode.Diagnostic(rango, err.message, vscode.DiagnosticSeverity.Error)]);
      }
      vscode.window.showErrorMessage(`Smart Code Widget: ${(err as Error).message}`);
    }
  };

  context.subscriptions.push(
    diagnosticos,
    vscode.workspace.onWillSaveTextDocument(antesDeGuardar),
    vscode.workspace.onDidSaveTextDocument(alGuardar),
  );
}

const nombreDe = (op: OperacionAplicable) => op.componente?.split('/')[1];

function cambioDe(op: OperacionAplicable): CambioPaso {
  const componente = nombreDe(op) ?? '';
  if (op.tipo === 'prop') return { componente, prop: op.prop, antes: op.antes, despues: op.despues };
  if (op.tipo === 'prop-nueva') return { componente, prop: op.prop, despues: op.despues };
  return { componente, descripcion: true };
}
