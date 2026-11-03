import { useMemo, useState } from 'react';
import type { Producto } from '../data/productos';

// Las anclas de lógica no tienen elemento donde poner data-uid:
// se marcan con un comentario `@uid` justo encima de la declaración.

// @uid a7
export function useSearch(productos: Producto[], categoria = '') {
  const [consulta, setConsulta] = useState('');

  const resultados = useMemo(() => {
    const texto = consulta.trim().toLowerCase();
    return productos.filter(
      (p) =>
        (!categoria || p.categoria === categoria) &&
        (!texto || p.nombre.toLowerCase().includes(texto)),
    );
  }, [productos, consulta, categoria]);

  return { consulta, setConsulta, resultados, limpiar: () => setConsulta('') };
}
