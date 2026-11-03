import * as vscode from 'vscode';
import { describir } from './diff/comparar';
import { ErrorDocumento } from './parser/markdown';
import { proponerCambios } from './propuesta';
import { Revision } from './views/revision';

const PAGINA = /^frontend\/paginas\/([^/]+)\.md$/;

// Al guardar un .md de frontend/paginas/: parsear, comparar con el JSON y proponer cambios de código.
export function registrarSincronizacion(
  context: vscode.ExtensionContext,
  raiz: vscode.WorkspaceFolder,
  salida: vscode.OutputChannel,
): void {
  const diagnosticos = vscode.languages.createDiagnosticCollection('smart-code-widget');
  const revision = new Revision(salida);
  revision.registrar(context);

  const leer = async (uri: vscode.Uri) => new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));

  const alGuardar = async (doc: vscode.TextDocument) => {
    const relativa = vscode.workspace.asRelativePath(doc.uri, false);
    const pagina = PAGINA.exec(relativa)?.[1];
    if (!pagina || vscode.workspace.getWorkspaceFolder(doc.uri)?.index !== raiz.index) return;

    diagnosticos.delete(doc.uri);
    const rutaJson = vscode.Uri.joinPath(raiz.uri, 'frontend/paginas', `${pagina}.json`);
    try {
      let json: unknown;
      try {
        json = JSON.parse(await leer(rutaJson));
      } catch (err) {
        throw new Error(err instanceof vscode.FileSystemError ? `no existe ${pagina}.json junto al .md` : `${pagina}.json no es JSON válido`);
      }

      const propuesta = await proponerCambios(json, doc.getText(), (ruta) => leer(vscode.Uri.joinPath(raiz.uri, ruta)));

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
      if (propuesta.aplicadas.length) await revision.mostrar(raiz.uri, rutaJson, propuesta);
    } catch (err) {
      if (err instanceof ErrorDocumento) {
        const rango = new vscode.Range(err.linea, 0, err.linea, Number.MAX_SAFE_INTEGER);
        diagnosticos.set(doc.uri, [new vscode.Diagnostic(rango, err.message, vscode.DiagnosticSeverity.Error)]);
      }
      vscode.window.showErrorMessage(`Smart Code Widget: ${(err as Error).message}`);
    }
  };

  context.subscriptions.push(diagnosticos, vscode.workspace.onDidSaveTextDocument(alGuardar));
}
