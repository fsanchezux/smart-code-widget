import * as vscode from 'vscode';

const ESQUEMA_ORIGINAL = 'scw-original';
const ESQUEMA_PROPUESTA = 'scw-propuesta';

export interface FicheroRevisable {
  ruta: string;
  original: string;
  propuesto: string;
  /** Se aplica pero no se abre su diff (p. ej. el JSON, que no se edita a mano). */
  oculto?: boolean;
}

export interface CambioRevisable {
  ficheros: FicheroRevisable[];
  /** Qué se propone, en una línea. */
  resumen: string;
  /** Se ejecuta tras escribir y guardar todo (p. ej. registrar el paso en el historial). */
  alAceptar?: () => Promise<void>;
}

interface Pendiente {
  id: number;
  raiz: vscode.Uri;
  cambio: CambioRevisable;
}

// Revisión de un cambio: diff por fichero (actual ↔ propuesta) y Aceptar / Rechazar.
// Nada se escribe hasta que el usuario acepta. Sirve para las propuestas de código y para volver atrás en el historial.
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

  async mostrar(raiz: vscode.Uri, cambio: CambioRevisable): Promise<void> {
    await this.cerrar();
    const id = this.siguienteId++;
    this.pendiente = { id, raiz, cambio };
    await vscode.commands.executeCommand('setContext', 'smartCodeWidget.propuestaPendiente', true);

    const visibles = cambio.ficheros.filter((f) => !f.oculto);
    // Sin nada que revisar (p. ej. solo cambia el JSON): se aplica directamente.
    if (!visibles.length) return this.aceptar();

    for (const f of visibles) {
      const uri = (esquema: string) => vscode.Uri.from({ scheme: esquema, path: `/${f.ruta}`, query: `${id}` });
      this.contenidos.set(uri(ESQUEMA_ORIGINAL).toString(), f.original);
      this.contenidos.set(uri(ESQUEMA_PROPUESTA).toString(), f.propuesto);
      await vscode.commands.executeCommand(
        'vscode.diff', uri(ESQUEMA_ORIGINAL), uri(ESQUEMA_PROPUESTA), `${f.ruta}: actual ↔ propuesta`, { preview: false },
      );
    }

    const eleccion = await vscode.window.showInformationMessage(
      `Smart Code Widget: revisa el diff (${cambio.resumen}).`, 'Aceptar', 'Rechazar',
    );
    // Si mientras tanto se aceptó desde el botón del editor o llegó otra propuesta, no hacer nada.
    if (this.pendiente?.id !== id) return;
    if (eleccion === 'Aceptar') await this.aceptar();
    else if (eleccion === 'Rechazar') await this.rechazar();
  }

  private async aceptar(): Promise<void> {
    const pendiente = this.pendiente;
    if (!pendiente) return;
    const { raiz, cambio } = pendiente;

    const edicion = new vscode.WorkspaceEdit();
    const documentos: vscode.TextDocument[] = [];
    for (const f of cambio.ficheros) {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(raiz, f.ruta));
      if (doc.getText() !== f.original) {
        vscode.window.showErrorMessage(
          `Smart Code Widget: ${f.ruta} ha cambiado desde la propuesta. No se ha aplicado nada; vuelve a intentarlo.`,
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
    // Los .md al final: al guardarlos se sincronizan y deben encontrar ya el JSON y el código nuevos.
    documentos.sort((a, b) => Number(a.uri.path.endsWith('.md')) - Number(b.uri.path.endsWith('.md')));
    for (const doc of documentos) await doc.save();

    await this.cerrar();
    await cambio.alAceptar?.();
    this.salida.appendLine(`✔ ${cambio.resumen}`);
    vscode.window.showInformationMessage(`Smart Code Widget: aplicado (${cambio.resumen}).`);
  }

  private async rechazar(): Promise<void> {
    if (!this.pendiente) return;
    vscode.window.showInformationMessage('Smart Code Widget: cambios descartados.');
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
