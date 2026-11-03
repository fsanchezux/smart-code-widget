import * as vscode from 'vscode';
import { describir } from '../diff/comparar';
import type { Propuesta } from '../propuesta';

const ESQUEMA_ORIGINAL = 'scw-original';
const ESQUEMA_PROPUESTA = 'scw-propuesta';

interface Pendiente {
  id: number;
  raiz: vscode.Uri;
  rutaJson: vscode.Uri;
  propuesta: Propuesta;
}

// Revisión de una propuesta: diff por fichero (actual ↔ propuesta) y Aceptar / Rechazar.
// Nada se escribe hasta que el usuario acepta.
export class Revision implements vscode.TextDocumentContentProvider {
  private contenidos = new Map<string, string>();
  private pendiente?: Pendiente;
  private siguienteId = 1;

  constructor(private readonly salida: vscode.OutputChannel) {}

  registrar(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(ESQUEMA_ORIGINAL, this),
      vscode.workspace.registerTextDocumentContentProvider(ESQUEMA_PROPUESTA, this),
      vscode.commands.registerCommand('smartCodeWidget.aceptarCambios', () => this.aceptar()),
      vscode.commands.registerCommand('smartCodeWidget.rechazarCambios', () => this.rechazar()),
    );
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contenidos.get(uri.toString()) ?? '';
  }

  async mostrar(raiz: vscode.Uri, rutaJson: vscode.Uri, propuesta: Propuesta): Promise<void> {
    await this.cerrar();
    const id = this.siguienteId++;
    this.pendiente = { id, raiz, rutaJson, propuesta };
    await vscode.commands.executeCommand('setContext', 'smartCodeWidget.propuestaPendiente', true);

    if (propuesta.ficheros.length === 0) {
      // Cambios de prop que no alteran el código (p. ej. 8px → 8): solo se actualiza el JSON.
      return this.aceptar();
    }

    for (const f of propuesta.ficheros) {
      const uri = (esquema: string) => vscode.Uri.from({ scheme: esquema, path: `/${f.ruta}`, query: `${id}` });
      this.contenidos.set(uri(ESQUEMA_ORIGINAL).toString(), f.original);
      this.contenidos.set(uri(ESQUEMA_PROPUESTA).toString(), f.propuesto);
      await vscode.commands.executeCommand(
        'vscode.diff', uri(ESQUEMA_ORIGINAL), uri(ESQUEMA_PROPUESTA), `${f.ruta}: actual ↔ propuesta`, { preview: false },
      );
    }

    const resumen = propuesta.aplicadas.map(describir).join(', ');
    const eleccion = await vscode.window.showInformationMessage(
      `Smart Code Widget: revisa el diff (${resumen}).`, 'Aceptar', 'Rechazar',
    );
    // Si mientras tanto se aceptó desde el botón del editor o llegó otra propuesta, no hacer nada.
    if (this.pendiente?.id !== id) return;
    if (eleccion === 'Aceptar') await this.aceptar();
    else if (eleccion === 'Rechazar') await this.rechazar();
  }

  private async aceptar(): Promise<void> {
    const pendiente = this.pendiente;
    if (!pendiente) return;
    const { raiz, rutaJson, propuesta } = pendiente;

    const edicion = new vscode.WorkspaceEdit();
    const documentos: vscode.TextDocument[] = [];
    for (const f of propuesta.ficheros) {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(raiz, f.ruta));
      if (doc.getText() !== f.original) {
        vscode.window.showErrorMessage(
          `Smart Code Widget: ${f.ruta} ha cambiado desde la propuesta. No se ha aplicado nada; guarda el .md de nuevo.`,
        );
        return this.cerrar();
      }
      edicion.replace(doc.uri, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), f.propuesto);
      documentos.push(doc);
    }
    if (!(await vscode.workspace.applyEdit(edicion))) {
      vscode.window.showErrorMessage('Smart Code Widget: no se pudieron aplicar los cambios.');
      return this.cerrar();
    }
    await Promise.all(documentos.map((d) => d.save()));
    await vscode.workspace.fs.writeFile(rutaJson, new TextEncoder().encode(JSON.stringify(propuesta.json, null, 2) + '\n'));

    for (const op of propuesta.aplicadas) this.salida.appendLine(`✔ ${describir(op)}`);
    vscode.window.showInformationMessage(
      `Smart Code Widget: ${propuesta.aplicadas.length} cambio(s) aplicados en ${propuesta.ficheros.length} fichero(s).`,
    );
    await this.cerrar();
  }

  private async rechazar(): Promise<void> {
    if (!this.pendiente) return;
    vscode.window.showInformationMessage(
      'Smart Code Widget: cambios descartados. El .md conserva tu edición; guárdalo de nuevo para volver a proponerlos.',
    );
    await this.cerrar();
  }

  private async cerrar(): Promise<void> {
    this.pendiente = undefined;
    this.contenidos.clear();
    await vscode.commands.executeCommand('setContext', 'smartCodeWidget.propuestaPendiente', false);
    const pestañas = vscode.window.tabGroups.all
      .flatMap((g) => g.tabs)
      .filter((t) => t.input instanceof vscode.TabInputTextDiff && t.input.modified.scheme === ESQUEMA_PROPUESTA);
    if (pestañas.length) await vscode.window.tabGroups.close(pestañas);
  }
}
