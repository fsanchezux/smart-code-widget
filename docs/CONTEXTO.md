# Proyecto: Capa de lenguaje entre código y prompts de IA (extensión VS Code)

> Brief para arrancar el proyecto en Claude Code. Contiene la idea, las decisiones tomadas, la arquitectura propuesta y el plan de hitos. Guárdalo en el repo como `docs/CONTEXTO.md` y referéncialo desde `CLAUDE.md`.

---

## 1. Qué es

Un lenguaje de programación web **declarativo, basado en documentos**, que se sitúa:

- **por encima** del código actual (HTML/CSS/JS, frameworks, backend…)
- **por debajo** de los prompts libres de IA

El proyecto web se describe con documentos estructurados. Una extensión de VS Code (con ayuda de IA cuando haga falta) mantiene sincronizados **documentos ⇄ código**.

**Formato inicial:** extensión / widget de VS Code.

**Caso de uso principal:** cambios pequeños y precisos. Ej.: cambiar el `border-radius` de un componente de una página → abres el documento de esa página, editas la propiedad y guardas. **No escribes un prompt.**

---

## 2. Estructura de un proyecto que usa el lenguaje

```
/mi-web
├── Stack.md            → stack elegido (framework, lenguaje, BD, hosting…)
├── Configuracion.md    → API keys, contraseñas, todo lo configurable del backend (genera .env, nunca a git)
├── Backend.md          → descripción del backend (endpoints, modelos, lógica)
└── frontend/
    ├── Componentes.md  → componentes generales/compartidos
    ├── Componentes.json
    └── paginas/
        ├── Home.md     → un documento por página
        ├── Home.json   → representación intermedia (ver §4)
        └── …
```

---

## 3. Modelo de componente

- Cada componente tiene un **id lógico** (`Home/TarjetaProducto`).
- Un componente es una **agrupación de anclas**: varios elementos del código, posiblemente en varios ficheros (JSX, CSS, hooks/JS).
- Un componente puede agrupar **anclas y otros componentes** (composición).
  - Ej.: `BuscadorResultados` = `InputBuscador` + `ListaResultados` + `Acciones` (botones extra).
- Las anclas pueden ser **visuales** (elementos, clases CSS) o **de lógica** (estado, fetch, handlers, imports). Las de lógica son necesarias para poder mover un componente sin romperlo.
- Cada **propiedad** declara a qué ancla(s) del grupo afecta.
- En el código, las anclas se marcan con `data-uid="..."` (o selector CSS para estilos). **Nunca** se referencian por número de línea.

### Operaciones

| Tipo | Operación | ¿IA? |
|---|---|---|
| Propiedad | Cambiar valor de una prop tipada (`border-radius`, color, texto…) | **No** (camino rápido determinista) |
| Descripción | Cambiar texto libre de la descripción | Sí |
| Estructural | Agrupar, desagrupar, mover en la página, anidar en otro componente, mover a otra página | Normalmente sí |

**La estructura del documento refleja el árbol de la página:** mover un bloque en el `.md` = moverlo en la web.

---

## 4. Capa JSON (representación intermedia)

```
Home.md (humano)  ⇄  Home.json (estructura)  ⇄  código (implementación)
```

El JSON es como el AST de un compilador. Ejemplo:

```json
{
  "id": "Home/BuscadorResultados",
  "tipo": "grupo",
  "anclas": {
    "contenedor": { "uid": "a1", "fichero": "src/pages/Home.tsx", "rol": "visual" },
    "estado":     { "uid": "a7", "fichero": "src/hooks/useSearch.ts", "rol": "logica" }
  },
  "props": {
    "border-radius": { "valor": "12px", "aplica": ["contenedor"] }
  },
  "hijos": ["Home/InputBuscador", "Home/ListaResultados", "Home/Acciones"],
  "descripcion": "Busca productos mientras escribes y muestra los resultados."
}
```

**Decisiones propuestas (a validar):**
- El **JSON es la fuente de verdad** de estructura y props. El `.md` es una vista editable que se parsea a JSON al guardar.
- **Un JSON por página** (`Home.json`) + `Componentes.json` para los generales.
- El JSON va a git, es legible, pero no se edita a mano (como `package-lock.json`).
- Validación con **JSON Schema** antes de tocar el código.

### Formato del componente en el `.md`

````markdown
## BotonContacto
```yaml
tipo: button
props:
  texto: "Contáctanos"
  border-radius: 8px
  color: primario
```
Botón que abre el formulario de contacto. Al pasar el ratón se oscurece.
````

(El id y las anclas NO se muestran en el `.md`; viven en el JSON.)

---

## 5. Workflow

1. El usuario edita props / descripción / estructura en el `.md` y guarda.
2. La extensión parsea el `.md` → JSON nuevo.
3. Calcula el diff JSON antiguo vs nuevo (JSON Patch, RFC 6902).
4. Por cada cambio:
   - **Prop tipada** → resuelve anclas por `data-uid` y edita el código directamente.
   - **Descripción / estructural** → envía a la IA solo el diff + el código de las anclas implicadas.
5. Muestra **diff del código** para aceptar/rechazar (nunca aplicar sin revisión).
6. Actualiza el JSON y reescribe la sección del `.md` reflejando lo realmente hecho.
7. Registra el paso en el historial.

---

## 6. Historial paso a paso

Cada cambio se guarda como operación (p. ej. `.lenguaje/historial.jsonl`):

```json
{ "paso": 14, "fecha": "2026-10-30T15:04", "op": "mover_pagina",
  "componente": "BuscadorResultados", "de": "Home", "a": "Busqueda",
  "patch": [ ... ], "ficheros": ["Home.tsx", "Busqueda.tsx", "useSearch.ts"],
  "via": "ia", "commit": "a3f9c1" }
```

