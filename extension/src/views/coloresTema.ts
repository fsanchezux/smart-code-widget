import * as vscode from 'vscode';

const COLORES_FIJOS: [string, string][] = [['white', '#ffffff'], ['black', '#000000'], ['transparent', 'transparent']];

// Nombres de color del tema (`--color-xxx` en los .css de src/), sin las variantes -oscuro.
// Se leen por ruta y no con findFiles, que respeta files.exclude y no vería el código oculto.
export class ColoresDelTema {
  private cache?: Promise<[string, string][]>;

  constructor(private readonly raiz: vscode.Uri) {}

  /** Pares [nombre, valor css]. */
  obtener(): Promise<[string, string][]> {
    this.cache ??= this.leer();
    return this.cache;
  }

  async nombres(): Promise<string[]> {
    return (await this.obtener()).map(([nombre]) => nombre);
  }

  /** Vuelve a leer los colores cuando se guarda un .css. */
  vigilar(): vscode.Disposable {
    return vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.uri.path.endsWith('.css')) this.cache = undefined;
    });
  }

  private async leer(): Promise<[string, string][]> {
    const encontrados = new Map<string, string>();
    const visitar = async (dir: vscode.Uri) => {
      let entradas: [string, vscode.FileType][] = [];
      try {
        entradas = await vscode.workspace.fs.readDirectory(dir);
      } catch {
        return;
      }
      for (const [nombre, tipo] of entradas) {
        const uri = vscode.Uri.joinPath(dir, nombre);
        if (tipo === vscode.FileType.Directory && nombre !== 'node_modules') await visitar(uri);
        else if (nombre.endsWith('.css')) {
          const css = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
          for (const [, color, valor] of css.matchAll(/--color-([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
            if (!color.endsWith('-oscuro')) encontrados.set(color, valor.trim());
          }
        }
      }
    };
    await visitar(vscode.Uri.joinPath(this.raiz, 'src'));
    return [...encontrados, ...COLORES_FIJOS];
  }
}
