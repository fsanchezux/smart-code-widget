import { useEffect, useState } from 'react';
import Home from './pages/Home';
import Busqueda from './pages/Busqueda';

// Router mínimo por hash: #/ → Home, #/busqueda → Busqueda.
function useRuta() {
  const [ruta, setRuta] = useState(window.location.hash);
  useEffect(() => {
    const alCambiar = () => setRuta(window.location.hash);
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);
  return ruta;
}

// Cabecera y pie son compartidos: irán en Componentes.md/json (fuera del Hito 0).
export default function App() {
  const ruta = useRuta();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header data-uid="a50" className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <a data-uid="a51" href="#/" className="text-lg font-bold text-primario">
            Tienda demo
          </a>
          <nav data-uid="a52" className="flex gap-4 text-sm">
            <a data-uid="a53" href="#/" className="hover:text-primario">Inicio</a>
            <a data-uid="a54" href="#/busqueda" className="hover:text-primario">Búsqueda</a>
          </nav>
        </div>
      </header>

      {ruta === '#/busqueda' ? <Busqueda /> : <Home />}

      <footer data-uid="a55" className="py-8 text-center text-xs text-slate-500">
        Ejemplo de smart-code-widget
      </footer>
    </div>
  );
}
