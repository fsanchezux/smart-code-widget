import { useState } from 'react';
import { categorias, productos } from '../data/productos';
import { useSearch } from '../hooks/useSearch';

export default function Busqueda() {
  // @uid a22
  const [categoria, setCategoria] = useState('');
  const { consulta, setConsulta, resultados } = useSearch(productos, categoria);

  return (
    <main data-uid="a20" className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <h1 data-uid="a21" className="text-3xl font-bold">Búsqueda</h1>

      <div data-uid="a23" className="flex flex-col gap-3 sm:flex-row">
        <input
          data-uid="a25"
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="¿Qué necesitas?"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 focus:border-primario focus:outline-none"
        />
        <select
          data-uid="a24"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <p data-uid="a26" className="text-sm text-slate-500">
        {resultados.length} resultado{resultados.length === 1 ? '' : 's'}
      </p>

      {resultados.length === 0 ? (
        <p data-uid="a32" className="rounded-xl bg-white p-8 text-center text-slate-500">
          No hay productos que coincidan.
        </p>
      ) : (
        <ul data-uid="a27" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resultados.map((p) => (
            <li data-uid="a28" key={p.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <p data-uid="a29" className="font-medium">{p.nombre}</p>
              <p data-uid="a30" className="text-xs uppercase tracking-wide text-secundario">{p.categoria}</p>
              <p data-uid="a31" className="mt-2 text-lg font-semibold">{p.precio.toFixed(2)} €</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
