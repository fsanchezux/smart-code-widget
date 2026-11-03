import { spawn } from 'node:child_process';

// Lanza el agente directamente: `claude -p` (Claude Code en modo no interactivo), sin herramientas ni sesión guardada.
// El prompt va por stdin para no depender del escapado de argumentos de cmd.exe (en Windows `claude` es un .cmd).

export interface OpcionesClaude {
  comando: string;
  modelo?: string;
  cwd: string;
  timeoutMs?: number;
  cancelar?: { onCancellationRequested(cb: () => void): unknown };
}

export function preguntarClaude(prompt: string, opciones: OpcionesClaude): Promise<string> {
  const conShell = process.platform === 'win32';
  // Sin herramientas: con shell (cmd.exe) el argumento vacío hay que escribirlo como "".
  const args = ['-p', '--output-format', 'json', '--tools', conShell ? '""' : '', '--no-session-persistence', '--strict-mcp-config'];
  if (opciones.modelo) args.push('--model', opciones.modelo);

  return new Promise((resolver, rechazar) => {
    const proceso = spawn(opciones.comando, args, { cwd: opciones.cwd, shell: conShell, windowsHide: true });
    let salida = '';
    let errores = '';
    const temporizador = setTimeout(() => {
      proceso.kill();
      rechazar(new Error('claude no respondió a tiempo'));
    }, opciones.timeoutMs ?? 120_000);
    opciones.cancelar?.onCancellationRequested(() => {
      proceso.kill();
      rechazar(new Error('cancelado'));
    });

    proceso.stdout.on('data', (d) => (salida += d));
    proceso.stderr.on('data', (d) => (errores += d));
    proceso.on('error', (err) => {
      clearTimeout(temporizador);
      rechazar(new Error(`no se pudo ejecutar «${opciones.comando}»: ${err.message}`));
    });
    proceso.on('close', (codigo) => {
      clearTimeout(temporizador);
      try {
        resolver(leerSalida(salida));
      } catch (err) {
        const detalle = errores.trim() || (err as Error).message;
        rechazar(new Error(codigo === 0 ? detalle : `claude terminó con código ${codigo}: ${detalle}`));
      }
    });
    proceso.stdin.end(prompt);
  });
}

/** Texto de la respuesta a partir de la salida `--output-format json`. */
export function leerSalida(salida: string): string {
  const datos = JSON.parse(salida);
  if (datos.is_error) throw new Error(String(datos.result ?? 'error desconocido'));
  return String(datos.result ?? '');
}
