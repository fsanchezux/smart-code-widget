# smart-code-widget

Lenguaje web **declarativo basado en documentos** que se sitúa entre el código (HTML/CSS/JS, frameworks) y los prompts libres de IA, distribuido como extensión de VS Code.

Describes tu web con documentos Markdown estructurados (una página = un documento, un componente = una sección). Al guardar, la extensión sincroniza **documento ⇄ JSON ⇄ código**:

- **Props tipadas** (`border-radius`, color, texto…) → edición determinista del código, sin IA.
- **Descripciones y cambios estructurales** → la IA recibe solo el diff y el código implicado.
- Siempre con diff revisable antes de aplicar, e historial paso a paso con deshacer.

## Estado

🚧 En fase inicial (Hito 0). Ver el plan completo en [docs/CONTEXTO.md](docs/CONTEXTO.md).

## Estructura

```
extension/          → extensión de VS Code (TypeScript)
examples/web-demo/  → web de ejemplo React + Vite + Tailwind con data-uid
docs/               → documentación del proyecto
```
