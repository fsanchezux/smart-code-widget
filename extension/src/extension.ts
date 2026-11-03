import * as vscode from 'vscode';
import { AlmacenHistorial } from './history/almacen';
import { volverAntesDe } from './history/volver';
import { registrarSincronizacion } from './sincronizacion';
import { registrarAsistenteProps } from './views/asistenteProps';
import { ColoresDelTema } from './views/coloresTema';
import { registrarHistorialComentarios } from './views/historialComentarios';
import { Revision } from './views/revision';
import { registrarVistaDocumentos } from './views/vistaDocumentos';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const salida = vscode.window.createOutputChannel('Smart Code Widget');
  salida.appendLine('Smart Code Widget activada.');

  context.subscriptions.push(
    salida,
    vscode.commands.registerCommand('smartCodeWidget.hola', () => {
      vscode.window.showInformationMessage('Hola desde Smart Code Widget 👋');
    }),
  );

  const raiz = await buscarRaizProyecto();
  if (raiz) {
    salida.appendLine(`Proyecto detectado: ${raiz.uri.fsPath}`);
    registrarVistaDocumentos(context, raiz);
    const colores = new ColoresDelTema(raiz.uri);
    const revision = new Revision(salida);
    revision.registrar(context);
    const historial = new AlmacenHistorial(raiz.uri);
    const volver = (pagina: string, paso: number) => volverAntesDe(raiz.uri, historial, revision, pagina, paso);
    context.subscriptions.push(colores.vigilar(), historial);
    registrarSincronizacion(context, raiz, salida, colores, revision, historial);
    registrarAsistenteProps(context, raiz, colores, historial);
    registrarHistorialComentarios(context, historial, volver);
  }
}

// Un proyecto del lenguaje es una carpeta del workspace con Stack.md en la raíz.
async function buscarRaizProyecto(): Promise<vscode.WorkspaceFolder | undefined> {
  for (const carpeta of vscode.workspace.workspaceFolders ?? []) {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(carpeta.uri, 'Stack.md'));
      return carpeta;
    } catch {
      // Sin Stack.md: no es un proyecto del lenguaje.
    }
  }
  return undefined;
}

export function deactivate(): void {}
