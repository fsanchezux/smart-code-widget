# smart-code-widget

Lenguaje web **declarativo basado en documentos** que se sitúa entre el código (HTML/CSS/JS, frameworks) y los prompts libres de IA, distribuido como extensión de VS Code.

Describes tu web con documentos Markdown estructurados (una página = un documento, un componente = una sección). Al guardar, la extensión sincroniza **documento ⇄ JSON ⇄ código**:

- **Props tipadas** (`border-radius`, color, texto…) → edición determinista del código, sin IA.
- **Descripciones y cambios estructurales** → la IA recibe solo el diff y el código implicado.
- Siempre con diff revisable antes de aplicar, e historial paso a paso con deshacer.

## Estado

🚧 Hito 1 implementado: editar una prop tipada (`border-radius`, `color`, `texto`, `placeholder`) en `Home.md` y guardar propone el cambio de código con diff revisable. Ver el plan completo en [docs/CONTEXTO.md](docs/CONTEXTO.md).

## Arrancar

```bash
cd extension && npm install && npm test   # compila y valida Home.json contra el schema
cd examples/web-demo && npm install && npm run dev
```

Para probar la extensión: abrir el repo en VS Code y pulsar **F5** ("Ejecutar extensión"), luego `Smart Code Widget: Hola` en la paleta de comandos.

## Estructura

```
extension/          → extensión de VS Code (TypeScript)
examples/web-demo/  → web de ejemplo React + Vite + Tailwind con data-uid
docs/               → documentación del proyecto
```
