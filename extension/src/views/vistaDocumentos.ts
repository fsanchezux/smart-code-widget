import * as vscode from 'vscode';
import { type Exclusiones, mostrar, ocultar, patronesCodigo } from './patronesCodigo';

const CLAVE_VISIBLE = 'smartCodeWidget.codigoVisible';
const CLAVE_AÑADIDOS = 'smartCodeWidget.patronesAñadidos';

// Modo documento: el explorador solo enseña Stack.md, Configuracion.md y frontend/.
// El código se oculta con files.exclude y un botón en la cabecera del explorador lo alterna.
export function registrarVistaDocumentos(context: vscode.ExtensionContext, raiz: vscode.WorkspaceFolder): void {
  const destino = vscode.workspace.workspaceFile
    ? vscode.ConfigurationTarget.WorkspaceFolder
    : vscode.ConfigurationTarget.Workspace;
  const config = () => vscode.workspace.getConfiguration('files', raiz.uri);

  const leerExclusiones = (): Exclusiones => {
    const info = config().inspect<Exclusiones>('exclude');
    const valor = destino === vscode.ConfigurationTarget.WorkspaceFolder ? info?.workspaceFolderValue : info?.workspaceValue;
    return valor ?? {};
  };
  const escribirExclusiones = (exclusiones: Exclusiones) =>
    config().update('exclude', Object.keys(exclusiones).length ? exclusiones : undefined, destino);

  const fijarVisible = async (visible: boolean) => {
    await context.workspaceState.update(CLAVE_VISIBLE, visible);
    await vscode.commands.executeCommand('setContext', 'smartCodeWidget.codigoOculto', !visible);
  };

  const ocultarCodigo = async () => {
    const entradas = (await vscode.workspace.fs.readDirectory(raiz.uri)).map(([nombre]) => nombre);
    const { exclusiones, añadidos } = ocultar(leerExclusiones(), patronesCodigo(entradas));
    if (añadidos.length) {
      await escribirExclusiones(exclusiones);
      const previos = context.workspaceState.get<string[]>(CLAVE_AÑADIDOS, []);
      await context.workspaceState.update(CLAVE_AÑADIDOS, [...previos, ...añadidos]);
    }
    await fijarVisible(false);
  };

  const mostrarCodigo = async () => {
    const añadidos = context.workspaceState.get<string[]>(CLAVE_AÑADIDOS, []);
    if (añadidos.length) await escribirExclusiones(mostrar(leerExclusiones(), añadidos));
    await context.workspaceState.update(CLAVE_AÑADIDOS, []);
    await fijarVisible(true);
  };

  // Las operaciones leen y escriben settings: se encadenan para que no se pisen.
  let cola: Promise<void> = Promise.resolve();
  const enCola = (op: () => Promise<void>) => {
    cola = cola.then(op).catch((err) => {
      vscode.window.showErrorMessage(`Smart Code Widget: ${err instanceof Error ? err.message : err}`);
    });
    return cola;
  };

  // Ficheros nuevos en la raíz (dist/, .vscode/…) también se ocultan mientras el modo esté activo.
  const vigilante = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(raiz, '*'));
  vigilante.onDidCreate(() => {
    if (!context.workspaceState.get<boolean>(CLAVE_VISIBLE, false)) enCola(ocultarCodigo);
  });

  context.subscriptions.push(
    vigilante,
    vscode.commands.registerCommand('smartCodeWidget.mostrarCodigo', () => enCola(mostrarCodigo)),
    vscode.commands.registerCommand('smartCodeWidget.ocultarCodigo', () => enCola(ocultarCodigo)),
  );

  vscode.commands.executeCommand('setContext', 'smartCodeWidget.proyecto', true);
  // Al empezar, el código está oculto salvo que el usuario lo haya mostrado antes.
  enCola(context.workspaceState.get<boolean>(CLAVE_VISIBLE, false) ? () => fijarVisible(true) : ocultarCodigo);
}
