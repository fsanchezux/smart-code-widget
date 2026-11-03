// Tipos del JSON por página (ver src/schema/pagina.schema.json).

export type Valor = string | number | boolean;

export interface Ancla {
  uid?: string;
  selector?: string;
  fichero: string;
  rol: 'visual' | 'logica';
}

export interface Prop {
  valor: Valor;
  aplica: string[];
}

export interface Componente {
  tipo: string;
  anclas: Record<string, Ancla>;
  props?: Record<string, Prop>;
  hijos?: string[];
  descripcion?: string;
}

export interface Pagina {
  $schema?: string;
  version: 0;
  pagina: string;
  descripcion?: string;
  raiz: string[];
  componentes: Record<string, Componente>;
}
