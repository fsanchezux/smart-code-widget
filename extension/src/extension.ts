import * as vscode from 'vscode';
import { registrarSincronizacion } from './sincronizacion';
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
    registrarSincronizacion(context, raiz, salida);
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
