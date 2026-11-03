import * as vscode from 'vscode';
import type { Pagina } from '../modelo';
import type { CambioIA } from '../propuesta';
import { aperturaPorUid } from '../resolver/jsx';
import type { ColoresDelTema } from '../views/coloresTema';
import { preguntarClaude } from './claude';
import {
  type AnclaParaIA, buscarPrompts, editarConRespuesta, leerRespuesta, type PromptEnDoc, promptAutomatico, promptChat,
  type RespuestaIA,
} from './prompts';
import { ficherosSkill } from './skill';

type Modo = 'automatico' | 'chat';

// Prompts *…* en los .md: se resuelven antes de sincronizar.
// - chat: se envía al chat de agentes un prompt mínimo que apunta al skill del proyecto; el agente edita y el usuario guarda.
// - automático: `claude -p` devuelve props y, para lo que no cabe en props, clases por uid; las props van al .md y las
//   clases esperan al siguiente guardado para entrar en la misma propuesta (diff revisable) que el resto.
export class ResolverPrompts {
  /** Prompts ya enviados al chat (uri#texto), para no reenviarlos en cada guardado. */
  private enviadosAlChat = new Set<string>();
  /** Cambios de código de la IA pendientes de proponer, por documento. */
  private cambiosIA = new Map<string, CambioIA[]>();

  constructor(
    private readonly raiz: vscode.WorkspaceFolder,
    private readonly salida: vscode.OutputChannel,
    private readonly colores: ColoresDelTema,
  ) {
    void this.asegurarSkill();
  }

  /** true si el .md tiene prompts: entonces todavía no se sincroniza. */
  async alGuardar(doc: vscode.TextDocument, pagina: string): Promise<boolean> {
    const prompts = buscarPrompts(doc.getText().split(/\r?\n/));
    const clave = (p: PromptEnDoc) => `${doc.uri}#${p.peticion}`;
    const vigentes = new Set(prompts.map(clave));
    for (const k of this.enviadosAlChat) if (k.startsWith(`${doc.uri}#`) && !vigentes.has(k)) this.enviadosAlChat.delete(k);
    if (!prompts.length) return false;

    const nuevos = prompts.filter((p) => !this.enviadosAlChat.has(clave(p)));
    if (!nuevos.length) {
      vscode.window.setStatusBarMessage('Smart Code Widget: prompt pendiente en el chat; guarda cuando el agente lo resuelva', 5000);
      return true;
    }

    let modo = await this.elegirModo(nuevos.length, pagina);
    if (!modo) return true;
    if (modo === 'chat' && !(await chatDisponible())) {
      vscode.window.showInformationMessage('Smart Code Widget: no hay un chat de agentes disponible; se lanza Claude directamente.');
      modo = 'automatico';
    }
    if (modo === 'chat') {
      await this.enviarAlChat(doc, nuevos);
      for (const p of nuevos) this.enviadosAlChat.add(clave(p));
    } else {
      await this.resolverAutomatico(doc, pagina, nuevos);
    }
    return true;
  }

  /** Cambios de código de la IA para incluir en la próxima propuesta de este documento (se consumen). */
  tomarCambiosIA(uri: vscode.Uri): CambioIA[] {
    const cambios = this.cambiosIA.get(uri.toString()) ?? [];
    this.cambiosIA.delete(uri.toString());
    return cambios;
  }

  private async elegirModo(cuantos: number, pagina: string): Promise<Modo | undefined> {
    const modo = vscode.workspace.getConfiguration('smartCodeWidget.ia').get<string>('modo', 'preguntar');
    if (modo === 'automatico' || modo === 'chat') return modo;
    const eleccion = await vscode.window.showInformationMessage(
      `Smart Code Widget: ${cuantos} prompt(s) para la IA en ${pagina}.md. ¿Cómo lo resuelvo?`, 'Automático', 'En el chat',
    );
    return eleccion === 'Automático' ? 'automatico' : eleccion === 'En el chat' ? 'chat' : undefined;
  }

