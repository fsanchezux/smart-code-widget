import { productos } from '../data/productos';
import { useSearch } from '../hooks/useSearch';

export default function Home() {
  // @uid a6
  const { consulta, setConsulta, resultados, limpiar } = useSearch(productos);

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
      <section data-uid="a1" className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <h1 data-uid="a2" className="text-4xl font-bold tracking-tight">
          Encuentra lo que buscas
        </h1>
        <p data-uid="a3" className="mx-auto mt-3 max-w-xl text-slate-600">
          Productos para tu casa y tu oficina, elegidos con cariño.
        </p>
        <button
          data-uid="a4"
          type="button"
          onClick={() => alert('Formulario de contacto (pendiente)')}
          className="mt-6 rounded-lg bg-primario px-5 py-2.5 font-medium text-white hover:bg-primario-oscuro"
        >
          Contáctanos
        </button>
      </section>

      <section data-uid="a5" className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <input
          data-uid="a8"
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar productos…"
          className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-primario focus:outline-none"
        />

        <ul data-uid="a9" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resultados.slice(0, 6).map((p) => (
            <li data-uid="a10" key={p.id} className="rounded-xl border border-slate-200 p-4">
              <p data-uid="a11" className="font-medium">{p.nombre}</p>
              <p data-uid="a12" className="text-sm text-slate-500">{p.precio.toFixed(2)} €</p>
            </li>
          ))}
        </ul>

        <div data-uid="a13" className="flex justify-end gap-3">
          <button
            data-uid="a14"
            type="button"
            onClick={limpiar}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Limpiar
          </button>
          <a
            data-uid="a15"
            href="#/busqueda"
            className="rounded-lg bg-secundario px-4 py-2 text-sm text-white hover:bg-secundario-oscuro"
          >
            Ver todo
          </a>
        </div>
      </section>
    </main>
  );
}
