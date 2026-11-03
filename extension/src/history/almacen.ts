import * as vscode from 'vscode';
import { leerHistorial, type Paso, RUTA_HISTORIAL, serializarPaso, siguientePaso } from './historial';

// Lectura y escritura de .lenguaje/historial.jsonl en el proyecto (una línea por paso, solo se añade).
export class AlmacenHistorial {
  private readonly cambio = new vscode.EventEmitter<void>();
  readonly alCambiar = this.cambio.event;
  private readonly uri: vscode.Uri;

  constructor(raiz: vscode.Uri) {
    this.uri = vscode.Uri.joinPath(raiz, RUTA_HISTORIAL);
  }

  async leer(): Promise<Paso[]> {
    try {
      return leerHistorial(new TextDecoder().decode(await vscode.workspace.fs.readFile(this.uri)));
    } catch {
      return [];
    }
  }

  /** Añade un paso (el número se asigna aquí) y avisa a las vistas. */
  async agregar(paso: Omit<Paso, 'paso' | 'fecha'>): Promise<Paso> {
    const pasos = await this.leer();
    const completo: Paso = { paso: siguientePaso(pasos), fecha: new Date().toISOString(), ...paso };
    const previo = pasos.length ? new TextDecoder().decode(await vscode.workspace.fs.readFile(this.uri)) : '';
    await vscode.workspace.fs.writeFile(this.uri, new TextEncoder().encode(previo + serializarPaso(completo)));
    this.cambio.fire();
    return completo;
  }

  dispose(): void {
    this.cambio.dispose();
  }
}
