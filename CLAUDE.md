# CLAUDE.md

Lee siempre [docs/CONTEXTO.md](docs/CONTEXTO.md) antes de trabajar: contiene la idea, las decisiones, la arquitectura y el plan de hitos del proyecto.

## Reglas clave

- Idioma del proyecto: español (docs, nombres de dominio como `anclas`, `props`, `hijos`).
- Las anclas en el código se referencian por `data-uid` o selector CSS, **nunca** por número de línea.
- El JSON por página es la fuente de verdad de estructura y props; el `.md` es la vista editable. No editar los `.json` a mano.
- Ningún cambio de código se aplica sin mostrar antes un diff revisable.
- Trabajar hito a hito (§10 de CONTEXTO.md); no adelantar lógica de hitos posteriores.

## Stack

- Extensión: TypeScript, VS Code Extension API, Node 20+ (`extension/`).
- Ejemplo: React + Vite + Tailwind (`examples/web-demo/`).