Permite: panel de historial legible, vista **side-by-side** (diff doc + diff código), **deshacer por pasos** (patch inverso), vínculo con commits git.

---

## 7. Preguntas abiertas

- Herencia/override: si `Boton` está en `Componentes.md` y cambio su prop en `Home.md`, ¿override solo en esa página? (propuesta: sí, modelo tipo componente/instancia de Figma)
- Anclas compartidas entre componentes (una clase CSS usada por dos): avisar o separar.
- Anclas huérfanas tras edición manual del código: detectar y marcar en el doc.
- Sincronización inversa: código editado a mano → proponer actualizar JSON/doc.
- Catálogo de propiedades tipadas admitidas y su sintaxis.
- Cuánto texto libre se permite (más tipado = más valor frente a un prompt).

---

## 8. Referentes (para estudiar, no copiar)

- **CodeSpeak** (Andrey Breslav, creador de Kotlin): specs en Markdown `.cs.md` compiladas por LLM, cambios incrementales por diff de la spec. Lógica general, no frontend.
- **Onlook**: editor visual React/Tailwind con sync bidireccional usando atributo `data-oid`. Edición visual, no por documento.
- **Kiro (AWS), Spec Kit (GitHub), Tessl, OpenSpec**: spec-driven development; specs por feature, no documentos vivos por componente.

**Hueco propio:** estructura fija orientada a webs (Stack/Config/Backend/páginas/componentes) + documento vivo reescrito por la IA + camino determinista sin IA para props tipadas + operaciones estructurales + historial.

---

## 9. Arquitectura del repo (propuesta)

**Stack de la extensión:** TypeScript, VS Code Extension API, Node 20+.
**Stack del ejemplo:** React + Vite + Tailwind (un solo stack al principio).

```
/
├── CLAUDE.md                 → instrucciones para agentes; referencia docs/CONTEXTO.md
├── README.md
├── docs/
│   └── CONTEXTO.md           → este documento
├── extension/
│   ├── package.json          → manifiesto de la extensión
│   ├── tsconfig.json
│   └── src/
│       ├── extension.ts      → activate(): watcher de guardado de .md
│       ├── parser/           → .md → JSON (frontmatter/yaml por componente)
│       ├── schema/           → JSON Schema del componente
│       ├── diff/             → JSON antiguo vs nuevo → lista de operaciones
│       ├── resolver/         → id/ancla → fichero + nodo (data-uid)
│       ├── apply/            → aplicadores deterministas (props CSS/Tailwind)
│       ├── ai/               → (más adelante) cliente IA para descripción/estructura
│       ├── history/          → historial.jsonl, deshacer
│       └── views/            → panel lateral (árbol + historial)
│   └── test/
└── examples/
    └── web-demo/             → React+Vite+Tailwind con data-uid
        ├── Stack.md
        └── frontend/paginas/Home.md + Home.json
```

---

## 10. Plan de hitos

### Hito 0 — Repo y validación del formato (sin IA, sin lógica compleja)
- [ ] Crear repo, `README.md`, `CLAUDE.md`, `docs/CONTEXTO.md`.
- [ ] Scaffold de la extensión (TypeScript) que se active y muestre "Hola".
- [ ] `examples/web-demo`: web React+Tailwind de 2 páginas (Home, Busqueda) con `data-uid` en los elementos.
- [ ] Escribir a mano `Home.md` y `Home.json` del ejemplo.
- [ ] Definir el **JSON Schema** v0 del componente.

### Hito 1 — Camino rápido determinista (MVP)
- [ ] Watcher: al guardar un `.md` de `frontend/paginas/`, parsearlo a JSON.
- [ ] Diff JSON antiguo/nuevo → operaciones.
- [ ] Resolver: id de componente → anclas → fichero y nodo por `data-uid`.
- [ ] Aplicador para props tipadas básicas: `border-radius`, `color`, `texto` (editando clases Tailwind o estilo inline).
- [ ] Mostrar diff del código (`vscode.diff`) para aceptar/rechazar.
- [ ] Al aceptar: escribir código + actualizar JSON.
- **Demo de éxito:** cambiar `border-radius: 8px → 16px` en `Home.md`, guardar, aceptar diff, ver el cambio en la web.

### Hito 2 — Panel lateral e historial
- [ ] Vista de árbol de componentes por página.
- [ ] `historial.jsonl` con cada operación (JSON Patch).
- [ ] Panel de historial con side-by-side y deshacer por pasos.

### Hito 3 — IA para descripciones
- [ ] Cambio en la descripción libre → enviar diff + código de anclas a la IA → aplicar con revisión → reescribir sección del `.md`.

### Hito 4 — Operaciones estructurales
- [ ] Agrupar / desagrupar / mover / anidar / cambiar de página (árbol en JSON + IA para el código).

### Hito 5 — Resto
- [ ] Generador código → docs (importar un proyecto existente e insertar `data-uid`).
- [ ] Sincronización inversa y detección de anclas huérfanas.
- [ ] `Backend.md`, `Configuracion.md` → `.env`.

---

## 11. Primera tarea para el agente

> Lee `docs/CONTEXTO.md`. Ejecuta el **Hito 0**: crea la estructura del repo descrita en §9, el scaffold de la extensión en TypeScript, el ejemplo `examples/web-demo` (React + Vite + Tailwind, páginas Home y Busqueda, con `data-uid` en cada elemento relevante), los ficheros `Home.md` y `Home.json` del ejemplo siguiendo §3–§4, y un JSON Schema v0 del componente en `extension/src/schema/`. No implementes todavía lógica de sincronización. Al terminar, resume lo creado y propón el detalle del Hito 1.
