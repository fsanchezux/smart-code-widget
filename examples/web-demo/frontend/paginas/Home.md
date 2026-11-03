# Home

Portada de la tienda: presentación y un buscador rápido de productos.

## Hero
```yaml
tipo: section
props:
  border-radius: 16px
  hover:text-color: green-500
  transition: colors
```
Bloque de bienvenida centrado, con fondo blanco y sombra suave.

### Titulo
```yaml
tipo: text
props:
  texto: "Encuentra lo que buscas jajajaj"
```
El título usa Comic Sans y al hacer clic cambia a "Lorem Ipsum".

### Subtitulo
```yaml
tipo: text
props:
  texto: "Productos para tu casa y tu oficina, elegidos con cariño"
```

### BotonContacto
```yaml
tipo: button
props:
  texto: "Contáctanos"
  border-radius: 8px
  color: primario
```
Botón que abre el formulario de contacto. Al pasar el ratón se oscurece.

## BuscadorResultados
```yaml
tipo: grupo
props:
  border-radius: 12px
```
Busca productos mientras escribes y muestra los resultados.

### InputBuscador
```yaml
tipo: input
props:
  placeholder: "Buscar productos…"
  border-radius: 8px
```

### ListaResultados
```yaml
tipo: list
```
Rejilla de hasta 6 productos que coinciden con la búsqueda.

#### TarjetaProducto
```yaml
tipo: item
props:
  border-radius: 12px
```
Nombre del producto y precio en euros con dos decimales.

### Acciones
```yaml
tipo: grupo
```
Botones alineados a la derecha bajo los resultados.

#### BotonLimpiar
```yaml
tipo: button
props:
  texto: "Limpiar"
  border-radius: 8px
```
Vacía el texto del buscador.

#### EnlaceVerTodo
```yaml
tipo: link
props:
  texto: "Ver todo"
  border-radius: 8px
  color: secundario
```
Lleva a la página de Búsqueda.
