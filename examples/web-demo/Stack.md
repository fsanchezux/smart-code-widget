# Stack

- **Framework:** React 19
- **Lenguaje:** TypeScript
- **Bundler / dev server:** Vite
- **Estilos:** Tailwind CSS v4 (colores con nombre en `src/index.css`: `primario`, `secundario`)
- **Routing:** por hash (`#/`, `#/busqueda`), sin dependencias
- **Backend:** ninguno (datos estáticos en `src/data/productos.ts`)
- **Hosting:** —

## Convenciones de anclas

- Elementos visuales: atributo `data-uid="aN"` en el JSX.
- Lógica (hooks, estado, handlers): comentario `// @uid aN` justo encima de la declaración.
- Los `uid` son únicos en todo el proyecto y no cambian aunque el componente se mueva de página.