  /** Instala o actualiza el skill del widget en el proyecto (.claude/skills/ y .agents/skills/). */
  private async asegurarSkill(): Promise<void> {
    for (const [ruta, contenido] of Object.entries(ficherosSkill())) {
      const uri = vscode.Uri.joinPath(this.raiz.uri, ruta);
      const actual = await this.leer(uri).catch(() => undefined);
      if (actual?.replace(/\r\n/g, '\n') !== contenido) await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(contenido));
    }
  }

  private async enviarAlChat(doc: vscode.TextDocument, prompts: PromptEnDoc[]): Promise<void> {
    await this.asegurarSkill();
    const query = promptChat(vscode.workspace.asRelativePath(doc.uri, false), prompts);
    try {
      await vscode.commands.executeCommand('workbench.action.chat.open', { query, mode: 'agent' });
    } catch {
      await vscode.commands.executeCommand('workbench.action.chat.open', query);
    }
    this.salida.appendLine(`— enviado al chat de agentes:\n${query}`);
  }

  private async resolverAutomatico(doc: vscode.TextDocument, pagina: string, prompts: PromptEnDoc[]): Promise<void> {
    const config = vscode.workspace.getConfiguration('smartCodeWidget.ia');
    const version = doc.version;
    const lineas = doc.getText().split(/\r?\n/);
    const colores = await this.colores.nombres();
    const json = await this.leerJson(pagina);

    const resultado = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Smart Code Widget: resolviendo con Claude…', cancellable: true },
      async (progreso, cancelar) => {
        const lineasNuevas = new Map<number, string[]>();
        const cambiosIA: CambioIA[] = [];
        for (const [i, prompt] of prompts.entries()) {
          progreso.report({ message: `${prompt.componente} (${i + 1}/${prompts.length})` });
          try {
            const id = `${pagina}/${prompt.componente}`;
            const anclas = await this.anclasVisuales(json, id);
            const texto = await preguntarClaude(promptAutomatico({ prompt, colores, anclas }), {
              comando: config.get('comando', 'claude'),
              modelo: config.get<string>('modelo') || undefined,
              cwd: this.raiz.uri.fsPath,
              cancelar,
            });
            const { respuesta, descartadas } = leerRespuesta(texto, anclas.map((a) => a.uid));
            this.informar(prompt, respuesta, descartadas);
            for (const [linea, nuevas] of editarConRespuesta(lineas, prompt, respuesta.props, respuesta.descripcion)) {
              lineasNuevas.set(linea, nuevas);
            }
            if (respuesta.descripcion) cambiosIA.push({ componente: id, clases: respuesta.clases });
          } catch (err) {
            if (cancelar.isCancellationRequested) return undefined;
            vscode.window.showErrorMessage(`Smart Code Widget: «${prompt.peticion}»: ${(err as Error).message}`);
          }
        }
        return { lineasNuevas, cambiosIA };
      },
    );
    if (!resultado?.lineasNuevas.size) return;
    if (doc.version !== version) {
      vscode.window.showWarningMessage('Smart Code Widget: el .md cambió mientras la IA respondía; no se ha tocado. Guarda de nuevo.');
      return;
    }

    const fin = doc.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    const edicion = new vscode.WorkspaceEdit();
    for (const [linea, nuevas] of resultado.lineasNuevas) {
      edicion.replace(doc.uri, new vscode.Range(linea, 0, linea + 1, 0), nuevas.map((l) => l + fin).join(''));
    }
    this.cambiosIA.set(doc.uri.toString(), resultado.cambiosIA);
    await vscode.workspace.applyEdit(edicion);
    // Al guardar sin prompts se dispara la sincronización normal: diff de código (props + clases de la IA) → aceptar.
    await doc.save();
  }

  /** Anclas visuales del componente con su etiqueta de apertura (lo mínimo para que la IA proponga clases). */
  private async anclasVisuales(json: Pagina | undefined, id: string): Promise<AnclaParaIA[]> {
    const anclas: AnclaParaIA[] = [];
    for (const ancla of Object.values(json?.componentes[id]?.anclas ?? {})) {
      if (ancla.rol !== 'visual' || !ancla.uid) continue;
      try {
        const codigo = await this.leer(vscode.Uri.joinPath(this.raiz.uri, ancla.fichero));
        anclas.push({ uid: ancla.uid, fichero: ancla.fichero, apertura: aperturaPorUid(codigo, ancla.fichero, ancla.uid) });
      } catch {
        // Ancla no localizable: la IA solo podrá usar props.
      }
    }
    return anclas;
  }

  private async leerJson(pagina: string): Promise<Pagina | undefined> {
    try {
      return JSON.parse(await this.leer(vscode.Uri.joinPath(this.raiz.uri, 'frontend/paginas', `${pagina}.json`)));
    } catch {
      return undefined;
    }
  }

  private async leer(uri: vscode.Uri): Promise<string> {
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  }

  private informar(prompt: PromptEnDoc, respuesta: RespuestaIA, descartadas: string[]) {
    const props = Object.entries(respuesta.props).map(([k, v]) => `${k}: ${v}`).join(', ') || 'ninguna';
    const clases = Object.entries(respuesta.clases).map(([uid, c]) => `${uid} → "${c}"`).join(', ');
    this.salida.appendLine(`— IA «${prompt.peticion}» (${prompt.componente}) → props: ${props}${clases ? `; clases: ${clases}` : ''}`);
    if (respuesta.explicacion) this.salida.appendLine(`  ${respuesta.explicacion}`);
    if (descartadas.length) this.salida.appendLine(`  descartado: ${descartadas.join(', ')}`);
    vscode.window.showInformationMessage(`Smart Code Widget · ${prompt.componente}: ${respuesta.explicacion || props}`);
  }
}

async function chatDisponible(): Promise<boolean> {
  try {
    return (await vscode.lm.selectChatModels()).length > 0;
  } catch {
    return false;
  }
}
