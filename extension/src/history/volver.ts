import * as vscode from 'vscode';
import type { Pagina } from '../modelo';
import type { Revision } from '../views/revision';
import type { AlmacenHistorial } from './almacen';
import { componentesDe, planVolver, propsDe } from './historial';

/**
 * Deja la página como estaba antes del paso `desde` (deshace ese paso y los posteriores),
 * mostrando antes el diff para aceptar. La vuelta atrás queda registrada como un paso más.
 */
export async function volverAntesDe(
  raiz: vscode.Uri, historial: AlmacenHistorial, revision: Revision, pagina: string, desde: number,
): Promise<void> {
  const pasos = await historial.leer();
  const deshechos = pasos.filter((p) => p.pagina === pagina && p.paso >= desde);
  const rutas = [...new Set(deshechos.flatMap((p) => p.ficheros.map((f) => f.ruta)))];

  const actuales = new Map<string, string>();
  for (const ruta of rutas) {
    const uri = vscode.Uri.joinPath(raiz, ruta);
    const abierto = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
    if (abierto?.isDirty) {
      vscode.window.showWarningMessage(`Smart Code Widget: ${ruta} tiene cambios sin guardar; guárdalos o descártalos antes de volver atrás.`);
      return;
    }
    try {
      actuales.set(ruta, abierto?.getText() ?? new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)));
    } catch {
      // Fichero borrado: planVolver avisará.
    }
  }

  let plan;
  try {
    plan = planVolver(pasos, pagina, desde, actuales);
  } catch (err) {
    vscode.window.showErrorMessage(`Smart Code Widget: no se puede volver atrás: ${(err as Error).message}`);
    return;
  }
  if (!plan.length) {
    vscode.window.showInformationMessage('Smart Code Widget: la página ya está como antes de ese paso.');
    return;
  }

  const resumen = `volver a antes del paso ${desde}`;
  const rutaJson = `frontend/paginas/${pagina}.json`;
  await revision.mostrar(raiz, {
    ficheros: plan.map((c) => ({ ...c, oculto: c.ruta === rutaJson })),
    resumen,
    alAceptar: async () => {
      const textoJson = plan.find((c) => c.ruta === rutaJson)?.propuesto ?? actuales.get(rutaJson);
      const json: Pagina | undefined = textoJson ? JSON.parse(textoJson) : undefined;
      // Los cambios deshechos, invertidos: así el historial de cada prop refleja también la vuelta atrás.
      const cambios = deshechos
        .sort((a, b) => b.paso - a.paso)
        .flatMap((p) => p.cambios.map((c) => ({ ...c, antes: c.despues, despues: c.antes })));
      const componentes = [...new Set(deshechos.flatMap(componentesDe))];
      await historial.agregar({
        pagina,
        via: 'volver',
        resumen: [resumen],
        cambios,
        props: json ? propsDe(json, componentes) : {},
        ficheros: plan.map((c) => ({ ruta: c.ruta, antes: c.original, despues: c.propuesto })),
      });
    },
  });
}
